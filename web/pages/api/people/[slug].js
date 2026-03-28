import { getDb } from "../../../lib/db";
import { getPersonBySlug } from "../../../lib/people";

const LIMIT_MAX = 100;
const LIMIT_DEFAULT = 25;

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

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(LIMIT_MAX, parseInt(req.query.limit) || LIMIT_DEFAULT);
  const offset = (page - 1) * limit;

  // Build OR conditions for all search terms
  const termConditions = person.searchTerms
    .map(() => "(LOWER(sender) LIKE ? OR LOWER(all_participants) LIKE ?)")
    .join(" OR ");

  const params = person.searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM emails
       WHERE COALESCE(is_promotional, 0) = 0 AND (${termConditions})`
    )
    .get(...params).n;

  const emails = db
    .prepare(
      `SELECT id, sender, subject, sent_at, countries, epstein_is_sender
       FROM emails
       WHERE COALESCE(is_promotional, 0) = 0 AND (${termConditions})
       ORDER BY COALESCE(sent_at, '9999-99-99') ASC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  // Body mentions (same logic as getStaticProps)
  let mentionEmails = [];
  let mentionTotal = 0;
  if (person.bodySearchTerms && person.bodySearchTerms.length > 0) {
    const bodyTerms = person.bodySearchTerms;
    const personCountries = (person.countries || []).filter((c) => c !== "Africa");

    const bodyConditions = bodyTerms.map(() => "LOWER(body) LIKE ?").join(" OR ");
    const bodyParams = bodyTerms.map((t) => `%${t.toLowerCase()}%`);
    const senderExclude = termConditions;
    const senderExcludeParams = [...params];

    const candidateRows = db
      .prepare(
        `SELECT id, sender, subject, sent_at, countries, epstein_is_sender, body
         FROM emails
         WHERE COALESCE(is_promotional, 0) = 0
           AND (${bodyConditions})
           AND NOT (${senderExclude})
         ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
      )
      .all(...bodyParams, ...senderExcludeParams);

    const filtered = candidateRows.filter((row) => {
      const bodyLower = (row.body || "").toLowerCase();
      let nameCount = 0;
      for (const term of bodyTerms) {
        const re = new RegExp(term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = bodyLower.match(re);
        if (matches) nameCount += matches.length;
      }
      if (nameCount >= 2) return true;
      if (personCountries.length > 0 && row.countries) {
        const emailCountries = row.countries.split(",").map((c) => c.trim());
        if (personCountries.some((pc) => emailCountries.includes(pc))) return true;
      }
      return false;
    });

    mentionTotal = filtered.length;
    mentionEmails = filtered.slice(0, limit).map(({ body, ...rest }) => rest);
  }

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({ person, emails, total, page, limit, mentionEmails, mentionTotal });
}
