export const BASE = "https://www.epsteinafrica.com";
export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "fr"];

const STATIC_FRENCH_PAGES = {
  home: true,
  stories: true,
  people: true,
  about: true,
  map: true,
  graph: true,
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

export const HOME_COPY = {
  en: {
    title: "Epstein Africa — Email Database",
    description:
      "Searchable database of Jeffrey Epstein's documented connections to Africa, sourced from DOJ Epstein Files Transparency Act releases.",
    ogSubtitle: "verified emails from DOJ releases",
    heading: "Epstein Africa",
    subtitlePrefix:
      "Searchable database of Jeffrey Epstein's documented connections to Africa",
    subtitleSuffix: "verified emails, excluding promotional mail.",
    sourceLabel: "Source: DOJ Epstein Files Transparency Act.",
    statement:
      "The archive documents a pattern: humanitarian funding as the entry point, intelligence collection as the product, political access as the payoff. The same channel that carried polio field reports from Nigeria carried investment deals worth millions. The same relationships that opened doors to African presidents opened doors to their ministers, their ports, their resources. The documents don't explain why a convicted sex offender was at the center of this network. They show that he was.",
    searchPlaceholder: "Search subject, sender…",
    searchAria: "Search emails",
    filterAria: "Filter by country",
    filterAll: "All countries",
    loading: "Loading…",
    resultCount: "emails",
    clearFilters: "Clear filters",
    downloadCsv: "Download CSV",
    thDate: "Date",
    thSender: "Sender",
    thSubject: "Subject",
    thCountries: "Countries",
    noResults: "No results.",
    noSubject: "(no subject)",
    prevPage: "Prev",
    nextPage: "Next",
    previousPageAria: "Previous page",
    nextPageAria: "Next page",
    pageOf: "Page",
  },
  fr: {
    title: "Epstein Africa — Base de données emails",
    description:
      "Base de données consultable des connexions documentées de Jeffrey Epstein avec l'Afrique, à partir des publications du DOJ au titre de l'Epstein Files Transparency Act.",
    ogSubtitle: "emails vérifiés issus des publications du DOJ",
    heading: "Epstein Africa",
    subtitlePrefix:
      "Base de données consultable des connexions documentées de Jeffrey Epstein avec l'Afrique",
    subtitleSuffix: "emails vérifiés, hors courriels promotionnels.",
    sourceLabel: "Source : Epstein Files Transparency Act du DOJ.",
    statement:
      "Les archives documentent un schéma : le financement humanitaire comme point d'entrée, la collecte de renseignement comme produit, l'accès politique comme contrepartie. Le même canal qui faisait remonter des rapports de terrain sur la polio au Nigeria transportait aussi des accords d'investissement valant des millions. Les mêmes relations qui ouvraient les portes des présidents africains ouvraient aussi celles de leurs ministres, de leurs ports et de leurs ressources. Les documents n'expliquent pas pourquoi un délinquant sexuel condamné se trouvait au centre de ce réseau. Ils montrent qu'il y était.",
    searchPlaceholder: "Rechercher par objet, expéditeur…",
    searchAria: "Rechercher des emails",
    filterAria: "Filtrer par pays",
    filterAll: "Tous les pays",
    loading: "Chargement…",
    resultCount: "emails",
    clearFilters: "Effacer les filtres",
    downloadCsv: "Télécharger le CSV",
    thDate: "Date",
    thSender: "Expéditeur",
    thSubject: "Objet",
    thCountries: "Pays",
    noResults: "Aucun résultat.",
    noSubject: "(sans objet)",
    prevPage: "Préc.",
    nextPage: "Suiv.",
    previousPageAria: "Page précédente",
    nextPageAria: "Page suivante",
    pageOf: "Page",
  },
};

export const ABOUT_COPY = {
  en: {
    title: "About — Epstein Africa",
    description: "About the Epstein Africa database — methodology, sources, and caveats.",
    ogTitle: "About — Epstein Africa",
    ogSubtitle: "Methodology, sources, and caveats",
    heading: "About",
    sections: [
      {
        heading: "What this is",
        body:
          "A searchable database of Jeffrey Epstein's documented connections to the African continent. {emailCount} emails across {countryCount} countries. Every claim on this site links to a specific document ID from the U.S. Department of Justice release.",
      },
      {
        heading: "Why it exists",
        body:
          "The DOJ released 1.78 million Epstein emails under the Epstein Files Transparency Act, signed November 2025. The Africa connections in those files have received almost no coverage in African media. This site filters, indexes, and contextualizes the Africa-relevant portion of the archive so journalists, researchers, and the public can work with the primary sources directly.",
      },
      {
        heading: "What the archive shows",
        body:
          "The archive documents a pattern: humanitarian funding as the entry point, intelligence collection as the product, political access as the payoff. The same channel that carried polio field reports from Nigeria carried investment deals worth millions. The same relationships that opened doors to African presidents opened doors to their ministers, their ports, their resources. The documents don't explain why a convicted sex offender was at the center of this network. They show that he was.",
      },
      {
        heading: "Data sources",
        body:
          "The email archive comes from {jmail}, which parsed the DOJ release into structured data. Additional documents come from the House Oversight Committee subpoena releases (September and November 2025). Every email in the database can be verified against the original DOJ files.",
      },
      {
        heading: "What you can do here",
        body:
          "Search emails by keyword, sender, or country using full-text search. Read investigative stories, each citing specific email document IDs. Browse person profiles showing who communicated with whom. Explore the network graph to see relationships between people and countries. Export the full dataset as CSV or JSON. Subscribe to the RSS feed for new stories.",
      },
      {
        heading: "Methodology",
        body:
          "The {emailCount} emails were filtered from the 1.78 million email archive by keyword matching on subjects, senders, participant lists, and body text for African countries, cities, and documented individuals. Stories are written from the emails as primary sources. Every factual claim cites a document ID. Direct quotes preserve the original text, including typos.",
      },
      {
        heading: "How stories are built",
        body:
          "Every story follows the same process. Emails are identified in the archive by keyword, sender, or participant matching. Each quoted passage is verified verbatim against the original document. Email IDs, senders, dates, and recipients are cross-checked before publication. No claim appears without a document anchor. Direct quotes preserve the original text, including typos and misspellings. External claims — biographical details, news events, public record — are separated from what the emails themselves say. A pre-publication verification process checks every citation against the database before any story goes live.",
      },
      {
        heading: "Contact",
        body:
          "If you are a journalist or researcher working on a specific lead in this database, you can reach us at {email}. We can provide document IDs, source context, and data exports for any thread in the archive.",
      },
      {
        heading: "Caveats",
        body:
          "The archive has gaps, redactions, and missing metadata. Some dates are null. Some senders show as Unknown or Redacted. Some emails appear in both electronic and PDF format, creating duplicate entries for the same exchange. We show the data as it is.",
      },
    ],
  },
  fr: {
    title: "À propos — Epstein Africa",
    description:
      "À propos de la base de données Epstein Africa — méthodologie, sources et limites.",
    ogTitle: "À propos — Epstein Africa",
    ogSubtitle: "Méthodologie, sources et limites",
    heading: "À propos",
    sections: [
      {
        heading: "Ce que c'est",
        body:
          "Une base de données consultable des connexions documentées de Jeffrey Epstein avec le continent africain. {emailCount} emails couvrant {countryCount} pays. Chaque affirmation de ce site renvoie à un identifiant documentaire précis issu de la publication du département de la Justice des États-Unis.",
      },
      {
        heading: "Pourquoi ce site existe",
        body:
          "Le DOJ a publié 1,78 million d'emails d'Epstein au titre de l'Epstein Files Transparency Act, signé en novembre 2025. Les connexions africaines présentes dans ces dossiers ont reçu très peu de couverture dans les médias africains. Ce site filtre, indexe et contextualise la partie africaine des archives afin que journalistes, chercheurs et public puissent travailler directement à partir des sources primaires.",
      },
      {
        heading: "Ce que montrent les archives",
        body:
          "Les archives documentent un schéma : le financement humanitaire comme point d'entrée, la collecte de renseignement comme produit, l'accès politique comme contrepartie. Le même canal qui faisait remonter des rapports de terrain sur la polio au Nigeria transportait aussi des accords d'investissement valant des millions. Les mêmes relations qui ouvraient les portes des présidents africains ouvraient aussi celles de leurs ministres, de leurs ports et de leurs ressources. Les documents n'expliquent pas pourquoi un délinquant sexuel condamné se trouvait au centre de ce réseau. Ils montrent qu'il y était.",
      },
      {
        heading: "Sources de données",
        body:
          "Les archives email proviennent de {jmail}, qui a transformé la publication du DOJ en données structurées. Des documents supplémentaires viennent des publications d'assignations de la House Oversight Committee (septembre et novembre 2025). Chaque email de la base peut être vérifié par rapport aux fichiers originaux du DOJ.",
      },
      {
        heading: "Ce que vous pouvez faire ici",
        body:
          "Rechercher des emails par mot-clé, expéditeur ou pays grâce à la recherche plein texte. Lire des récits d'enquête, chacun relié à des identifiants de documents email précis. Parcourir des profils de personnes pour voir qui a communiqué avec qui. Explorer le graphe de réseau pour visualiser les relations entre personnes et pays. Exporter l'ensemble des données en CSV ou JSON. S'abonner au flux RSS pour les nouveaux récits.",
      },
      {
        heading: "Méthodologie",
        body:
          "Les {emailCount} emails ont été extraits des 1,78 million d'emails par rapprochement de mots-clés dans les objets, les expéditeurs, les listes de participants et le corps des messages pour les pays africains, les villes et les individus documentés. Les récits sont écrits à partir des emails comme sources primaires. Chaque affirmation factuelle cite un identifiant documentaire. Les citations directes conservent le texte original, fautes comprises.",
      },
      {
        heading: "Comment les récits sont construits",
        body:
          "Chaque récit suit le même processus. Les emails sont identifiés dans les archives par mots-clés, expéditeur ou correspondance de participants. Chaque passage cité est vérifié mot pour mot par rapport au document original. Les identifiants d'email, expéditeurs, dates et destinataires sont recoupés avant publication. Aucune affirmation n'apparaît sans ancrage documentaire. Les citations directes conservent le texte original, y compris les fautes et coquilles. Les affirmations externes — détails biographiques, événements d'actualité, archives publiques — sont séparées de ce que disent les emails eux-mêmes. Un processus de vérification avant publication contrôle chaque citation par rapport à la base avant qu'un récit soit mis en ligne.",
      },
      {
        heading: "Contact",
        body:
          "Si vous êtes journaliste ou chercheur et travaillez sur une piste précise dans cette base, vous pouvez nous écrire à {email}. Nous pouvons fournir des identifiants de documents, le contexte des sources et des exports de données pour toute piste présente dans les archives.",
      },
      {
        heading: "Limites",
        body:
          "Les archives comportent des lacunes, des caviardages et des métadonnées manquantes. Certaines dates sont nulles. Certains expéditeurs apparaissent comme Unknown ou Redacted. Certains emails existent à la fois en format électronique et PDF, ce qui crée des doublons pour un même échange. Nous montrons les données telles qu'elles sont.",
      },
    ],
  },
};

export const GRAPH_COPY = {
  en: {
    title: "Network Graph — Epstein Africa",
    description:
      "Interactive network graph of persons and countries in Epstein's Africa-related correspondence.",
    ogTitle: "Network Graph — Epstein Africa",
    ogSubtitle: "Persons and countries in the email archive",
    loading: "Loading…",
    personLegend: "Person (click → profile)",
    countryLegend: "Country (click → filter emails)",
    hint: "Scroll to zoom · Drag nodes · Click to highlight · Click again to visit",
    exploreAll: "Explore all connections",
    showProfilesOnly: "Show profiles only",
  },
  fr: {
    title: "Graphe du réseau — Epstein Africa",
    description:
      "Graphe interactif des personnes et des pays présents dans la correspondance d'Epstein liée à l'Afrique.",
    ogTitle: "Graphe du réseau — Epstein Africa",
    ogSubtitle: "Personnes et pays dans les archives email",
    loading: "Chargement…",
    personLegend: "Personne (clic → profil)",
    countryLegend: "Pays (clic → filtrer les emails)",
    hint: "Molette pour zoomer · Glisser les nœuds · Cliquer pour surligner · Recliquer pour ouvrir",
    exploreAll: "Explorer toutes les connexions",
    showProfilesOnly: "Afficher seulement les profils",
  },
};

export const EMAIL_COPY = {
  en: {
    titleFallback: "Email",
    pageTitleSuffix: "— Epstein Africa",
    chooserTitle: "Multiple Email Records — Epstein Africa",
    chooserDescription:
      'The pasted email link "{requestedId}" matches multiple records. Choose the correct email record.',
    descriptionPrefix: "Email from",
    unknown: "Unknown",
    undated: "undated",
    back: "Back",
    loading: "Loading…",
    noSubject: "(no subject)",
    epsteinSender: "Epstein sender",
    from: "From",
    to: "To",
    allParticipants: "All participants",
    countriesMentioned: "Countries mentioned",
    body: "Body",
    releaseBatch: "Release batch",
    documentId: "Document ID",
    recordId: "Record ID",
    source: "Source",
    viewOnJmail: "View on Jmail ↗",
    chooserHeading: "Multiple Email Records",
    chooserLeadPrefix:
      "The link you opened matches multiple email records for document",
    chooserLeadSuffix: "Choose the record you want to view.",
    thDate: "Date",
    thSender: "Sender",
    thSubject: "Subject",
    thCountries: "Countries",
  },
  fr: {
    titleFallback: "Email",
    pageTitleSuffix: "— Epstein Africa",
    chooserTitle: "Plusieurs enregistrements email — Epstein Africa",
    chooserDescription:
      'Le lien email saisi "{requestedId}" correspond à plusieurs enregistrements. Choisissez le bon enregistrement.',
    descriptionPrefix: "Email de",
    unknown: "Unknown",
    undated: "sans date",
    back: "Retour",
    loading: "Chargement…",
    noSubject: "(sans objet)",
    epsteinSender: "Expéditeur : Epstein",
    from: "De",
    to: "À",
    allParticipants: "Tous les participants",
    countriesMentioned: "Pays mentionnés",
    body: "Corps",
    releaseBatch: "Lot de publication",
    documentId: "ID document",
    recordId: "ID enregistrement",
    source: "Source",
    viewOnJmail: "Voir sur Jmail ↗",
    chooserHeading: "Plusieurs enregistrements email",
    chooserLeadPrefix:
      "Le lien que vous avez ouvert correspond à plusieurs enregistrements email pour le document",
    chooserLeadSuffix: "Choisissez l'enregistrement à consulter.",
    thDate: "Date",
    thSender: "Expéditeur",
    thSubject: "Objet",
    thCountries: "Pays",
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

export function resolveBackHref(rawBack, fallbackPath = "/", locale = DEFAULT_LOCALE) {
  const fallback = getLocalizedPath(fallbackPath, locale);
  const input = Array.isArray(rawBack) ? rawBack[0] : rawBack;
  if (!input || typeof input !== "string") return fallback;

  let decoded = input;
  try {
    decoded = decodeURIComponent(input);
  } catch {
    decoded = input;
  }

  try {
    const url = new URL(decoded, BASE);
    if (url.origin !== BASE) return fallback;
    const internalPath = `${url.pathname}${url.search}${url.hash}`;
    return internalPath.startsWith("/") && !internalPath.startsWith("//")
      ? getLocalizedPath(internalPath, locale)
      : fallback;
  } catch {
    return decoded.startsWith("/") && !decoded.startsWith("//")
      ? getLocalizedPath(decoded, locale)
      : fallback;
  }
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
