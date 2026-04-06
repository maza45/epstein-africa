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
function getDb() {
  if (!db) db = new Database(DB_PATH, { readonly: true });
  return db;
}

function getEmail(emailId) {
  return getDb().prepare("SELECT id, doc_id, sender, sent_at, body FROM emails WHERE id = ?").get(emailId);
}

function getEmailsByDocId(docId) {
  return getDb().prepare("SELECT id FROM emails WHERE doc_id = ?").all(docId);
}

// Insert a new entry into a story's email_ids array in the source.
// Returns the modified src. Locates the story by slug, finds the email_ids
// array, and inserts the new id on its own line just before the closing `]`,
// matching the indentation of existing entries.
function insertEmailId(src, slug, newId) {
  const slugRe = new RegExp(`slug:\\s*["']${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
  const slugMatch = slugRe.exec(src);
  if (!slugMatch) return { src, ok: false, reason: `slug not found: ${slug}` };

  // Find the next email_ids: [ after the slug
  const fromSlug = src.indexOf("email_ids:", slugMatch.index);
  if (fromSlug === -1) return { src, ok: false, reason: `email_ids not found for ${slug}` };
  const openBracket = src.indexOf("[", fromSlug);
  if (openBracket === -1) return { src, ok: false, reason: `[ not found after email_ids for ${slug}` };

  // Find the matching closing ] (depth-tracked in case of nested brackets, though there shouldn't be any)
  let depth = 1;
  let closeBracket = -1;
  for (let i = openBracket + 1; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) { closeBracket = i; break; }
    }
  }
  if (closeBracket === -1) return { src, ok: false, reason: `unmatched [ for ${slug}` };

  // Idempotency check: skip if id is already present in this array
  const arrayContent = src.slice(openBracket, closeBracket);
  if (new RegExp(`["']${newId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(arrayContent)) {
    return { src, ok: true, alreadyPresent: true };
  }

  // Detect indentation from an existing entry; default to 6 spaces
  let entryIndent = "      ";
  const entryMatch = arrayContent.match(/\n(\s+)["']/);
  if (entryMatch) entryIndent = entryMatch[1];

  // Find the start of the line containing the closing ]
  let lineStart = closeBracket;
  while (lineStart > 0 && src[lineStart - 1] !== "\n") lineStart--;

  const insertion = `${entryIndent}"${newId}",\n`;
  return { src: src.slice(0, lineStart) + insertion + src.slice(lineStart), ok: true };
}

// Walk a story's body and return the set of citation IDs that look like real
// email IDs (matching the format conventions). Used by the email_ids
// reconciliation step in --fix mode.
function extractCitedIdsFromBody(story) {
  const cited = new Set();
  for (const para of story.body || []) {
    const idRe = /\(([A-Za-z0-9_\-\.]+(?:\s*,\s*[A-Za-z0-9_\-\.]+)*)\)/g;
    let m;
    while ((m = idRe.exec(para)) !== null) {
      const ids = m[1].split(/,\s*/).map((s) => s.trim());
      for (const id of ids) {
        if (id.length < 8) continue;
        if (/^[a-z]/.test(id) && !id.startsWith("vol")) continue;
        cited.add(id);
      }
    }
  }
  return cited;
}

// Mirror of pages/emails/[id].js getServerSideProps fallback chain.
// Returns true if the requested id would resolve at runtime, false if it would 404.
function emailIdResolves(reqId) {
  const d = getDb();
  if (d.prepare("SELECT 1 FROM emails WHERE id = ?").get(reqId)) return true;
  if (d.prepare("SELECT 1 FROM emails WHERE id = ?").get(`${reqId}-0`)) return true;
  if (d.prepare("SELECT 1 FROM emails WHERE doc_id = ?").get(reqId)) return true;
  const m = reqId.match(/^(.+)-\d+$/);
  if (m) {
    const stripped = m[1];
    if (d.prepare("SELECT 1 FROM emails WHERE id = ? OR doc_id = ?").get(stripped, stripped)) {
      return true;
    }
  }
  return false;
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

// Strict version: require exact normalised substring match. No fuzzy fallback.
// Used by the disambiguation paths so loose word-overlap can't pick the wrong sibling.
function bodyContainsExact(body, quote) {
  if (!body || !quote) return false;
  const nb = normalise(body);
  const nq = normalise(quote);
  if (nq.length < 5) return false;
  return nb.includes(nq);
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

// Collapse a list of matching siblings into one canonical pick.
// If all of them are duplicate ingests (same normalised body), treat as one
// and return the lexicographically lowest id (the original ingest).
// If they have different bodies, they're truly ambiguous and we return null.
function collapseDuplicates(matches) {
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const bodies = matches.map((m) => {
    const full = getEmail(m.id);
    return full ? normalise(full.body || "") : "";
  });
  const allSame = bodies.every((b) => b === bodies[0]);
  if (!allSame) return null;
  // Duplicates — pick the lowest id (sorted lexicographically by suffix-aware order)
  const sorted = [...matches].sort((a, b) => {
    // Try numeric suffix sort first
    const am = a.id.match(/-(\d+)$/);
    const bm = b.id.match(/-(\d+)$/);
    if (am && bm) return Number(am[1]) - Number(bm[1]);
    return a.id < b.id ? -1 : 1;
  });
  return sorted[0];
}

// Pick the unique sibling whose body contains the quote.
// Prefer exact substring match; only fall back to fuzzy if no sibling matches exactly.
// Treats duplicate-ingest siblings (identical body content) as a single canonical pick.
// Returns { id } when uniquely resolvable, or null otherwise.
function pickSiblingForQuote(siblings, quote, excludeId) {
  if (!quote || quote.length <= 10) return null;
  const candidates = siblings.filter((s) => s.id !== excludeId);

  const exact = candidates.filter((s) => {
    const full = getEmail(s.id);
    return full && bodyContainsExact(full.body, quote);
  });
  const exactPick = collapseDuplicates(exact);
  if (exactPick) return exactPick;
  if (exact.length > 1) return null; // multiple distinct matches — truly ambiguous

  const fuzzy = candidates.filter((s) => {
    const full = getEmail(s.id);
    return full && bodyContains(full.body, quote);
  });
  return collapseDuplicates(fuzzy);
}

function verifyStory(story) {
  const errors = [];
  const warnings = [];
  const fixes = []; // { paraIndex, oldId, newId, kind: "bare" | "wrong_suffix" }

  // 1. Check all email_ids exist
  for (const eid of story.email_ids || []) {
    const row = getEmail(eid);
    if (!row) {
      errors.push(`MISSING EMAIL: ${eid} not found in DB`);
    }
  }

  // 1b. Check every news_links[].url that points to /emails/<id> resolves at runtime.
  // Catches the bug class where a news_links URL has a stale -N suffix or wrong form.
  for (const link of story.news_links || []) {
    if (!link || !link.url) continue;
    const m = link.url.match(/^\/emails\/([^/?#]+)/);
    if (!m) continue;
    const reqId = decodeURIComponent(m[1]);
    if (!emailIdResolves(reqId)) {
      errors.push(`BROKEN news_links URL: ${link.url} (would 404 at runtime)`);
    }
  }

  // 2. Check each body paragraph: quote must be in cited row, OR in a sibling
  // (in which case we propose a fix instead of an error).
  for (let i = 0; i < (story.body || []).length; i++) {
    const para = story.body[i];
    const citations = extractCitations(para);

    for (const { quote, ids, fullMatch } of citations) {
      if (quote.length <= 10) continue;

      // Quote must match in at least ONE of the cited email IDs
      let foundInAny = false;
      let proposedFix = null;
      const checkedIds = [];
      for (const eid of ids) {
        const row = getEmail(eid);
        if (!row) continue;
        checkedIds.push(eid);
        if (bodyContains(row.body, quote)) {
          foundInAny = true;
          break;
        }
        // Cited row doesn't contain the quote — try siblings under the same doc_id.
        // The wrong-suffix bug class: previous auto-fix wrote the wrong -N for the
        // quote, but a sibling does contain it. Propose a fix, don't silently pass.
        // The anchor (fullMatch) lets the fix application target THIS specific
        // citation, not just any occurrence of the bare id in the paragraph.
        if (!proposedFix) {
          const siblings = getEmailsByDocId(row.doc_id);
          const sib = pickSiblingForQuote(siblings, quote, row.id);
          if (sib) {
            proposedFix = { paraIndex: i, oldId: eid, newId: sib.id, kind: "wrong_suffix", anchor: fullMatch };
          }
        }
      }

      if (!foundInAny && checkedIds.length > 0) {
        if (proposedFix) {
          fixes.push(proposedFix);
        } else {
          errors.push(
            `QUOTE MISMATCH [p${i + 1}]: "${quote.slice(0, 60)}..." not found in ${checkedIds.join(", ")}`
          );
        }
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

  // 3. Check inline citation IDs exist in DB (catches bare doc_ids without suffix).
  // This walks each citation+id pair and uses ONLY that citation's own quote to
  // disambiguate (the previous version walked ALL paragraph quotes, which produced
  // wrong-sibling resolutions when one quote happened to match a sibling of the
  // wrong document). For non-quoted parenthetical IDs (no nearby quote), only
  // single-match siblings are auto-resolvable.
  for (let i = 0; i < (story.body || []).length; i++) {
    const para = story.body[i];
    const citations = extractCitations(para);

    // Track which parenthetical strings are part of a quote+id pair so we don't
    // process them twice in the bare-id-only loop below. Keyed by fullMatch.
    const quotedAnchors = new Set();
    for (const cit of citations) {
      for (const eid of cit.ids) {
        if (eid.length < 8 || (/^[a-z]/.test(eid) && !eid.startsWith("vol"))) continue;
        quotedAnchors.add(cit.fullMatch);
        const row = getEmail(eid);
        if (row) continue; // exists, fine
        const matches = getEmailsByDocId(eid);
        if (matches.length === 0) continue;
        if (matches.length === 1) {
          fixes.push({ paraIndex: i, oldId: eid, newId: matches[0].id, kind: "bare", anchor: cit.fullMatch });
          continue;
        }
        // Multiple siblings — disambiguate using ONLY this citation's quote.
        const sib = pickSiblingForQuote(matches, cit.quote, null);
        if (sib) {
          fixes.push({ paraIndex: i, oldId: eid, newId: sib.id, kind: "bare", anchor: cit.fullMatch });
        } else {
          errors.push(
            `BARE DOC_ID [p${i + 1}]: "${eid}" has ${matches.length} emails in DB, quote could not be uniquely placed — pick one: ${matches.map((r) => r.id).join(", ")}`
          );
        }
      }
    }

    // Also process bare IDs in parentheticals that are NOT part of a quote+id pair
    // (e.g. trailing source citations with no inline quote). Only auto-fix single
    // matches; multi-match cases need a quote and there isn't one here.
    const idRe = /\(([A-Za-z0-9_\-\.]+(?:-(?:pdf|[0-9]+))?(?:\s*,\s*[A-Za-z0-9_\-\.]+(?:-(?:pdf|[0-9]+))?)*)\)/g;
    let m;
    while ((m = idRe.exec(para)) !== null) {
      if (quotedAnchors.has(m[0])) continue; // already handled in the quoted loop above
      const parentheticalAnchor = m[0];
      const ids = m[1].split(/,\s*/).map((s) => s.trim());
      for (const eid of ids) {
        if (eid.length < 8 || (/^[a-z]/.test(eid) && !eid.startsWith("vol"))) continue;
        const row = getEmail(eid);
        if (row) continue;
        const matches = getEmailsByDocId(eid);
        if (matches.length === 1) {
          fixes.push({ paraIndex: i, oldId: eid, newId: matches[0].id, kind: "bare", anchor: parentheticalAnchor });
        } else if (matches.length > 1) {
          errors.push(
            `BARE DOC_ID [p${i + 1}]: "${eid}" has ${matches.length} emails in DB, no nearby quote to disambiguate — pick one: ${matches.map((r) => r.id).join(", ")}`
          );
        }
      }
    }
  }

  return { slug: story.slug, errors, warnings, fixes };
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
// Deep audit — find silently-wrong citations that the main verifier accepts
// ---------------------------------------------------------------------------
//
// The main quote check passes a citation if the cited row's body fuzzy-matches
// the quote (80% word-in-order). That can pass cases where the cited row is
// not actually the right message — e.g. the cited row is a long forwarded
// chain that contains the quote text by accident, while a sibling under the
// same doc_id has the quote as a clean exact match.
//
// This is the bug class that produced the 4 wrong-suffix citations in
// mandelson and marrakech on 2026-04-03 (db7a9a1's buggy auto-fix). The
// wrong-suffix detection in the main quote check catches the cases where the
// cited row fails fuzzy too, but cases where the cited row passes fuzzy
// without exact need this stronger check.
//
// Read-only — reports findings, never modifies anything. Run via --audit-deep.

function runDeepAudit(stories) {
  const suspects = [];
  let totalCitations = 0;

  for (const story of stories) {
    for (let pi = 0; pi < (story.body || []).length; pi++) {
      const para = story.body[pi];
      const citations = extractCitations(para);
      for (const { quote, ids } of citations) {
        if (quote.length <= 10) continue;
        for (const eid of ids) {
          totalCitations++;
          const cited = getEmail(eid);
          if (!cited) continue;
          // If the cited row is a strong (exact) match, skip — it's fine.
          if (bodyContainsExact(cited.body, quote)) continue;
          // If the cited row doesn't even fuzzy-match, the existing
          // wrong-suffix detection in the main quote check would catch it.
          if (!bodyContains(cited.body, quote)) continue;
          // Cited row passes fuzzy but not exact. Look for siblings with exact match.
          const siblings = getEmailsByDocId(cited.doc_id).filter((s) => s.id !== eid);
          const exactSiblings = siblings.filter((s) => {
            const full = getEmail(s.id);
            return full && bodyContainsExact(full.body, quote);
          });
          if (exactSiblings.length === 0) continue;
          suspects.push({
            story: story.slug,
            paragraph: pi + 1,
            cited: eid,
            quote: quote.slice(0, 80),
            exactSiblings: exactSiblings.map((s) => s.id),
          });
        }
      }
    }
  }

  console.log(`Scanned ${totalCitations} citations across ${stories.length} stories.`);
  console.log(`Found ${suspects.length} suspects where a sibling has an exact match while the cited row only fuzzy-matches:`);
  console.log();
  for (const s of suspects) {
    console.log(`  \x1b[33m${s.story} [p${s.paragraph}]\x1b[0m`);
    console.log(`    cited:    ${s.cited}`);
    console.log(`    siblings: ${s.exactSiblings.join(", ")}`);
    console.log(`    quote:    "${s.quote}..."`);
    console.log();
  }
  return suspects.length;
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
  const autoFix = args.includes("--fix");
  const auditDeep = args.includes("--audit-deep");

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

  // --audit-deep: read-only deep audit. For every cited row, check if a
  // sibling under the same doc_id has a strictly stronger (exact) match for
  // the quote. Catches the bug class where the cited row is a long forwarded
  // chain that fuzzy-matches the quote by accident, while a clean sibling
  // has the actual quoted text. This is the same bug class that produced
  // the wrong-suffix citations on 2026-04-03 (db7a9a1).
  // Run periodically as a safety net, especially after bulk content edits.
  if (auditDeep) {
    const suspectCount = runDeepAudit(stories);
    process.exit(suspectCount > 0 ? 1 : 0);
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

    let allFixes = []; // { slug, fixes[] }

    for (const story of toCheck) {
      const result = verifyStory(story);
      totalChecked++;

      const hasErrors = result.errors.length > 0;
      const hasFixes = result.fixes && result.fixes.length > 0;

      if (!hasErrors && !hasFixes) {
        console.log(`  \x1b[32m✓\x1b[0m ${story.slug} (${(story.email_ids || []).length} emails, ${(story.body || []).length} paragraphs)`);
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${story.slug}`);
        for (const e of result.errors) {
          console.log(`    \x1b[31m${e}\x1b[0m`);
        }
        for (const f of result.fixes || []) {
          const tag = f.kind === "wrong_suffix" ? "WRONG SUFFIX" : "BARE DOC_ID";
          if (autoFix) {
            console.log(`    \x1b[33mFIXED [${tag}, p${f.paraIndex + 1}]: "${f.oldId}" → "${f.newId}"\x1b[0m`);
          } else {
            console.log(`    \x1b[31m${tag} [p${f.paraIndex + 1}]: "${f.oldId}" → "${f.newId}" (run with --fix to auto-resolve)\x1b[0m`);
          }
        }
        totalErrors += result.errors.length;
        if (!autoFix) totalErrors += (result.fixes || []).length;
      }

      if (hasFixes) allFixes.push({ slug: story.slug, fixes: result.fixes });
    }

    // Apply fixes to stories.js — anchor-based, per occurrence.
    // Each fix carries an `anchor` field that is the full citation context
    // (e.g. '"quote text" (oldId)' for quoted citations, or '(oldId)' for
    // unquoted ones). The application searches for that exact anchor and
    // replaces just the (oldId) inside it, leaving every other occurrence of
    // the same id elsewhere in the paragraph untouched. This is what fixes
    // the marrakech p15 case where the same bare doc_id was cited twice in
    // the same paragraph for two different quotes — each citation now gets
    // resolved independently to its correct sibling.
    if (autoFix && allFixes.length > 0) {
      let src = fs.readFileSync(STORIES_PATH, "utf8");
      let totalFixed = 0;
      // Reload stories so paragraph indices match the current source on disk
      const freshStories = loadArray(STORIES_PATH, "STORIES");
      const storyBySlug = new Map(freshStories.map((s) => [s.slug, s]));

      for (const { slug, fixes } of allFixes) {
        const story = storyBySlug.get(slug);
        if (!story) continue;
        // Group fixes by paragraph index, preserving order
        const byPara = new Map();
        for (const f of fixes) {
          if (!byPara.has(f.paraIndex)) byPara.set(f.paraIndex, []);
          byPara.get(f.paraIndex).push(f);
        }
        for (const [paraIndex, paraFixes] of byPara) {
          const original = (story.body || [])[paraIndex];
          if (original == null) continue;
          let modified = original;
          for (const f of paraFixes) {
            if (!f.anchor) {
              console.log(`    \x1b[31mWARNING: fix has no anchor — skipping (${f.oldId} → ${f.newId})\x1b[0m`);
              continue;
            }
            // Build a new anchor with oldId replaced by newId.
            // We replace inside the anchor string (not the full paragraph)
            // so we know exactly which (oldId) we're touching.
            const escaped = f.oldId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const isSuffixed = /-\d+$/.test(f.oldId);
            const tail = isSuffixed ? "(?!\\d)" : "(?!-)";
            const re = new RegExp(`\\b${escaped}\\b${tail}`);
            const newAnchor = f.anchor.replace(re, f.newId);
            if (newAnchor === f.anchor) {
              console.log(`    \x1b[31mWARNING: anchor did not contain ${f.oldId} (${slug} p${paraIndex + 1})\x1b[0m`);
              continue;
            }
            // Find this exact anchor in the (possibly already-modified) paragraph
            // and replace the first occurrence. Ordered fixes for the same anchor
            // would need extra care; in practice anchors are unique per fix because
            // each citation has its own quote.
            if (modified.includes(f.anchor)) {
              modified = modified.replace(f.anchor, newAnchor);
            } else {
              console.log(`    \x1b[31mWARNING: anchor not found in paragraph ${paraIndex + 1} of ${slug}\x1b[0m`);
            }
          }
          if (modified !== original) {
            const origJson = JSON.stringify(original);
            const modJson = JSON.stringify(modified);
            if (src.includes(origJson)) {
              src = src.replace(origJson, modJson);
              totalFixed++;
            } else {
              console.log(`    \x1b[31mWARNING: could not locate paragraph ${paraIndex + 1} of ${slug} in source\x1b[0m`);
            }
          }
        }
      }
      // Reconcile email_ids: any id newly cited in the body that isn't in
      // the story's email_ids array gets added. We do this by re-loading the
      // (now-modified) source so paragraph indices match the new state, then
      // walking each affected story's body to find citations missing from
      // email_ids. Conservative — we ADD missing ids but never REMOVE
      // existing ones (some stories intentionally keep context emails in
      // email_ids that aren't directly quoted).
      // Duplicate handling: if a content-identical row (same doc_id, same
      // normalised body) is already in email_ids, skip the addition. This
      // catches the bare-vs-suffixed duplicate-ingest case where the body
      // cites e.g. `(vol*-pdf)` and email_ids already has `(vol*-pdf-3)`
      // with identical content.
      let totalIdsAdded = 0;
      let totalIdsSkipped = 0;
      if (totalFixed > 0) {
        // Write the body fixes first so loadArray sees them
        fs.writeFileSync(STORIES_PATH, src);
        const reloaded = loadArray(STORIES_PATH, "STORIES");
        const reloadedBySlug = new Map(reloaded.map((s) => [s.slug, s]));

        for (const { slug } of allFixes) {
          const story = reloadedBySlug.get(slug);
          if (!story) continue;
          const cited = extractCitedIdsFromBody(story);
          const existing = new Set(story.email_ids || []);
          const toAdd = [...cited].filter((id) => !existing.has(id) && getEmail(id));
          for (const id of toAdd) {
            // Duplicate check: is there already an email_ids entry with the
            // same doc_id and same normalised body content? If so, skip.
            const newRow = getEmail(id);
            const dupOf = (story.email_ids || []).find((existingId) => {
              const eRow = getEmail(existingId);
              return eRow
                && eRow.doc_id === newRow.doc_id
                && normalise(eRow.body || "") === normalise(newRow.body || "");
            });
            if (dupOf) {
              totalIdsSkipped++;
              console.log(`    \x1b[33mSKIPPED ${slug}: "${id}" is a content-duplicate of "${dupOf}" already in email_ids\x1b[0m`);
              continue;
            }
            const result = insertEmailId(src, slug, id);
            if (result.ok && !result.alreadyPresent) {
              src = result.src;
              totalIdsAdded++;
              console.log(`    \x1b[33mADDED to ${slug} email_ids: "${id}"\x1b[0m`);
            } else if (!result.ok) {
              console.log(`    \x1b[31mWARNING: could not add ${id} to ${slug} email_ids — ${result.reason}\x1b[0m`);
            }
          }
        }
        // Re-write src after the email_ids insertions
        if (totalIdsAdded > 0) {
          fs.writeFileSync(STORIES_PATH, src);
        }
        const summary = `Auto-fixed ${totalFixed} paragraph(s) in stories.js`
          + (totalIdsAdded > 0 ? `, added ${totalIdsAdded} email_ids entr${totalIdsAdded === 1 ? "y" : "ies"}` : "")
          + (totalIdsSkipped > 0 ? `, skipped ${totalIdsSkipped} duplicate${totalIdsSkipped === 1 ? "" : "s"}` : "");
        console.log(`\n\x1b[33m${summary}\x1b[0m`);
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
