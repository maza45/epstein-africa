export const PEOPLE = [
  {
    slug: "sultan-bin-sulayem",
    name: "Sultan Bin Sulayem",
    title: "Chairman, DP World / Port of Dubai",
    countries: ["Nigeria", "Senegal", "Somalia", "Kenya", "Ivory Coast", "Zimbabwe", "Ethiopia", "Africa"],
    bio: "Sultan Ahmed Bin Sulayem is the Group Chairman and CEO of DP World, one of the world's largest port operators, headquartered in Dubai. He appears in 76 emails in Epstein's archive — the highest volume of any Africa-connected correspondent. Threads involve an Africa trip with Epstein, Nigeria port discussions, Senegal political coverage, Somaliland recognition documents, and references to African business figures including Aliko Dangote. His correspondence spans 2010–2018.",
    searchTerms: ["sultan", "sultan bin sulayem"],
  },
  {
    slug: "jeffrey-epstein",
    name: "Jeffrey Epstein",
    title: "Financier (subject of investigation)",
    countries: ["Kenya", "Nigeria", "South Africa", "Senegal", "Somalia", "Zimbabwe", "Africa"],
    bio: "Jeffrey Epstein is the central subject of this database. His Africa-related correspondence includes visa arrangements for Kenya trips (2009), discussions of African business ventures, and forwarded materials on African political affairs. He was arrested in 2019 and died in federal custody the same year.",
    searchTerms: ["jeffrey epstein", "j. epstein", "jeeproject"],
  },
  {
    slug: "peggy-siegal",
    name: "Peggy Siegal",
    title: "New York publicist",
    countries: ["Africa"],
    bio: "Peggy Siegal is a prominent New York entertainment publicist who appears in Epstein's Africa-related email archive. She was previously reported as a social contact of Epstein's.",
    searchTerms: ["peggy siegal", "peggy"],
  },
  {
    slug: "jide-zeitlin",
    name: "Jide Zeitlin",
    title: "Former CEO, Tapestry Inc.",
    countries: ["Nigeria", "Africa"],
    bio: "Adebayo 'Jide' Zeitlin is a Nigerian-American business executive who served as CEO of Tapestry Inc. (parent company of Coach). He appears in Epstein's Africa-related correspondence in the context of Nigerian business connections.",
    searchTerms: ["jide zeitlin", "jide", "zeitlin"],
  },
  {
    slug: "lesley-groff",
    name: "Lesley Groff",
    title: "Executive assistant to Jeffrey Epstein",
    countries: ["Kenya", "Africa"],
    bio: "Lesley Groff served as a senior executive assistant to Jeffrey Epstein. She handled logistics including travel arrangements. She appears in Africa-related emails coordinating Epstein's Kenya travel.",
    searchTerms: ["lesley groff", "lesley"],
  },
  {
    slug: "miasha",
    name: "Miasha",
    title: "Epstein contact (identity unconfirmed)",
    countries: ["Africa"],
    bio: "An individual identified only as 'Miasha' appears in Epstein's Africa-related email archive. Full identity has not been confirmed from available documents.",
    searchTerms: ["miasha"],
  },
];

export function getPersonBySlug(slug) {
  return PEOPLE.find((p) => p.slug === slug) ?? null;
}
