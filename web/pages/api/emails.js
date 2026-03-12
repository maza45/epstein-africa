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

  const conditions = ["is_promotional = 0"];
  const params = [];

  if (q) {
    conditions.push(
      "(subject LIKE ? OR sender LIKE ? OR all_participants LIKE ?)"
    );
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  if (country) {
    conditions.push("countries LIKE ?");
    params.push(`%${country}%`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const total = db
    .prepare(`SELECT COUNT(*) AS n FROM emails ${where}`)
    .get(...params).n;

  const emails = db
    .prepare(
      `SELECT id, sender, subject, sent_at, countries, epstein_is_sender
       FROM emails
       ${where}
       ORDER BY sent_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ emails, total, page, limit });
}
