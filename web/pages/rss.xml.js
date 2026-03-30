import { STORIES } from "../lib/stories";

const BASE = "https://www.epsteinafrica.com";

function escapeXml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generateRss() {
  const items = STORIES.map((story) => {
    const link = `${BASE}/stories/${story.slug}`;
    return `    <item>
      <title>${escapeXml(story.title)}</title>
      <link>${link}</link>
      <guid>${link}</guid>
      <description>${escapeXml(story.summary)}</description>
      <category>${story.countries.join(", ")}</category>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Epstein Africa</title>
    <link>${BASE}</link>
    <description>Investigative narratives drawn from Jeffrey Epstein's Africa-related email archive, sourced from DOJ Epstein Files Transparency Act releases.</description>
    <language>en</language>
    <atom:link href="${BASE}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.write(generateRss());
  res.end();
  return { props: {} };
}

export default function Rss() {
  return null;
}
