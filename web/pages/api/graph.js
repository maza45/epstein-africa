import { getDb } from "../../lib/db";
import { PEOPLE } from "../../lib/people";

// Build a flat lookup: searchTerm (lowercase) → { slug, label }
const TERM_TO_PERSON = new Map();
for (const p of PEOPLE) {
  for (const term of p.searchTerms) {
    TERM_TO_PERSON.set(term.toLowerCase(), { slug: p.slug, label: p.name });
  }
}

// Resolve a raw sender string to a canonical { id, label, slug|null }
// Returns null if sender is an email-only address not in PEOPLE
function resolveSender(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  // Check against all PEOPLE search terms
  for (const [term, person] of TERM_TO_PERSON) {
    if (lower.includes(term)) {
      return { id: person.slug, label: person.label, slug: person.slug };
    }
  }

  // Strip email portion: "Name <email@x.com>" → "Name"
  const nameOnly = raw.match(/^([^<]+)</)?.[1]?.trim() ?? null;

  // Reject bare email addresses with no name
  if (!nameOnly || raw.trim().startsWith("<") || !raw.includes(" ")) {
    return null;
  }

  const id = nameOnly.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { id, label: nameOnly, slug: null };
}

// Normalise a country string to a node id
function countryId(c) {
  return "country-" + c.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const db = getDb();

  // ── 1. Fetch all non-promotional emails ─────────────────────────────────
  const rows = db
    .prepare(
      `SELECT sender, countries, all_participants
       FROM emails
       WHERE is_promotional = 0`
    )
    .all();

  // ── 2. Build person nodes ────────────────────────────────────────────────
  // personMap: id → { id, label, type, slug, emailCount }
  const personMap = new Map();

  // Seed with all PEOPLE entries so profiles without emails still appear
  for (const p of PEOPLE) {
    personMap.set(p.slug, {
      id: p.slug,
      label: p.name,
      type: "person",
      slug: p.slug,
      emailCount: 0,
    });
  }

  // Add senders from DB (min 2 emails to reduce noise)
  const senderCounts = new Map();
  const JUNK = new Set(["[redacted]", "unknown", "<blocked>", "blocked", ""]);

  for (const row of rows) {
    if (!row.sender) continue;
    const lower = row.sender.toLowerCase().trim();
    if (JUNK.has(lower) || lower.startsWith("[redacted]")) continue;
    senderCounts.set(row.sender, (senderCounts.get(row.sender) ?? 0) + 1);
  }

  for (const [sender, count] of senderCounts) {
    if (count < 2) continue;
    const resolved = resolveSender(sender);
    if (!resolved) continue;

    if (personMap.has(resolved.id)) {
      personMap.get(resolved.id).emailCount += count;
    } else {
      personMap.set(resolved.id, {
        id: resolved.id,
        label: resolved.label,
        type: "person",
        slug: resolved.slug,
        emailCount: count,
      });
    }
  }

  // ── 3. Build country nodes ───────────────────────────────────────────────
  const countrySet = new Set();
  for (const row of rows) {
    if (!row.countries) continue;
    for (const c of row.countries.split(", ")) {
      if (c.trim()) countrySet.add(c.trim());
    }
  }

  const countryNodes = [...countrySet].map((c) => ({
    id: countryId(c),
    label: c,
    type: "country",
    slug: null,
    emailCount: 0,
  }));

  // ── 4. Build edges ───────────────────────────────────────────────────────
  // edgeKey → weight
  const edgeMap = new Map();

  function addEdge(a, b, edgeType) {
    const key = a < b ? `${a}||${b}||${edgeType}` : `${b}||${a}||${edgeType}`;
    edgeMap.set(key, (edgeMap.get(key) ?? 0) + 1);
  }

  // Build a fast participants lookup: searchTerm → personId
  // (reuse TERM_TO_PERSON for PEOPLE; for non-PEOPLE nodes use first two words)
  const participantTerms = new Map(); // term → personId
  for (const [term, person] of TERM_TO_PERSON) {
    participantTerms.set(term, person.slug);
  }
  for (const [id, node] of personMap) {
    if (node.slug) continue; // already covered by PEOPLE terms
    // Use first two words of label as a detection fragment
    const fragment = node.label.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
    if (fragment.length >= 4 && !participantTerms.has(fragment)) {
      participantTerms.set(fragment, id);
    }
  }

  for (const row of rows) {
    const senderResolved = row.sender ? resolveSender(row.sender) : null;
    const senderId = senderResolved?.id ?? null;

    // Person → Country edges
    if (senderId && personMap.has(senderId) && row.countries) {
      for (const c of row.countries.split(", ")) {
        if (c.trim()) addEdge(senderId, countryId(c.trim()), "person-country");
      }
    }

    // Person → Person edges via all_participants co-occurrence
    if (row.all_participants) {
      const participantText = row.all_participants.toLowerCase();
      const present = new Set();
      if (senderId && personMap.has(senderId)) present.add(senderId);

      for (const [term, personId] of participantTerms) {
        if (participantText.includes(term) && personMap.has(personId)) {
          present.add(personId);
        }
      }

      const participants = [...present];
      for (let i = 0; i < participants.length; i++) {
        for (let j = i + 1; j < participants.length; j++) {
          addEdge(participants[i], participants[j], "person-person");
        }
      }
    }
  }

  // ── 5. Assemble response ─────────────────────────────────────────────────
  const edges = [...edgeMap.entries()].map(([key, weight]) => {
    const [source, target, type] = key.split("||");
    return { source, target, weight, type };
  });

  // For each country, collect the distinct person nodes it connects to
  const countryPersons = new Map(); // countryId → Set<personId>
  for (const e of edges.filter((e) => e.type === "person-country")) {
    const cId = e.source.startsWith("country-") ? e.source : e.target;
    const pId = e.source.startsWith("country-") ? e.target : e.source;
    if (!countryPersons.has(cId)) countryPersons.set(cId, new Set());
    countryPersons.get(cId).add(pId);
  }

  // Keep countries that: (1) are not the catch-all "Africa" tag,
  // (2) connect to at least 2 distinct person nodes
  const filteredCountryNodes = countryNodes.filter(
    (n) => n.label !== "Africa" && (countryPersons.get(n.id)?.size ?? 0) >= 2
  );

  // Drop edges that reference filtered-out country nodes
  const keptCountryIds = new Set(filteredCountryNodes.map((n) => n.id));
  const filteredEdges = edges.filter((e) => {
    if (e.type !== "person-country") return true;
    const cId = e.source.startsWith("country-") ? e.source : e.target;
    return keptCountryIds.has(cId);
  });

  const nodes = [...personMap.values(), ...filteredCountryNodes];

  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json({
    nodes,
    edges: filteredEdges,
    meta: {
      personCount: personMap.size,
      countryCount: filteredCountryNodes.length,
      edgeCount: filteredEdges.length,
    },
  });
}
