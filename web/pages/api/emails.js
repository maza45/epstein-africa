import { getDb } from "../../lib/db";

const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 25;

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getDb();

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(LIMIT_MAX, parseInt(req.query.limit) || LIMIT_DEFAULT);
  const offset = (page - 1) * limit;
  const q = (req.query.q || "").trim();
  const country = (req.query.country || "").trim();

  let total, emails;

  if (q) {
    // FTS5 full-text search — covers sender, subject, and body
    // Strip FTS5 operators and wrap in quotes for literal phrase search
    const sanitized = q.replace(/[*"]/g, "").replace(/\b(AND|OR|NOT|NEAR)\b/gi, "");
    if (!sanitized.trim()) {
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.status(200).json({ emails: [], total: 0, page, limit });
    }
    const matchQuery = '"' + sanitized.replace(/"/g, '""') + '"';
    const ftsConditions = ["COALESCE(e.is_promotional, 0) = 0"];
    const ftsParams = [matchQuery];

    if (country) {
      ftsConditions.push("e.countries LIKE ?");
      ftsParams.push(`%${country}%`);
    }

    const ftsWhere = ftsConditions.join(" AND ");

    total = db
      .prepare(
        `SELECT COUNT(*) AS n
         FROM emails e
         JOIN emails_fts fts ON e.rowid = fts.rowid
         WHERE emails_fts MATCH ?
         AND ${ftsWhere}`
      )
      .get(...ftsParams).n;

    emails = db
      .prepare(
        `SELECT e.id, e.sender, e.subject, e.sent_at, e.countries, e.epstein_is_sender
         FROM emails e
         JOIN emails_fts fts ON e.rowid = fts.rowid
         WHERE emails_fts MATCH ?
         AND ${ftsWhere}
         ORDER BY COALESCE(e.sent_at, '9999-99-99') ASC
         LIMIT ? OFFSET ?`
      )
      .all(...ftsParams, limit, offset);
  } else {
    // No search query — plain filter on country only
    const conditions = ["COALESCE(is_promotional, 0) = 0"];
    const params = [];

    if (country) {
      conditions.push("countries LIKE ?");
      params.push(`%${country}%`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    total = db
      .prepare(`SELECT COUNT(*) AS n FROM emails ${where}`)
      .get(...params).n;

    emails = db
      .prepare(
        `SELECT id, sender, subject, sent_at, countries, epstein_is_sender
         FROM emails
         ${where}
         ORDER BY COALESCE(sent_at, '9999-99-99') ASC
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, offset);
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ emails, total, page, limit });
}
