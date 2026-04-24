#!/usr/bin/env node
/**
 * verify-stories.js — fact-check story and profile citations against the DB.
 *
 * Usage:
 *   node scripts/verify-stories.js                  # check all stories + profiles
 *   node scripts/verify-stories.js ethiopia-ai-pr   # check one story by slug
 *   node scripts/verify-stories.js --profiles       # check profiles only
 *
 * Checks (reporter only — no auto-fix, no source mutation):
 *   1. Every email_id in email_ids array exists in the DB.
 *   2. Every inline citation in body/summary EN+FR exists and is listed in
 *      email_ids.
 *   3. Every adjacent quoted passage ("..." (EMAIL_ID)) in body/summary EN+FR
 *      appears in the cited email body.
 *   4. Every news_links[].url that points to /emails/<id> resolves via the
 *      single canonical id lookup.
 *   5. Every country in story `countries` array is African (Africa-only rule).
 *   6. Optional source_only_ids and external_sources entries are well formed.
 *   7. Profile entries have a slug and name.
 *
 * Exit code 0 = all pass, 1 = failures found.
 *
 * The DB has been canonicalized: every row id is `{doc_id}-N`. The route
 * resolves citations with one SELECT WHERE id = ?. There are no fallbacks
 * and there is no auto-fix machinery here. If a citation fails, fix it by
 * hand.
 */

const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "..", "web", "node_modules", "better-sqlite3"));

const DB_PATH = path.join(__dirname, "..", "web", "data", "epstein_africa.db");
const STORIES_PATH = path.join(__dirname, "..", "web", "lib", "stories.js");
const PEOPLE_PATH = path.join(__dirname, "..", "web", "lib", "people.js");
const CITATIONS_PATH = path.join(__dirname, "..", "web", "lib", "citations.js");

// Africa-only rule: story `countries` arrays must contain only African
// values (or the generic "Africa" tag). Non-African mentions in body prose
// are fine — this set only constrains the filter array. See
// memory/feedback_africa_countries_only.md for the rationale.
const AFRICAN_COUNTRIES = new Set([
  "Africa",
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cape Verde", "Cameroon", "Central African Republic", "Chad",
  "Comoros", "Congo", "DRC", "Côte d'Ivoire", "Ivory Coast", "Djibouti", "Egypt",
  "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon",
  "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho",
  "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania",
  "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria",
  "Rwanda", "São Tomé and Príncipe", "Sao Tome and Principe", "Senegal",
  "Seychelles", "Sierra Leone", "Somalia", "Somaliland", "South Africa",
  "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda",
  "Western Sahara", "Zambia", "Zimbabwe",
]);

// ---------------------------------------------------------------------------
// Load stories.js / people.js by stripping `export` and running in a vm sandbox
// ---------------------------------------------------------------------------

function loadArray(filePath, exportName) {
  const src = fs.readFileSync(filePath, "utf8");
  const wrapped = src
    .replace(/^export\s+const\s+(\w+)/gm, "globalThis.$1")
    .replace(/^export\s+function\s+/gm, "function ");
  const vm = require("vm");
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox);
  return sandbox.globalThis[exportName];
}

function loadExports(filePath, exportNames) {
  const src = fs.readFileSync(filePath, "utf8");
  const wrapped = src
    .replace(/^export\s+const\s+(\w+)/gm, "const $1")
    .replace(/^export\s+function\s+(\w+)/gm, "function $1");
  const vm = require("vm");
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(
    `${wrapped}\n${exportNames.map((name) => `globalThis.${name} = ${name};`).join("\n")}`,
    sandbox
  );
  return Object.fromEntries(exportNames.map((name) => [name, sandbox.globalThis[name]]));
}

const { extractCitationIds, isSupportedCitationId } = loadExports(CITATIONS_PATH, [
  "extractCitationIds",
  "isSupportedCitationId",
]);

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

let db;
function getDb() {
  if (!db) db = new Database(DB_PATH, { readonly: true });
  return db;
}

function getEmail(emailId) {
  return getDb()
    .prepare("SELECT id, doc_id, sender, sent_at, body FROM emails WHERE id = ?")
    .get(emailId);
}

// ---------------------------------------------------------------------------
// Quote extraction and fuzzy match
// ---------------------------------------------------------------------------

function extractQuotedCitations(text) {
  // Match adjacent: "quoted text" (EMAIL_ID) — handles comma-separated ids.
  const results = [];
  const re = /\\?"([^"]*?)\\?"\s*\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text || "")) !== null) {
    const quote = m[1];
    const ids = m[2]
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter((id) => isSupportedCitationId(id));
    results.push({ quote, ids });
  }
  return results;
}

function storyTextFields(story) {
  const fields = [];
  for (const field of ["summary", "summary_fr"]) {
    if (story[field]) fields.push({ label: field, values: [story[field]] });
  }
  for (const field of ["body", "body_fr"]) {
    if (Array.isArray(story[field])) fields.push({ label: field, values: story[field] });
  }
  return fields;
}

function normalise(s) {
  return s
    .toLowerCase()
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=[0-9a-f]{2}/gi, "") // MIME encoding artifacts
    .replace(/\bal\b/g, "ai") // common OCR: capital-A lowercase-L → AI
    .replace(/[^a-z0-9$]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bodyContains(body, quote) {
  if (!body || !quote) return false;
  const nb = normalise(body);
  const nq = normalise(quote);
  if (nq.length < 5) return true;
  if (nb.includes(nq)) return true;
  // Word-sequence fallback: 80% of quote words found in order. Tolerates
  // OCR run-togethers and minor typos.
  const qWords = nq.split(" ").filter((w) => w.length > 2);
  if (qWords.length === 0) return true;
  let matched = 0;
  let from = 0;
  for (const word of qWords) {
    const idx = nb.indexOf(word, from);
    if (idx >= 0) {
      matched++;
      from = idx + word.length;
    }
  }
  return matched / qWords.length >= 0.8;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

function verifyStory(story) {
  const errors = [];
  const emailIds = new Set(story.email_ids || []);

  // 1. email_ids array entries must exist.
  for (const eid of story.email_ids || []) {
    if (!getEmail(eid)) {
      errors.push(`MISSING EMAIL: ${eid} not found in DB`);
    }
  }

  // 2. Inline citations must be supported, resolvable, and listed in email_ids.
  for (const { label, values } of storyTextFields(story)) {
    values.forEach((text, index) => {
      for (const cid of extractCitationIds(text)) {
        if (!isSupportedCitationId(cid)) {
          errors.push(`UNSUPPORTED CITATION [${label} ${index + 1}]: ${cid}`);
        } else if (!getEmail(cid)) {
          errors.push(`MISSING INLINE EMAIL [${label} ${index + 1}]: ${cid} not found in DB`);
        } else if (!emailIds.has(cid)) {
          errors.push(`INLINE CITATION NOT IN email_ids [${label} ${index + 1}]: ${cid}`);
        }
      }
    });
  }

  // 3. Optional source_only_ids must be documented escape hatches.
  for (const entry of story.source_only_ids || []) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push("BAD source_only_ids ENTRY: entries must be objects with id and reason");
      continue;
    }
    if (!entry.id || typeof entry.id !== "string") {
      errors.push("BAD source_only_ids ENTRY: missing id");
      continue;
    }
    if (!entry.reason || typeof entry.reason !== "string" || entry.reason.trim().length < 10) {
      errors.push(`BAD source_only_ids ENTRY: ${entry.id} needs a specific reason`);
    }
    if (!emailIds.has(entry.id)) {
      errors.push(`source_only_ids ENTRY NOT IN email_ids: ${entry.id}`);
    }
    if (!getEmail(entry.id)) {
      errors.push(`MISSING source_only_ids EMAIL: ${entry.id} not found in DB`);
    }
  }

  // 4. Optional external_sources must point to text that exists in story prose.
  const allStoryText = storyTextFields(story)
    .flatMap(({ values }) => values)
    .join("\n");
  for (const [i, source] of (story.external_sources || []).entries()) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      errors.push(`BAD external_sources[${i}]: entries must be objects`);
      continue;
    }
    if (!source.text || typeof source.text !== "string") {
      errors.push(`BAD external_sources[${i}]: missing text`);
    } else if (!allStoryText.includes(source.text)) {
      errors.push(`external_sources[${i}] TEXT NOT FOUND IN STORY: "${source.text.slice(0, 80)}"`);
    }
    try {
      const url = new URL(source.url);
      if (!["http:", "https:"].includes(url.protocol)) {
        errors.push(`BAD external_sources[${i}] URL PROTOCOL: ${source.url}`);
      }
    } catch {
      errors.push(`BAD external_sources[${i}] URL: ${source.url || "(missing)"}`);
    }
  }

  // 5. news_links URLs that point at /emails/<id> must resolve.
  for (const link of story.news_links || []) {
    if (!link || !link.url) continue;
    const m = link.url.match(/^\/emails\/([^/?#]+)/);
    if (!m) continue;
    const reqId = decodeURIComponent(m[1]);
    if (!getEmail(reqId)) {
      errors.push(`BROKEN news_links URL: ${link.url} (would 404 at runtime)`);
    }
  }

  // 6. Adjacent body/summary quotes must appear in the cited email.
  for (const { label, values } of storyTextFields(story)) {
    values.forEach((text, index) => {
      for (const { quote, ids } of extractQuotedCitations(text)) {
        if (quote.length <= 10) continue;
        let foundIn = false;
        const checked = [];
        for (const eid of ids) {
          const row = getEmail(eid);
          if (!row) continue;
          checked.push(eid);
          if (bodyContains(row.body, quote)) {
            foundIn = true;
            break;
          }
        }
        if (!foundIn && checked.length > 0) {
          errors.push(
            `QUOTE MISMATCH [${label} ${index + 1}]: "${quote.slice(0, 60)}..." not found in ${checked.join(", ")}`
          );
        }
      }
    });
  }

  // 7. Country tags must be African (Africa-only rule).
  for (const country of story.countries || []) {
    if (!AFRICAN_COUNTRIES.has(country)) {
      errors.push(
        `NON-AFRICAN COUNTRY: "${country}" in countries[] (Africa-only rule)`
      );
    }
  }

  // 8. i18n parity: if any FR field is present, all three must be, and
  //    body_fr paragraph count must equal body paragraph count.
  const hasAnyFr = Boolean(story.title_fr || story.summary_fr || story.body_fr);
  if (hasAnyFr) {
    if (!story.title_fr) errors.push("FR PARITY: missing title_fr");
    if (!story.summary_fr) errors.push("FR PARITY: missing summary_fr");
    if (!Array.isArray(story.body_fr) || story.body_fr.length === 0) {
      errors.push("FR PARITY: missing body_fr");
    } else if (Array.isArray(story.body) && story.body.length !== story.body_fr.length) {
      errors.push(
        `FR PARITY: body has ${story.body.length} paragraph(s), body_fr has ${story.body_fr.length}`
      );
    }
  }

  return { slug: story.slug, errors };
}

function verifyProfile(person) {
  const errors = [];
  if (!person.slug || !person.name) errors.push("Missing slug or name");
  return { slug: person.slug, errors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const slugFilter = args.find((a) => !a.startsWith("--"));
  const profilesOnly = args.includes("--profiles");

  let stories, people;
  try {
    stories = loadArray(STORIES_PATH, "STORIES");
    people = loadArray(PEOPLE_PATH, "PEOPLE");
  } catch (e) {
    console.error("Failed to load stories/people:", e.message);
    process.exit(1);
  }

  let totalErrors = 0;
  let totalChecked = 0;

  if (!profilesOnly) {
    const toCheck = slugFilter
      ? stories.filter((s) => s.slug === slugFilter)
      : stories;
    if (slugFilter && toCheck.length === 0) {
      console.error(`Story "${slugFilter}" not found`);
      process.exit(1);
    }
    for (const story of toCheck) {
      const result = verifyStory(story);
      totalChecked++;
      if (result.errors.length === 0) {
        console.log(
          `  \x1b[32m✓\x1b[0m ${story.slug} (${(story.email_ids || []).length} emails, ${(story.body || []).length} paragraphs)`
        );
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${story.slug}`);
        for (const e of result.errors) {
          console.log(`    \x1b[31m${e}\x1b[0m`);
        }
        totalErrors += result.errors.length;
      }
    }
  }

  if (profilesOnly || !slugFilter) {
    for (const person of people) {
      const result = verifyProfile(person);
      totalChecked++;
      if (result.errors.length > 0) {
        console.log(`  \x1b[31m✗\x1b[0m profile: ${person.slug}`);
        for (const e of result.errors) {
          console.log(`    \x1b[31m${e}\x1b[0m`);
        }
        totalErrors += result.errors.length;
      }
    }
  }

  console.log();
  if (totalErrors > 0) {
    console.log(`\x1b[31m${totalErrors} error(s) across ${totalChecked} items.\x1b[0m`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll ${totalChecked} items passed automated checks.\x1b[0m`);
    process.exit(0);
  }
}

main();
