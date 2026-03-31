import Database from "better-sqlite3";
import path from "path";
import { existsSync } from "fs";

let _db;

export function getDb() {
  if (!_db) {
    // process.cwd() works at build time; __dirname works at Vercel runtime
    const cwdPath = path.join(process.cwd(), "data", "epstein_africa.db");
    const dirPath = path.resolve(__dirname, "../data/epstein_africa.db");
    const dbPath = existsSync(cwdPath) ? cwdPath : dirPath;
    _db = new Database(dbPath, { readonly: true });
  }
  return _db;
}
