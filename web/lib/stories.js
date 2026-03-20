export const STORIES = [
  {
    slug: "ivory-coast-surveillance",
    title: "How Epstein Brokered a Mass Surveillance Deal for Ivory Coast",
    summary:
      "Between 2011 and 2014, Epstein used his connections to President Ouattara's niece to help Israeli Defence Minister Ehud Barak sell a mass surveillance system to Ivory Coast.",
    countries: ["Ivory Coast"],
    date_range: "2011–2014",
    body: [
      "In December 2010, Ivory Coast was mid-civil war. Laurent Gbagbo had refused to concede after losing the election to Alassane Ouattara, and fighting was spreading across Abidjan. While that was unfolding, Karim Wade — son of Senegal's president and a regular Epstein correspondent — emailed Epstein to explain why he'd gone quiet: \"I am on the crisis on Ivory Coast.\" Epstein wrote back: \"I'm with Prince Andrew at my house in New York... we are talking about the opportunities in Africa.\" Prince Andrew was in the room.",
      "Ouattara won the war in April 2011, with UN and French forces arresting Gbagbo. Epstein was already booking his Africa trip. Flight records in the archive show the routing: Newark → Azores → Dakar → Bamako → Niamey → Benin City → Libreville, continuing toward Abidjan. That same month Nina Keita — Ouattara's niece, a former model who had been on Epstein's jet since at least 2002 — wrote asking for \"more details concerning your trip to Abidjan.\"",
      "In November 2011, Epstein's team began preparing for the trip in earnest. Lesley Groff sent CDC vaccination guidance for Ivory Coast. An assistant wrote: \"I did. Do you think it's what he wants? I was a bit scared of him today.\" In January 2012, Epstein landed in Abidjan. A forwarded email describes his schedule: \"He is scheduled with the president at 4pm then minister of economy and finance at 6:30pm. Dinner at 8:30 with minister of interior. Wednesday he meets with the director of bureau of commerce and industry at 10, then CEO of the port at 12 with a tour of the port. Lunch with General Coulibaly around 2pm\" — Amadou Gon Coulibaly, who would later become Prime Minister.",
      "The meetings didn't stay in Abidjan. In June 2012, Ouattara flew to Jerusalem and met Ehud Barak — then Israel's Defence Minister — and Netanyahu. Epstein had been seeing Barak regularly for years. In September 2013 he sent Barak the personal email of Sidi Tiémoko Touré, Ouattara's chief of staff: \"chief of staff of outara, he arrives tomorw, try to coordianate.\" Keita had made the connection.",
      "A mass surveillance contract followed — Ivory Coast's phone and internet communications, built by former Israeli intelligence officials, formalised in 2014. Ouattara has since banned protests and imprisoned opponents. The emails don't establish a link between the surveillance system and those crackdowns. They do show how the deal got made.",
    ],
    email_ids: [
      "vol00009-efta00633187-pdf-1",
      "EFTA01805243-0",
      "EFTA01866037-0",
      "EFTA01993169-0",
      "EFTA01795507-0",
      "EFTA01740736-0",
      "EFTA01990469-0",
      "vol00009-efta00926086-pdf-2",
    ],
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
