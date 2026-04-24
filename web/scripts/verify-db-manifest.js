#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const root = path.join(__dirname, "..");
const dbPath = path.join(root, "data", "epstein_africa.db");
const manifestPath = path.join(root, "data", "db-manifest.json");
const storiesPath = path.join(root, "lib", "stories.js");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function countLongreads() {
  const src = fs.readFileSync(storiesPath, "utf8");
  const matches = src.match(/\bkind:\s*"longread"/g);
  return matches ? matches.length : 0;
}

function buildManifest() {
  const db = new Database(dbPath, { readonly: true });
  const counts = db
    .prepare(
      "SELECT COUNT(*) AS rows, SUM(CASE WHEN COALESCE(is_promotional, 0) = 0 THEN 1 ELSE 0 END) AS nonPromotionalRows FROM emails"
    )
    .get();
  db.close();
  return {
    rows: counts.rows,
    nonPromotionalRows: counts.nonPromotionalRows,
    longreadCount: countLongreads(),
    sha256: sha256(dbPath),
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const current = buildManifest();

if (process.argv.includes("--write")) {
  fs.writeFileSync(manifestPath, stableJson(current));
  console.log(`Wrote ${path.relative(root, manifestPath)}.`);
  process.exit(0);
}

if (!fs.existsSync(manifestPath)) {
  console.error("Missing data/db-manifest.json. Run `npm run update:db-manifest`.");
  process.exit(1);
}

const expected = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const mismatches = [];
for (const key of ["rows", "nonPromotionalRows", "longreadCount", "sha256"]) {
  if (expected[key] !== current[key]) {
    mismatches.push(`${key}: manifest=${expected[key]} actual=${current[key]}`);
  }
}

if (mismatches.length > 0) {
  console.error("DB manifest drift:");
  for (const mismatch of mismatches) {
    console.error(`  ${mismatch}`);
  }
  console.error("Run `npm run update:db-manifest` after intentional DB or stories changes.");
  process.exit(1);
}

console.log(
  `DB manifest verified: ${current.rows} rows, ${current.nonPromotionalRows} non-promotional rows, ${current.longreadCount} longreads.`
);
