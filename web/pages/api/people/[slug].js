import { getDb } from "../../../lib/db";
import { getPersonBySlug } from "../../../lib/people";

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { slug } = req.query;
  const person = getPersonBySlug(slug);
  if (!person) {
    return res.status(404).json({ error: "Person not found" });
  }

  const db = getDb();

  // Build OR conditions for all search terms
  const termConditions = person.searchTerms
    .map(() => "(LOWER(sender) LIKE ? OR LOWER(all_participants) LIKE ?)")
    .join(" OR ");

  const params = person.searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);

  const emails = db
    .prepare(
      `SELECT id, sender, subject, sent_at, countries, epstein_is_sender
       FROM emails
       WHERE is_promotional = 0 AND (${termConditions})
       ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
    )
    .all(...params);

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ person, emails, total: emails.length });
}
