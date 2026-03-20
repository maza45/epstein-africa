export const STORIES = [
  {
    slug: "ivory-coast-surveillance",
    title: "How Epstein Brokered a Mass Surveillance Deal for Ivory Coast",
    summary:
      "Between 2011 and 2014, Epstein used his connections to President Ouattara's niece to help Israeli Defence Minister Ehud Barak sell a mass surveillance system to Ivory Coast.",
    countries: ["Ivory Coast"],
    date_range: "2011–2014",
    body: [],
    email_ids: [],
    news_links: [
      {
        title: "Did Epstein help Israel push for a security deal with Ivory Coast?",
        url: "https://www.aljazeera.com/news/2026/2/27/did-epstein-help-israel-push-for-a-security-deal-with-ivory-coast",
        source: "Al Jazeera",
      },
      {
        title: "Jeffrey Epstein Helped Israel Sell a Surveillance State to Côte d'Ivoire",
        url: "https://www.dropsitenews.com/p/jeffrey-epstein-israel-surveillance-state-cote-d-ivoire-ehud-barak-leaked-emails",
        source: "Drop Site News",
      },
    ],
  },
];

export function getStoryBySlug(slug) {
  return STORIES.find((s) => s.slug === slug) ?? null;
}
