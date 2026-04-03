import { getDb } from "./db";
import { STORIES } from "./stories";
import { PEOPLE } from "./people";

export function buildMapData() {
  // 1. Email counts per country from production DB
  const db = getDb();
  const rows = db.prepare("SELECT countries FROM emails WHERE countries IS NOT NULL AND countries != ''").all();
  const emailCounts = {};
  for (const row of rows) {
    for (const c of row.countries.split(", ")) {
      const name = c.trim();
      if (name && name !== "Africa") {
        emailCounts[name] = (emailCounts[name] || 0) + 1;
      }
    }
  }

  // 2. Stories per country
  const storiesByCountry = {};
  for (const s of STORIES) {
    for (const c of s.countries) {
      if (!storiesByCountry[c]) storiesByCountry[c] = [];
      storiesByCountry[c].push({
        slug: s.slug,
        title: s.title,
        summary: s.summary,
        date_range: s.date_range,
      });
    }
  }

  // 3. People per country
  const peopleByCountry = {};
  for (const p of PEOPLE) {
    for (const c of p.countries) {
      if (!peopleByCountry[c]) peopleByCountry[c] = [];
      peopleByCountry[c].push({
        slug: p.slug,
        name: p.name,
        title: p.title,
      });
    }
  }

  // 4. Top senders per country (top 5)
  const senderRows = db
    .prepare(
      "SELECT countries, sender FROM emails WHERE countries IS NOT NULL AND countries != '' AND sender IS NOT NULL"
    )
    .all();
  const senderCounts = {};
  for (const row of senderRows) {
    for (const c of row.countries.split(", ")) {
      const name = c.trim();
      if (!name || name === "Africa") continue;
      if (!senderCounts[name]) senderCounts[name] = {};
      const s = row.sender.replace(/<[^>]+>/g, "").trim();
      if (s) senderCounts[name][s] = (senderCounts[name][s] || 0) + 1;
    }
  }
  const topSenders = {};
  for (const [country, senders] of Object.entries(senderCounts)) {
    topSenders[country] = Object.entries(senders)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }

  // 5. Build per-country data object
  const countryData = {};
  const allNames = new Set([
    ...Object.keys(emailCounts),
    ...Object.keys(storiesByCountry),
    ...Object.keys(peopleByCountry),
  ]);

  for (const name of allNames) {
    countryData[name] = {
      emailCount: emailCounts[name] || 0,
      storyCount: (storiesByCountry[name] || []).length,
      stories: storiesByCountry[name] || [],
      peopleCount: (peopleByCountry[name] || []).length,
      people: peopleByCountry[name] || [],
      topSenders: topSenders[name] || [],
    };
  }

  return { countryData };
}
