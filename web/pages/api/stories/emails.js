import { getDb } from "../../../lib/db";

// GET /api/stories/emails?ids=id1,id2,id3
export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  const raw = req.query.ids || "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) return res.status(200).json([]);

  const db = getDb();
  const placeholders = ids.map(() => "?").join(",");
  const emails = db
    .prepare(
      `SELECT id, doc_id, sender, subject, sent_at, countries, epstein_is_sender
       FROM emails
       WHERE id IN (${placeholders})
       ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
    )
    .all(...ids);

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json(emails);
}
