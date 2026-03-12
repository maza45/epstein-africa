import Database from "better-sqlite3";
import path from "path";

let _db;

export function getDb() {
  if (!_db) {
    const dbPath = path.join(process.cwd(), "data", "epstein_africa.db");
    _db = new Database(dbPath, { readonly: true });
  }
  return _db;
}
