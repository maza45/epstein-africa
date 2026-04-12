export const BASE = "https://www.epsteinafrica.com";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "fr"];

const STATIC_FRENCH_PAGES = {
  home: false,
  stories: false,
  people: true,
  about: false,
  map: false,
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
