#!/usr/bin/env node
/**
 * country-leads.js — find unexplored email clusters for a country.
 *
 * Usage:
 *   node scripts/country-leads.js Morocco
 *   node scripts/country-leads.js "South Africa"
 *   node scripts/country-leads.js --list          # show all countries with counts
 *
 * Algorithm:
 *   1. Pull all emails tagged to the country
 *   2. Subtract emails already cited in published stories
 *   3. Build a participant graph (shared-thread detection)
 *   4. Find connected components
 *   5. Output clusters with email samples and cross-references
 */

const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "..", "web", "node_modules", "better-sqlite3"));

const DB_PATH = path.join(__dirname, "..", "web", "data", "epstein_africa.db");
const STORIES_PATH = path.join(__dirname, "..", "web", "lib", "stories.js");

// ---------------------------------------------------------------------------
// Load published email IDs from stories.js
// ---------------------------------------------------------------------------

function loadPublishedIds() {
  const src = fs.readFileSync(STORIES_PATH, "utf8");
  const ids = new Set();
  const re = /"([A-Za-z0-9_\-\.]+)"/g;
  // Find all email_ids arrays
  let inArray = false;
  for (const line of src.split("\n")) {
    if (line.includes("email_ids:")) inArray = true;
    if (inArray) {
      let m;
      while ((m = re.exec(line)) !== null) {
        ids.add(m[1]);
      }
      if (line.includes("],")) inArray = false;
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Participant graph — union-find for connected components
// ---------------------------------------------------------------------------

class UnionFind {
  constructor() {
    this.parent = {};
    this.rank = {};
  }
  find(x) {
    if (!(x in this.parent)) {
      this.parent[x] = x;
      this.rank[x] = 0;
    }
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else { this.parent[rb] = ra; this.rank[ra]++; }
  }
}

// ---------------------------------------------------------------------------
// Normalise participant names
// ---------------------------------------------------------------------------

// Hub names to exclude from graph edges (they connect everyone to everyone)
const HUB_NAMES = new Set([
  "jeffrey epstein", "jeffrey e", "jeffrey e.", "jeffrey", "j", "je",
  "jeevacation", "jeeproject", "jeff epstein", "jeff", "epstein",
  "lesley groff", "lesley", "groff",  // assistant, on every thread
]);

function parseParticipants(allPart, sender) {
  const names = new Set();
  if (sender) {
    const s = sender.replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (s && s.length > 2 && !s.includes("@") && !HUB_NAMES.has(s)) names.add(s);
    else if (s.includes("@")) {
      const local = s.split("@")[0].replace(/[^a-z ]/g, "").trim();
      if (local.length > 2 && !HUB_NAMES.has(local)) names.add(local);
    }
  }
  if (allPart) {
    // Extract names from the all_participants field
    const cleaned = allPart
      .replace(/<[^>]+>/g, " ")
      .replace(/\[|\]|"|'/g, " ")
      .replace(/,/g, " ")
      .toLowerCase();
    for (const token of cleaned.split(/\s{2,}/)) {
      const t = token.trim().replace(/[^a-z ]/g, "").trim();
      if (t.length > 3 && !["nan", "none", "unknown", "redacted", "blacked out", "blackened out"].includes(t) && !HUB_NAMES.has(t)) {
        names.add(t);
      }
    }
  }
  return [...names];
}

// ---------------------------------------------------------------------------
// Broadcast detection — don't create edges for mass emails
// ---------------------------------------------------------------------------

function isBroadcast(email, participantCount) {
  if (participantCount < 4) return false;
  const body = email.body || "";
  // Short emails with many recipients are likely forwards/intros — keep them
  if (body.length < 500) return false;
  // Long emails with many recipients and no reply indicators = broadcast
  const hasReply = /^>|\bOn .* wrote:|\bFrom:.*\nTo:.*\nSent:/im.test(body);
  if (!hasReply && body.length > 1000) return true;
  // Known newsletter patterns
  const lowerBody = body.toLowerCase();
  if (lowerBody.startsWith("dear friend") || lowerBody.startsWith("dear friends")) return true;
  if (/article \d\.|weekend reading|flipboard/i.test(body.slice(0, 200))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  const db = new Database(DB_PATH, { readonly: true });

  if (args.includes("--list")) {
    const rows = db.prepare(`
      SELECT countries, COUNT(*) as cnt FROM emails
      WHERE countries IS NOT NULL AND countries != ''
      GROUP BY countries ORDER BY cnt DESC
    `).all();
    // Flatten and count per individual country
    const counts = {};
    for (const { countries, cnt } of rows) {
      for (const c of countries.split(",")) {
        const cc = c.trim();
        if (cc) counts[cc] = (counts[cc] || 0) + cnt;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    console.log("Country email counts:");
    for (const [c, n] of sorted) {
      console.log(`  ${c}: ${n}`);
    }
    process.exit(0);
  }

  const country = args.join(" ");
  if (!country) {
    console.error("Usage: node scripts/country-leads.js <Country>");
    console.error("       node scripts/country-leads.js --list");
    process.exit(1);
  }

  // 1. Pull all emails for this country
  const allEmails = db.prepare(
    "SELECT id, doc_id, sender, sent_at, all_participants, body FROM emails WHERE countries LIKE ?"
  ).all(`%${country}%`);

  console.log(`\n${country}: ${allEmails.length} total emails`);

  // 2. Subtract published
  const published = loadPublishedIds();
  const unexplored = allEmails.filter((e) => !published.has(e.id));
  const covered = allEmails.length - unexplored.length;
  console.log(`  ${covered} covered by stories, ${unexplored.length} unexplored\n`);

  if (unexplored.length === 0) {
    console.log("Nothing unexplored.");
    process.exit(0);
  }

  // 3. Build participant graph
  const uf = new UnionFind();
  const emailCluster = {}; // email.id → cluster representative

  let broadcastCount = 0;
  for (const email of unexplored) {
    const participants = parseParticipants(email.all_participants, email.sender);
    if (participants.length === 0) {
      // Isolated email — use its own id as participant
      uf.find(`__email_${email.id}`);
      emailCluster[email.id] = `__email_${email.id}`;
      continue;
    }

    // Broadcast detection: don't union recipients of mass emails
    if (isBroadcast(email, participants.length)) {
      // Only connect the sender to the email, don't connect recipients to each other
      uf.find(participants[0]); // ensure sender exists in graph
      emailCluster[email.id] = participants[0];
      broadcastCount++;
      continue;
    }

    // Conversation: union all participants
    for (let i = 1; i < participants.length; i++) {
      uf.union(participants[0], participants[i]);
    }
    emailCluster[email.id] = participants[0];
  }
  console.log(`  (${broadcastCount} broadcasts detected, edges suppressed)\n`);

  // 4. Group emails by connected component
  const clusters = {}; // root → [emails]
  for (const email of unexplored) {
    const key = emailCluster[email.id];
    const root = uf.find(key);
    if (!clusters[root]) clusters[root] = [];
    clusters[root].push(email);
  }

  // 5. Sort clusters by size and output
  const sorted = Object.entries(clusters)
    .map(([root, emails]) => {
      // Collect all unique participant names in this cluster
      const names = new Set();
      for (const e of emails) {
        for (const n of parseParticipants(e.all_participants, e.sender)) {
          names.add(n);
        }
      }
      return { root, emails, names: [...names].sort() };
    })
    .sort((a, b) => b.emails.length - a.emails.length);

  console.log(`${sorted.length} clusters found:\n`);

  for (let i = 0; i < Math.min(sorted.length, 20); i++) {
    const { emails, names } = sorted[i];
    console.log(`--- Cluster ${i + 1}: ${emails.length} emails ---`);
    console.log(`Participants: ${names.slice(0, 10).join(", ")}${names.length > 10 ? ` (+${names.length - 10} more)` : ""}`);

    // Date range
    const dates = emails.map((e) => e.sent_at).filter(Boolean).sort();
    if (dates.length > 0) {
      console.log(`Date range: ${dates[0].slice(0, 10)} to ${dates[dates.length - 1].slice(0, 10)}`);
    }

    // Show 3 sample emails
    const samples = emails.slice(0, 3);
    for (const s of samples) {
      const body = (s.body || "").replace(/\n/g, " ").slice(0, 120);
      console.log(`  ${s.id} | ${(s.sender || "").slice(0, 25)} | ${(s.sent_at || "").slice(0, 10)} | ${body}`);
    }

    // Cross-reference: check if any cluster participant appears in another cluster's emails
    const crossRefs = [];
    for (let j = 0; j < sorted.length; j++) {
      if (j === i) continue;
      const otherNames = sorted[j].names;
      const overlap = names.filter((n) => otherNames.includes(n));
      if (overlap.length > 0) {
        crossRefs.push({ cluster: j + 1, shared: overlap.slice(0, 3) });
      }
    }
    if (crossRefs.length > 0) {
      console.log(`  Cross-refs: ${crossRefs.map((x) => `Cluster ${x.cluster} (${x.shared.join(", ")})`).join("; ")}`);
    }

    console.log();
  }

  if (sorted.length > 20) {
    console.log(`... and ${sorted.length - 20} smaller clusters (1-2 emails each)`);
  }
}

main();
