/**
 * Auto-detect country tags from email text.
 * Mirrors the Python detect_countries() in scripts/build_db.py.
 * Keep both in sync when adding new keywords.
 */

const COUNTRY_KEYWORDS = {
  // North Africa
  "algeria": "Algeria",
  "algiers": "Algeria",
  "egypt": "Egypt",
  "cairo": "Egypt",
  "alexandria": "Egypt",
  "libya": "Libya",
  "tripoli": "Libya",
  "benghazi": "Libya",
  "morocco": "Morocco",
  "marrakech": "Morocco",
  "marrakesh": "Morocco",
  "marakash": "Morocco",
  "bin ennakhil": "Morocco",
  "rabat": "Morocco",
  "casablanca": "Morocco",
  "tangier": "Morocco",
  "fez": "Morocco",
  "sudan": "Sudan",
  "khartoum": "Sudan",
  "south sudan": "South Sudan",
  "juba": "South Sudan",
  "tunisia": "Tunisia",
  "tunis": "Tunisia",
  "western sahara": "Western Sahara",

  // West Africa
  "benin": "Benin",
  "cotonou": "Benin",
  "porto-novo": "Benin",
  "burkina faso": "Burkina Faso",
  "ouagadougou": "Burkina Faso",
  "cabo verde": "Cape Verde",
  "cape verde": "Cape Verde",
  "praia": "Cape Verde",
  "ivory coast": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "abidjan": "Ivory Coast",
  "yamoussoukro": "Ivory Coast",
  "ouattara": "Ivory Coast",
  "gambia": "Gambia",
  "banjul": "Gambia",
  "ghana": "Ghana",
  "accra": "Ghana",
  "kumasi": "Ghana",
  "conakry": "Guinea",
  "guinea-bissau": "Guinea-Bissau",
  "guinea bissau": "Guinea-Bissau",
  "bissau": "Guinea-Bissau",
  "liberia": "Liberia",
  "monrovia": "Liberia",
  "sirleaf": "Liberia",
  "mali": "Mali",
  "bamako": "Mali",
  "timbuktu": "Mali",
  "mauritania": "Mauritania",
  "nouakchott": "Mauritania",
  "niger": "Niger",
  "niamey": "Niger",
  "nigeria": "Nigeria",
  "lagos": "Nigeria",
  "abuja": "Nigeria",
  "kano": "Nigeria",
  "dangote": "Nigeria",
  "boko haram": "Nigeria",
  "buhari": "Nigeria",
  "senegal": "Senegal",
  "dakar": "Senegal",
  "macky sall": "Senegal",
  "karim wade": "Senegal",
  "sierra leone": "Sierra Leone",
  "freetown": "Sierra Leone",
  "togo": "Togo",
  "lome": "Togo",

  // Central Africa
  "cameroon": "Cameroon",
  "yaounde": "Cameroon",
  "douala": "Cameroon",
  "central african republic": "Central African Republic",
  "bangui": "Central African Republic",
  "chad": "Chad",
  "n'djamena": "Chad",
  "ndjamena": "Chad",
  "congo": "Congo",
  "kinshasa": "Congo",
  "brazzaville": "Congo",
  "kabila": "Congo",
  "lubumbashi": "Congo",
  "drc": "Congo",
  "equatorial guinea": "Equatorial Guinea",
  "malabo": "Equatorial Guinea",
  "obiang": "Equatorial Guinea",
  // Deliberately NOT adding "bata" alone — it matches "Arset Bata 3"
  // (Marc Leon's Marrakech real estate office street address) which appears
  // in dozens of marrakech-bin-ennakhil-related emails. The other EQ Guinea
  // keywords (equatorial guinea, malabo, obiang) are sufficient to tag
  // genuine EQ Guinea references.
  "gabon": "Gabon",
  "libreville": "Gabon",
  "bongo": "Gabon",
  "sao tome": "Sao Tome and Principe",
  "são tomé": "Sao Tome and Principe",
  "sao tome and principe": "Sao Tome and Principe",

  // East Africa
  "burundi": "Burundi",
  "bujumbura": "Burundi",
  "comoros": "Comoros",
  "moroni": "Comoros",
  "djibouti": "Djibouti",
  "eritrea": "Eritrea",
  "asmara": "Eritrea",
  "ethiopia": "Ethiopia",
  "addis ababa": "Ethiopia",
  "kenya": "Kenya",
  "nairobi": "Kenya",
  "mombasa": "Kenya",
  "kenyatta": "Kenya",
  "madagascar": "Madagascar",
  "antananarivo": "Madagascar",
  "rwanda": "Rwanda",
  "kigali": "Rwanda",
  "kagame": "Rwanda",
  "seychelles": "Seychelles",
  "victoria seychelles": "Seychelles",
  "somalia": "Somalia",
  "somaliland": "Somalia",
  "mogadishu": "Somalia",
  "hargeisa": "Somalia",
  "tanzania": "Tanzania",
  "dar es salaam": "Tanzania",
  "zanzibar": "Tanzania",
  "uganda": "Uganda",
  "kampala": "Uganda",
  "museveni": "Uganda",

  // Southern Africa
  "angola": "Angola",
  "luanda": "Angola",
  "botswana": "Botswana",
  "gaborone": "Botswana",
  "eswatini": "Eswatini",
  "swaziland": "Eswatini",
  "mbabane": "Eswatini",
  "lesotho": "Lesotho",
  // "maseru" deliberately omitted: 6/6 matches in PROD are the "Maseru"
  // shell company in the marrakech-bin-ennakhil property deal
  // (alongside Rilton, Khan Stiftung, Arcana, etc), zero genuine Lesotho
  // capital references. The "lesotho" keyword still catches the country.
  "malawi": "Malawi",
  "lilongwe": "Malawi",
  "blantyre": "Malawi",
  "mauritius": "Mauritius",
  "port louis": "Mauritius",
  "mozambique": "Mozambique",
  "maputo": "Mozambique",
  "namibia": "Namibia",
  "windhoek": "Namibia",
  "south africa": "South Africa",
  "cape town": "South Africa",
  "johannesburg": "South Africa",
  "durban": "South Africa",
  "joburg": "South Africa",
  "pretoria": "South Africa",
  "sol kerzner": "South Africa",
  "kerzner": "South Africa",
  "sun city": "South Africa",
  "zuma": "South Africa",
  "zambia": "Zambia",
  "lusaka": "Zambia",
  "zimbabwe": "Zimbabwe",
  "harare": "Zimbabwe",
  "mugabe": "Zimbabwe",
  "bulawayo": "Zimbabwe",

  // Generic continent tag (allowed but not preferred)
  "africa": "Africa",
};

// Per-keyword false-positive filters. Each filter receives the body text
// and the regex match index, and returns true if the match represents a
// genuine country reference (keep) or false if it's a known false positive
// pattern (skip). When a filter is defined for a keyword, detectCountries
// iterates through ALL matches in the body and accepts the keyword's
// country tag if ANY match passes the filter.
//
// This lets us keep keywords that are genuine country/city names but also
// happen to be common first names or OCR-mangled versions of other words,
// without losing the true positives.
const KEYWORD_FILTERS = {
  // "chad" is also a common American first name. Skip when followed by
  // whitespace + a capitalized surname pattern (e.g. "Chad Wolf",
  // "Chad Daybell", "Chad Higdon"). Keep when followed by comma, lowercase,
  // or sentence punctuation (the country-list / preposition contexts).
  "chad": (text, matchEnd) => {
    const after = text.slice(matchEnd, matchEnd + 30);
    return !/^\s+[A-Z][a-z]+/.test(after);
  },
  // "lome" is consistently OCR-mangled from "Lorne" in references to
  // "Lorne Michaels" (SNL producer). Skip when followed by whitespace
  // + "Michaels". Keep all other usages (e.g. "Lome', Togo", "city called
  // lome").
  "lome": (text, matchEnd) => {
    const after = text.slice(matchEnd, matchEnd + 15);
    return !/^\s+Michaels/i.test(after);
  },
};

const _patterns = Object.entries(COUNTRY_KEYWORDS).map(([kw, country]) => ({
  kw,
  re: new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "gi"),
  country,
}));

/**
 * Detect countries mentioned in text.
 * @param {string} text - Combined subject + sender + participants + body
 * @returns {string} Comma-separated unique country names, or ""
 */
export function detectCountries(text) {
  if (!text) return "";
  const seen = {};
  for (const { kw, re, country } of _patterns) {
    re.lastIndex = 0;
    const filter = KEYWORD_FILTERS[kw];
    let m;
    while ((m = re.exec(text)) !== null) {
      const matchEnd = m.index + m[0].length;
      if (!filter || filter(text, matchEnd)) {
        seen[country] = true;
        break; // one passing match is enough
      }
    }
  }
  return Object.keys(seen).join(", ");
}

/**
 * Build combined search text from email fields (mirrors build_db.py combined()).
 * @param {object} email - Object with subject, sender, all_participants, body
 * @returns {string}
 */
export function combinedText(email) {
  return [
    (email.subject || "").replace(/<[^>]+>/g, " "),
    email.sender || "",
    email.all_participants || "",
    email.body || "",
  ].join(" ");
}
