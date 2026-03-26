import { STORIES } from "../lib/stories";
import { PEOPLE } from "../lib/people";

const BASE = "https://epstein-africa.vercel.app";

function generateSitemap() {
  const staticPages = ["", "/stories", "/people", "/graph", "/about"];
  const storyPages = STORIES.map((s) => `/stories/${s.slug}`);
  const personPages = PEOPLE.map((p) => `/people/${p.slug}`);

  const urls = [...staticPages, ...storyPages, ...personPages];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((path) => `  <url><loc>${BASE}${path}</loc></url>`).join("\n")}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader("Content-Type", "text/xml");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.write(generateSitemap());
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
