import { STORIES } from "../lib/stories";
import { PEOPLE } from "../lib/people";
import { getDb } from "../lib/db";

const BASE = "https://epstein-africa.vercel.app";

function generateSitemap(emailIds) {
  const now = new Date().toISOString().split("T")[0];

  const staticPages = [
    { path: "", priority: "1.0" },
    { path: "/stories", priority: "0.9" },
    { path: "/people", priority: "0.9" },
    { path: "/graph", priority: "0.7" },
    { path: "/about", priority: "0.6" },
  ];

  const storyPages = STORIES.map((s) => ({
    path: `/stories/${s.slug}`,
    priority: "0.8",
  }));

  const personPages = PEOPLE.map((p) => ({
    path: `/people/${p.slug}`,
    priority: "0.8",
  }));

  const emailPages = emailIds.map((id) => ({
    path: `/emails/${encodeURIComponent(id)}`,
    priority: "0.5",
  }));

  const allPages = [...staticPages, ...storyPages, ...personPages, ...emailPages];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) =>
      `  <url>
    <loc>${BASE}${p.path}</loc>
    <lastmod>${now}</lastmod>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  const db = getDb();
  const rows = db
    .prepare("SELECT id FROM emails WHERE COALESCE(is_promotional, 0) = 0")
    .all();
  const emailIds = rows.map((r) => r.id);

  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.write(generateSitemap(emailIds));
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
