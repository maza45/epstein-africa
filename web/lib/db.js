import Database from "better-sqlite3";
import path from "path";
import { readFileSync } from "fs";

// Force Next.js file tracing to include the DB
const DB_PATH = path.join(process.cwd(), "data", "epstein_africa.db");
try { readFileSync(DB_PATH, { flag: "r" }); } catch {}

let _db;

export function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH, { readonly: true });
  }
  return _db;
}
