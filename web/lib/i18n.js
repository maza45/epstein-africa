export const BASE = "https://www.epsteinafrica.com";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "fr"];

const STATIC_FRENCH_PAGES = {
  home: false,
  stories: true,
  people: true,
  about: false,
  map: true,
  graph: false,
};

export const NAV_LABELS = {
  en: {
    emails: "Emails",
    people: "Persons",
    stories: "Stories",
    graph: "Graph",
    map: "Map",
    about: "About",
  },
  fr: {
    emails: "Emails",
    people: "Personnes",
    stories: "Récits",
    graph: "Graphe",
    map: "Carte",
    about: "À propos",
  },
};

export const FOOTER_COPY = {
  en: {
    blurb: "Public interest journalism. Free, ad-free, open source.",
    rss: "RSS",
    exportCsv: "Download CSV",
  },
  fr: {
    blurb: "Journalisme d'intérêt public. Gratuit, sans publicité, open source.",
    rss: "RSS",
    exportCsv: "Télécharger le CSV",
  },
};

export const PEOPLE_COPY = {
  en: {
    indexTitle: "Key Persons — Epstein Africa",
    indexDescription: "Profiles of key persons documented in Epstein's Africa-related correspondence.",
    indexHeading: "Key Persons",
    indexSubtitle: "Individuals identified in Epstein\u2019s Africa-related correspondence. Profiles are based on documented email records only.",
    emailCount: "emails",
    back: "Back",
    loading: "Loading\u2026",
    loadFailed: "Failed to load.",
    emailsHeading: "Emails",
    mentionHeading: "Emails mentioning",
    mentionNote: "does not appear as a sender or recipient in these emails. They are referenced in the body text.",
    noEmails: "No emails found.",
    prevPage: "Prev",
    nextPage: "Next",
    pageOf: "Page",
    thDate: "Date",
    thSender: "Sender",
    thSubject: "Subject",
    thCountries: "Countries",
    ogSubtitle: "profiles from the email archive",
    noSubject: "(no subject)",
  },
  fr: {
    indexTitle: "Personnes cl\u00e9s — Epstein Africa",
    indexDescription: "Profils des personnes cl\u00e9s document\u00e9es dans la correspondance d'Epstein li\u00e9e \u00e0 l'Afrique.",
    indexHeading: "Personnes cl\u00e9s",
    indexSubtitle: "Personnes identifi\u00e9es dans la correspondance d'Epstein li\u00e9e \u00e0 l'Afrique. Les profils sont bas\u00e9s uniquement sur les documents email.",
    emailCount: "emails",
    back: "Retour",
    loading: "Chargement\u2026",
    loadFailed: "\u00c9chec du chargement.",
    emailsHeading: "Emails",
    mentionHeading: "Emails mentionnant",
    mentionNote: "n'appara\u00eet pas comme exp\u00e9diteur ou destinataire dans ces emails. Cette personne est r\u00e9f\u00e9renc\u00e9e dans le corps du texte.",
    noEmails: "Aucun email trouv\u00e9.",
    prevPage: "Pr\u00e9c.",
    nextPage: "Suiv.",
    pageOf: "Page",
    thDate: "Date",
    thSender: "Exp\u00e9diteur",
    thSubject: "Objet",
    thCountries: "Pays",
    ogSubtitle: "profils issus des archives email",
    noSubject: "(sans objet)",
  },
};

export const SHARE_COPY = {
  en: {
    groupLabel: "Share this page",
    label: "Share",
    x: "Share on X",
    bsky: "Share on Bluesky",
    reddit: "Share on Reddit",
    copy: "Copy link to clipboard",
    copied: "Copied",
    link: "Link",
  },
  fr: {
    groupLabel: "Partager cette page",
    label: "Partager",
    x: "Partager sur X",
    bsky: "Partager sur Bluesky",
    reddit: "Partager sur Reddit",
    copy: "Copier le lien",
    copied: "Copie",
    link: "Lien",
  },
};

export const STORY_COPY = {
  en: {
    indexTitle: "Stories — Epstein Africa",
    indexDescription: "Investigative stories sourced from Jeffrey Epstein's Africa-related correspondence.",
    indexHeading: "Stories",
    indexSubtitle: "Investigative stories built from documented email records and tied to specific source emails.",
    ogSubtitle: "investigative stories from the email archive",
    filterAll: "All countries",
    startHereHeading: "Start Here",
    startHereSubtitle: "Core stories that map the main channels of money, access, and intelligence.",
    storiesLabel: "Stories",
    allStories: "All stories",
    back: "Back",
    sourceEmails: "Source emails",
    externalCoverage: "External coverage",
    noSubject: "(no subject)",
    thDate: "Date",
    thSender: "Sender",
    thSubject: "Subject",
    thCountries: "Countries",
  },
  fr: {
    indexTitle: "Récits — Epstein Africa",
    indexDescription: "Récits d'enquête tirés de la correspondance d'Epstein liée à l'Afrique.",
    indexHeading: "Récits",
    indexSubtitle: "Récits d'enquête construits à partir d'emails documentés et rattachés à des pièces sources précises.",
    ogSubtitle: "récits d'enquête issus des archives email",
    filterAll: "Tous les pays",
    startHereHeading: "Commencer ici",
    startHereSubtitle: "Les récits de base qui dessinent les principaux circuits d'argent, d'accès et de renseignement.",
    storiesLabel: "Récits",
    allStories: "Tous les récits",
    back: "Retour",
    sourceEmails: "Emails sources",
    externalCoverage: "Couverture externe",
    noSubject: "(sans objet)",
    thDate: "Date",
    thSender: "Expéditeur",
    thSubject: "Objet",
    thCountries: "Pays",
  },
};

export const MAP_COPY = {
  en: {
    title: "Africa Map | Epstein Africa",
    description: "Interactive map of Jeffrey Epstein's documented connections across Africa.",
    heading: "Documented connections across {count} African countries. Click a country to explore.",
    closePanel: "Close panel",
    emails: "emails",
    stories: "stories",
    people: "people",
    storiesHeading: "Stories",
    peopleHeading: "People",
    topSenders: "Top senders",
    viewAll: "View all {country} emails",
  },
  fr: {
    title: "Carte de l'Afrique | Epstein Africa",
    description: "Carte interactive des connexions documentées de Jeffrey Epstein à travers l'Afrique.",
    heading: "Connexions documentées dans {count} pays africains. Cliquez sur un pays pour explorer.",
    closePanel: "Fermer le panneau",
    emails: "emails",
    stories: "récits",
    people: "personnes",
    storiesHeading: "Récits",
    peopleHeading: "Personnes",
    topSenders: "Principaux expéditeurs",
    viewAll: "Voir tous les emails pour {country}",
  },
};

const COUNTRY_LABELS = {
  "Africa": { en: "Africa", fr: "Afrique" },
  "Algeria": { en: "Algeria", fr: "Algérie" },
  "Angola": { en: "Angola", fr: "Angola" },
  "Benin": { en: "Benin", fr: "Bénin" },
  "Botswana": { en: "Botswana", fr: "Botswana" },
  "Burkina Faso": { en: "Burkina Faso", fr: "Burkina Faso" },
  "Burundi": { en: "Burundi", fr: "Burundi" },
  "Cameroon": { en: "Cameroon", fr: "Cameroun" },
  "Cape Verde": { en: "Cape Verde", fr: "Cap-Vert" },
  "Central African Republic": { en: "Central African Republic", fr: "République centrafricaine" },
  "Chad": { en: "Chad", fr: "Tchad" },
  "Comoros": { en: "Comoros", fr: "Comores" },
  "Congo": { en: "Congo", fr: "Congo" },
  "Democratic Republic of Congo": { en: "Democratic Republic of Congo", fr: "République démocratique du Congo" },
  "Djibouti": { en: "Djibouti", fr: "Djibouti" },
  "Egypt": { en: "Egypt", fr: "Égypte" },
  "Equatorial Guinea": { en: "Equatorial Guinea", fr: "Guinée équatoriale" },
  "Eritrea": { en: "Eritrea", fr: "Érythrée" },
  "Eswatini": { en: "Eswatini", fr: "Eswatini" },
  "Ethiopia": { en: "Ethiopia", fr: "Éthiopie" },
  "Gabon": { en: "Gabon", fr: "Gabon" },
  "Gambia": { en: "Gambia", fr: "Gambie" },
  "Ghana": { en: "Ghana", fr: "Ghana" },
  "Guinea": { en: "Guinea", fr: "Guinée" },
  "Guinea-Bissau": { en: "Guinea-Bissau", fr: "Guinée-Bissau" },
  "Ivory Coast": { en: "Ivory Coast", fr: "Côte d'Ivoire" },
  "Kenya": { en: "Kenya", fr: "Kenya" },
  "Lesotho": { en: "Lesotho", fr: "Lesotho" },
  "Liberia": { en: "Liberia", fr: "Liberia" },
  "Libya": { en: "Libya", fr: "Libye" },
  "Madagascar": { en: "Madagascar", fr: "Madagascar" },
  "Malawi": { en: "Malawi", fr: "Malawi" },
  "Mali": { en: "Mali", fr: "Mali" },
  "Mauritania": { en: "Mauritania", fr: "Mauritanie" },
  "Mauritius": { en: "Mauritius", fr: "Maurice" },
  "Morocco": { en: "Morocco", fr: "Maroc" },
  "Mozambique": { en: "Mozambique", fr: "Mozambique" },
  "Namibia": { en: "Namibia", fr: "Namibie" },
  "Niger": { en: "Niger", fr: "Niger" },
  "Nigeria": { en: "Nigeria", fr: "Nigeria" },
  "Rwanda": { en: "Rwanda", fr: "Rwanda" },
  "Sao Tome and Principe": { en: "Sao Tome and Principe", fr: "Sao Tomé-et-Principe" },
  "Senegal": { en: "Senegal", fr: "Sénégal" },
  "Seychelles": { en: "Seychelles", fr: "Seychelles" },
  "Sierra Leone": { en: "Sierra Leone", fr: "Sierra Leone" },
  "Somalia": { en: "Somalia", fr: "Somalie" },
  "Somaliland": { en: "Somaliland", fr: "Somaliland" },
  "South Africa": { en: "South Africa", fr: "Afrique du Sud" },
  "South Sudan": { en: "South Sudan", fr: "Soudan du Sud" },
  "Sudan": { en: "Sudan", fr: "Soudan" },
  "Tanzania": { en: "Tanzania", fr: "Tanzanie" },
  "Togo": { en: "Togo", fr: "Togo" },
  "Tunisia": { en: "Tunisia", fr: "Tunisie" },
  "Uganda": { en: "Uganda", fr: "Ouganda" },
  "Zambia": { en: "Zambia", fr: "Zambie" },
  "Zimbabwe": { en: "Zimbabwe", fr: "Zimbabwe" },
};

export function normalizeLocale(locale) {
  return SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE;
}

export function isFrenchLocale(locale) {
  return normalizeLocale(locale) === "fr";
}

export function getOgLocale(locale) {
  return isFrenchLocale(locale) ? "fr_FR" : "en_US";
}

export function stripLocalePrefix(path = "/") {
  if (!path) return "/";
  return path.replace(/^\/fr(?=\/|$)/, "") || "/";
}

export function getLocalizedPath(path = "/", locale = DEFAULT_LOCALE) {
  const normalizedPath = stripLocalePrefix(path);
  if (normalizeLocale(locale) === "fr") {
    return normalizedPath === "/" ? "/fr" : `/fr${normalizedPath}`;
  }
  return normalizedPath;
}

export function getCanonicalUrl(path = "/", locale = DEFAULT_LOCALE) {
  return `${BASE}${getLocalizedPath(path, locale)}`;
}

export function getLocalizedCountryLabel(country, locale = DEFAULT_LOCALE) {
  const normalizedLocale = normalizeLocale(locale);
  return COUNTRY_LABELS[country]?.[normalizedLocale] || country;
}

export function getLocalizedCountryLabels(countries = [], locale = DEFAULT_LOCALE) {
  return countries.map((country) => getLocalizedCountryLabel(country, locale));
}

export function hasFrenchStaticPage(key) {
  return Boolean(STATIC_FRENCH_PAGES[key]);
}

export function getLocalizedField(record, field, locale) {
  if (isFrenchLocale(locale) && record?.[`${field}_fr`]) {
    return record[`${field}_fr`];
  }
  return record?.[field];
}

export function hasFrenchStory(story) {
  return Boolean(
    story?.title_fr &&
      story?.summary_fr &&
      Array.isArray(story?.body_fr) &&
      story.body_fr.length > 0
  );
}

export function getLocalizedStory(story, locale) {
  return {
    ...story,
    title: getLocalizedField(story, "title", locale),
    summary: getLocalizedField(story, "summary", locale),
    body: getLocalizedField(story, "body", locale),
  };
}

export function hasFrenchPerson(person) {
  return Boolean(person?.title_fr && person?.bio_fr);
}

export function getLocalizedPerson(person, locale) {
  return {
    ...person,
    name: getLocalizedField(person, "name", locale) || person.name,
    title: getLocalizedField(person, "title", locale),
    bio: getLocalizedField(person, "bio", locale),
  };
}
