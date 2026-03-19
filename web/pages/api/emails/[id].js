import { getDb } from "../../../lib/db";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getDb();
  const { id } = req.query;

  const email = db
    .prepare(
      `SELECT id, doc_id, sender, subject, to_recipients, sent_at,
              countries, release_batch, epstein_is_sender, all_participants
       FROM emails
       WHERE id = ?`
    )
    .get(id);

  if (!email) {
    return res.status(404).json({ error: "Not found" });
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json(email);
}
