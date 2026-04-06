#!/usr/bin/env node
/*
 * migrate_canonical_ids.js — one-shot DB migration to canonicalize email IDs.
 *
 * Promotes the 558 bare rows (id == doc_id) in epstein_africa.db to the
 * canonical `{doc_id}-{N}` form so the route can resolve every citation
 * via a single `SELECT WHERE id = ?` lookup with no fallbacks.
 *
 * Conservative collision policy:
 *   1. No -0 sibling exists  → UPDATE id = doc_id || '-0'
 *   2. -0 exists, normalised body equal → DELETE bare row
 *      (citations get re-pointed to the existing -0 in the stories.js pass)
 *   3. -0 exists, bodies differ → UPDATE id = doc_id || '-{next free N}'
 *
 * Hex-id rows (22 of them, id != doc_id and not doc_id-N) are left alone:
 *   they are already structurally addressable by their unique id.
 *
 * Usage:
 *   node scripts/migrate_canonical_ids.js              # dry-run
 *   node scripts/migrate_canonical_ids.js --apply      # execute in transaction
 *   node scripts/migrate_canonical_ids.js --dump-map FILE # write {old: new} JSON
 */

const path = require("path");
const fs = require("fs");
const Database = require(path.join(__dirname, "..", "web", "node_modules", "better-sqlite3"));

const DB_PATH = path.join(__dirname, "..", "web", "data", "epstein_africa.db");

function normalise(s) {
  if (s == null) return "";
  return String(s).replace(/\s+/g, " ").trim().toLowerCase();
}

function nextFreeSuffix(db, docId, taken) {
  // Find the smallest N >= 0 such that doc_id-N is not in `taken` and not in DB.
  for (let n = 0; n < 100000; n++) {
    const candidate = `${docId}-${n}`;
    if (taken.has(candidate)) continue;
    const row = db.prepare("SELECT 1 FROM emails WHERE id = ?").get(candidate);
    if (!row) return candidate;
  }
  throw new Error(`could not find free suffix for ${docId}`);
}

function buildPlan(db) {
  // Bare rows: id == doc_id. We'll migrate every such row.
  const bare = db
    .prepare("SELECT id, doc_id, body FROM emails WHERE id = doc_id ORDER BY id")
    .all();

  const plan = []; // { oldId, newId, action: 'rename'|'delete', reason }
  // Track ids we have already assigned in this run so two bare rows targeting
  // the same doc_id don't collide with each other.
  const taken = new Set();

  for (const row of bare) {
    const docId = row.doc_id;
    const zeroId = `${docId}-0`;
    const zeroRow = db.prepare("SELECT id, body FROM emails WHERE id = ?").get(zeroId);

    if (!zeroRow && !taken.has(zeroId)) {
      // Case A: -0 free. Rename bare to -0.
      plan.push({
        oldId: row.id,
        newId: zeroId,
        action: "rename",
        reason: "no -0 collision",
      });
      taken.add(zeroId);
      continue;
    }

    // -0 exists (or has been claimed by an earlier bare row in this run).
    // Conservative content-equality check.
    const referenceBody = zeroRow ? zeroRow.body : null;
    const bareNorm = normalise(row.body);
    const refNorm = normalise(referenceBody);

    if (referenceBody !== null && bareNorm === refNorm) {
      // Case B: byte-equal content. Delete bare row, citations point to -0.
      plan.push({
        oldId: row.id,
        newId: zeroId,
        action: "delete",
        reason: "content-equal to existing -0",
      });
      continue;
    }

    // Case C: bodies differ. Find next free suffix.
    const target = nextFreeSuffix(db, docId, taken);
    plan.push({
      oldId: row.id,
      newId: target,
      action: "rename",
      reason: "-0 exists with different content; renamed to next free -N",
    });
    taken.add(target);
  }

  return plan;
}

function summarise(plan) {
  const renames = plan.filter((p) => p.action === "rename");
  const deletes = plan.filter((p) => p.action === "delete");
  const noColl = renames.filter((p) => p.reason === "no -0 collision");
  const withColl = renames.filter((p) => p.reason !== "no -0 collision");
  console.log("---");
  console.log(`bare rows total:           ${plan.length}`);
  console.log(`  renamed (no collision):  ${noColl.length}`);
  console.log(`  renamed (next free -N):  ${withColl.length}`);
  console.log(`  deleted (content-dup):   ${deletes.length}`);
  console.log("---");
  if (deletes.length) {
    console.log("\nfirst 10 deletes (content-equal to existing -0):");
    for (const p of deletes.slice(0, 10)) {
      console.log(`  ${p.oldId}  →  ${p.newId}`);
    }
  }
  if (withColl.length) {
    console.log("\nfirst 10 collision renames (different content, next free -N):");
    for (const p of withColl.slice(0, 10)) {
      console.log(`  ${p.oldId}  →  ${p.newId}`);
    }
  }
  if (noColl.length) {
    console.log("\nfirst 5 simple renames:");
    for (const p of noColl.slice(0, 5)) {
      console.log(`  ${p.oldId}  →  ${p.newId}`);
    }
  }
}

function apply(db, plan) {
  const upd = db.prepare("UPDATE emails SET id = ? WHERE id = ?");
  const del = db.prepare("DELETE FROM emails WHERE id = ?");

  // Two-phase apply: first delete content-dups, then rename. The rename phase
  // must avoid colliding with rows still being processed: order renames so that
  // we never UPDATE to an id that another not-yet-processed row currently holds.
  // The simplest correct strategy: use a temporary unique prefix per row, then
  // a second pass to set the canonical id. But our `taken` set in buildPlan
  // already guarantees no plan-row's newId conflicts with another plan-row's
  // oldId, so we can apply renames directly in plan order — except that some
  // bare rows could be renamed to a target that another bare row currently
  // OWNS. Defensive: do a temp rename first, then final rename.

  const tx = db.transaction(() => {
    let dCount = 0;
    let rCount = 0;
    // Phase 1: delete duplicates.
    for (const p of plan) {
      if (p.action === "delete") {
        const r = del.run(p.oldId);
        if (r.changes !== 1) {
          throw new Error(`delete affected ${r.changes} rows for ${p.oldId}`);
        }
        dCount++;
      }
    }
    // Phase 2a: temp-rename every bare row about to be renamed, to break any
    // potential cycle with sibling rows the migration is going to write into.
    let tmpIdx = 0;
    const tmpMap = new Map(); // oldId → tmpId
    for (const p of plan) {
      if (p.action !== "rename") continue;
      const tmp = `__migrate_tmp_${tmpIdx++}__${p.oldId}`;
      const r = upd.run(tmp, p.oldId);
      if (r.changes !== 1) {
        throw new Error(`temp rename affected ${r.changes} rows for ${p.oldId}`);
      }
      tmpMap.set(p.oldId, tmp);
    }
    // Phase 2b: temp → final.
    for (const p of plan) {
      if (p.action !== "rename") continue;
      const tmp = tmpMap.get(p.oldId);
      const r = upd.run(p.newId, tmp);
      if (r.changes !== 1) {
        throw new Error(`final rename affected ${r.changes} rows for ${p.oldId} → ${p.newId}`);
      }
      rCount++;
    }
    return { dCount, rCount };
  });

  const { dCount, rCount } = tx();
  console.log(`\napplied: ${dCount} deletes, ${rCount} renames`);

  // Rebuild FTS5 so the renamed/deleted rows propagate.
  console.log("rebuilding FTS5...");
  db.prepare("INSERT INTO emails_fts(emails_fts) VALUES('rebuild')").run();
  console.log("FTS5 rebuilt.");
}

function main() {
  const args = process.argv.slice(2);
  const doApply = args.includes("--apply");
  const dumpFlag = args.indexOf("--dump-map");
  const dumpPath = dumpFlag >= 0 ? args[dumpFlag + 1] : null;

  const db = new Database(DB_PATH, { readonly: !doApply && !dumpPath });
  const plan = buildPlan(db);
  summarise(plan);

  // Sanity invariants:
  // 1. Every newId is unique within the plan.
  const newIds = plan.map((p) => p.newId);
  const dupNew = newIds.filter((id, i) => newIds.indexOf(id) !== i);
  if (dupNew.length) {
    console.error("\nDUPLICATE newIds in plan:", dupNew);
    process.exit(1);
  }
  // 2. Every newId follows the canonical form `{doc_id}-N`.
  for (const p of plan) {
    if (!/^.+-\d+$/.test(p.newId)) {
      console.error("non-canonical newId:", p);
      process.exit(1);
    }
  }
  // 3. No newId collides with an existing non-bare row that the plan does not also touch.
  const planOldIds = new Set(plan.map((p) => p.oldId));
  for (const p of plan) {
    if (planOldIds.has(p.newId)) continue; // we're moving that row too
    if (p.action === "delete") continue; // delete maps to an existing row, that's the point
    const exists = db.prepare("SELECT 1 FROM emails WHERE id = ?").get(p.newId);
    if (exists) {
      console.error("collision: newId already exists in DB and is not in plan:", p);
      process.exit(1);
    }
  }
  console.log("\nplan invariants: ok");

  if (dumpPath) {
    const map = {};
    for (const p of plan) map[p.oldId] = { newId: p.newId, action: p.action };
    fs.writeFileSync(dumpPath, JSON.stringify(map, null, 2) + "\n");
    console.log(`\nwrote ${plan.length} mapping entries to ${dumpPath}`);
  }

  if (doApply) {
    apply(db, plan);
    // Verify post-conditions.
    const remaining = db.prepare("SELECT COUNT(*) c FROM emails WHERE id = doc_id").get().c;
    console.log(`\npost-migration bare rows: ${remaining}`);
    if (remaining !== 0) {
      console.error("UNEXPECTED: bare rows remain after migration");
      process.exit(1);
    }
    const total = db.prepare("SELECT COUNT(*) c FROM emails").get().c;
    console.log(`total rows: ${total}`);
  } else {
    console.log("\n(dry-run; pass --apply to execute)");
  }
}

main();
