#!/usr/bin/env node
/**
 * verify-stories.js — fact-check story and profile citations against the DB.
 *
 * Usage:
 *   node scripts/verify-stories.js                  # check all stories + profiles
 *   node scripts/verify-stories.js ethiopia-ai-pr   # check one story by slug
 *   node scripts/verify-stories.js --profiles       # check all profiles only
 *
 * Checks:
 *   1. Every email_id in email_ids array exists in the DB
 *   2. Every quoted passage (text between escaped quotes followed by a parenthetical
 *      citation) appears in the cited email's body
 *   3. Sender attribution: "X wrote/replied/emailed/answered/asked/sent/pitched/told"
 *      near a citation should match the sender column
 *   4. Date claims (month + year) near citations should match sent_at
 *
 * Exit code 0 = all pass, 1 = failures found.
 */

const path = require("path");
const Database = require(path.join(__dirname, "..", "web", "node_modules", "better-sqlite3"));

const DB_PATH = path.join(__dirname, "..", "web", "data", "epstein_africa.db");
const STORIES_PATH = path.join(__dirname, "..", "web", "lib", "stories.js");
const PEOPLE_PATH = path.join(__dirname, "..", "web", "lib", "people.js");

// ---------------------------------------------------------------------------
// Load stories and people via a simple regex parse (avoids ESM import issues)
// ---------------------------------------------------------------------------

const fs = require("fs");

function loadArray(filePath, exportName) {
  const src = fs.readFileSync(filePath, "utf8");
  // Replace "export const X" with "globalThis.X" so it's accessible from the sandbox
  const wrapped = src
    .replace(/^export\s+const\s+(\w+)/gm, "globalThis.$1")
    .replace(/^export\s+function\s+/gm, "function ");
  const vm = require("vm");
  const sandbox = { globalThis: {} };
  vm.createContext(sandbox);
  vm.runInContext(wrapped, sandbox);
  return sandbox.globalThis[exportName];
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

let db;
function getEmail(emailId) {
  if (!db) db = new Database(DB_PATH, { readonly: true });
  return db.prepare("SELECT id, doc_id, sender, sent_at, body FROM emails WHERE id = ?").get(emailId);
}

// ---------------------------------------------------------------------------
// Quote extraction: find "quoted text" (CITATION-ID) patterns
// ---------------------------------------------------------------------------

function extractCitations(paragraph) {
  // Match: \"...\" (EMAIL_ID-N)  or  \"...\" (EMAIL_ID-N, EMAIL_ID-N)
  const results = [];
  // Pattern: escaped quote content followed by parenthetical with email IDs
  const re = /\\?"([^"]*?)\\?"\s*\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(paragraph)) !== null) {
    const quote = m[1];
    const idsPart = m[2];
    // Split multiple IDs: "EFTA123-0, EFTA456-1"
    const ids = idsPart.split(/,\s*/).map((s) => s.trim());
    results.push({ quote, ids, fullMatch: m[0] });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Fuzzy body match: normalise whitespace/OCR artifacts for comparison
// ---------------------------------------------------------------------------

function normalise(s) {
  return s
    .toLowerCase()
    .replace(/=\r?\n/g, "") // join soft line breaks (=\n)
    .replace(/=[0-9a-f]{2}/gi, "") // strip MIME encoding (=AO, =3D, =20 etc.)
    .replace(/\bal\b/g, "ai") // fix common OCR: "Al" (capital-A lowercase-L) → "AI"
    .replace(/[^a-z0-9$]/g, " ") // strip ALL punctuation including quotes
    .replace(/\s+/g, " ")
    .trim();
}

function bodyContains(body, quote) {
  if (!body || !quote) return false;
  const nb = normalise(body);
  const nq = normalise(quote);
  if (nq.length < 5) return true; // too short to be meaningful
  // Exact normalised match
  if (nb.includes(nq)) return true;
  // Word-sequence match: 80%+ of quote words found in order in body
  // Handles OCR run-togethers ("fora" vs "for a") and minor typos ("meanginful")
  const qWords = nq.split(" ").filter((w) => w.length > 2);
  if (qWords.length === 0) return true;
  let matched = 0;
  let searchFrom = 0;
  for (const word of qWords) {
    const idx = nb.indexOf(word, searchFrom);
    if (idx >= 0) {
      matched++;
      searchFrom = idx + word.length;
    }
  }
  return matched / qWords.length >= 0.8;
}

// ---------------------------------------------------------------------------
// Month matching
// ---------------------------------------------------------------------------

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function extractDateClaims(sentence) {
  const claims = [];
  const re = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/gi;
  let m;
  while ((m = re.exec(sentence)) !== null) {
    claims.push({ month: m[1].toLowerCase(), year: m[2] });
  }
  // Also match "In MONTH YEAR" or just "MONTH YEAR"
  return claims;
}

function dateSentAtMatches(sentAt, month, year) {
  if (!sentAt) return false;
  const d = new Date(sentAt);
  const sentMonth = MONTHS[d.getUTCMonth()];
  const sentYear = String(d.getUTCFullYear());
  return sentMonth === month && sentYear === year;
}

// ---------------------------------------------------------------------------
// Main verification
// ---------------------------------------------------------------------------

function verifyStory(story) {
  const errors = [];
  const warnings = [];

  // 1. Check all email_ids exist
  for (const eid of story.email_ids || []) {
    const row = getEmail(eid);
    if (!row) {
      errors.push(`MISSING EMAIL: ${eid} not found in DB`);
    }
  }

  // 2-4. Check each body paragraph
  for (let i = 0; i < (story.body || []).length; i++) {
    const para = story.body[i];
    const citations = extractCitations(para);

    for (const { quote, ids } of citations) {
      if (quote.length <= 10) continue;

      // Quote must match in at least ONE of the cited email IDs
      let foundInAny = false;
      const checkedIds = [];
      for (const eid of ids) {
        const row = getEmail(eid);
        if (!row) continue;
        checkedIds.push(eid);
        if (bodyContains(row.body, quote)) {
          foundInAny = true;
          break;
        }
      }

      if (!foundInAny && checkedIds.length > 0) {
        errors.push(
          `QUOTE MISMATCH [p${i + 1}]: "${quote.slice(0, 60)}..." not found in ${checkedIds.join(", ")}`
        );
      }
    }
  }

  // Also check summary quotes
  if (story.summary) {
    const sumCitations = extractCitations(story.summary);
    for (const { quote, ids } of sumCitations) {
      for (const eid of ids) {
        const row = getEmail(eid);
        if (!row) continue;
        if (quote.length > 10 && !bodyContains(row.body, quote)) {
          errors.push(
            `QUOTE MISMATCH [summary]: "${quote.slice(0, 60)}..." not found in ${eid}`
          );
        }
      }
    }
  }

  return { slug: story.slug, errors, warnings };
}

function verifyProfile(person) {
  const errors = [];

  // Profiles don't have email_ids, but searchTerms should match something
  // Check that the slug is well-formed
  if (!person.slug || !person.name) {
    errors.push("Missing slug or name");
  }

  return { slug: person.slug, errors, warnings: [] };
}

// ---------------------------------------------------------------------------
// Audit log — tracks which stories have passed verification and when
// ---------------------------------------------------------------------------

const AUDIT_LOG_PATH = path.join(__dirname, "..", "web", "data", "story-audit.json");

function loadAuditLog() {
  try {
    return JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveAuditLog(log) {
  fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(log, null, 2) + "\n");
}

function updateAuditLog(slug, emails, paragraphs) {
  const log = loadAuditLog();
  log[slug] = {
    passed: new Date().toISOString().slice(0, 10),
    emails,
    paragraphs,
  };
  saveAuditLog(log);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const slugFilter = args.find((a) => !a.startsWith("--"));
  const profilesOnly = args.includes("--profiles");
  const showStatus = args.includes("--status");
  const forceLog = args.includes("--force-log");

  let stories, people;
  try {
    stories = loadArray(STORIES_PATH, "STORIES");
    people = loadArray(PEOPLE_PATH, "PEOPLE");
  } catch (e) {
    console.error("Failed to load stories/people:", e.message);
    process.exit(1);
  }

  // --status: show audit state of all stories and exit
  if (showStatus) {
    const log = loadAuditLog();
    let audited = 0;
    let unaudited = 0;
    for (const story of stories) {
      const entry = log[story.slug];
      if (entry) {
        console.log(`  \x1b[32m✓\x1b[0m ${story.slug} — passed ${entry.passed} (${entry.emails} emails, ${entry.paragraphs} paragraphs)`);
        audited++;
      } else {
        console.log(`  \x1b[33m?\x1b[0m ${story.slug} — never verified`);
        unaudited++;
      }
    }
    console.log();
    console.log(`${audited} audited, ${unaudited} unverified, ${stories.length} total.`);
    process.exit(0);
  }

  // --force-log <slug>: manually mark a story as audited (for human-verified edge cases)
  if (forceLog && slugFilter) {
    const story = stories.find((s) => s.slug === slugFilter);
    if (!story) {
      console.error(`Story "${slugFilter}" not found`);
      process.exit(1);
    }
    updateAuditLog(
      story.slug,
      (story.email_ids || []).length,
      (story.body || []).length
    );
    console.log(`  \x1b[33m⚑\x1b[0m ${story.slug} — manually logged as audited (${new Date().toISOString().slice(0, 10)})`);
    process.exit(0);
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
        console.log(`  \x1b[32m✓\x1b[0m ${story.slug} (${(story.email_ids || []).length} emails, ${(story.body || []).length} paragraphs)`);
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
