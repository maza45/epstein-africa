/**
 * Auto-detect country tags from email text.
 * Mirrors the Python detect_countries() in scripts/build_db.py.
 * Keep both in sync when adding new keywords.
 */

const COUNTRY_KEYWORDS = {
  "kenya": "Kenya",
  "nairobi": "Kenya",
  "mombasa": "Kenya",
  "nigeria": "Nigeria",
  "lagos": "Nigeria",
  "abuja": "Nigeria",
  "ivory coast": "Ivory Coast",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "abidjan": "Ivory Coast",
  "south africa": "South Africa",
  "cape town": "South Africa",
  "johannesburg": "South Africa",
  "durban": "South Africa",
  "joburg": "South Africa",
  "pretoria": "South Africa",
  "senegal": "Senegal",
  "dakar": "Senegal",
  "zimbabwe": "Zimbabwe",
  "harare": "Zimbabwe",
  "mugabe": "Zimbabwe",
  "somalia": "Somalia",
  "somaliland": "Somalia",
  "mogadishu": "Somalia",
  "ethiopia": "Ethiopia",
  "addis ababa": "Ethiopia",
  "tanzania": "Tanzania",
  "dar es salaam": "Tanzania",
  "ghana": "Ghana",
  "accra": "Ghana",
  "morocco": "Morocco",
  "marrakech": "Morocco",
  "rabat": "Morocco",
  "rwanda": "Rwanda",
  "kigali": "Rwanda",
  "kagame": "Rwanda",
  "uganda": "Uganda",
  "kampala": "Uganda",
  "egypt": "Egypt",
  "cairo": "Egypt",
  "alexandria": "Egypt",
  "liberia": "Liberia",
  "sierra leone": "Sierra Leone",
  "freetown": "Sierra Leone",
  "sudan": "Sudan",
  "khartoum": "Sudan",
  "congo": "Congo",
  "kinshasa": "Congo",
  "brazzaville": "Congo",
  "kabila": "Congo",
  "gabon": "Gabon",
  "libreville": "Gabon",
  "madagascar": "Madagascar",
  "mozambique": "Mozambique",
  "maputo": "Mozambique",
  "zambia": "Zambia",
  "lusaka": "Zambia",
  "botswana": "Botswana",
  "gaborone": "Botswana",
  "cameroon": "Cameroon",
  "angola": "Angola",
  "luanda": "Angola",
  "mauritius": "Mauritius",
  "seychelles": "Seychelles",
  "mali": "Mali",
  "bamako": "Mali",
  "libya": "Libya",
  "tripoli": "Libya",
  "tunisia": "Tunisia",
  "tunis": "Tunisia",
  "djibouti": "Djibouti",
  "burkina faso": "Burkina Faso",
  "togo": "Togo",
  "benin": "Benin",
  "niger": "Niger",
  "africa": "Africa",
  "dangote": "Nigeria",
  "sol kerzner": "South Africa",
  "kerzner": "South Africa",
  "sun city": "South Africa",
  "bongo": "Gabon",
  "karim wade": "Senegal",
  "zuma": "South Africa",
};

const _patterns = Object.entries(COUNTRY_KEYWORDS).map(([kw, country]) => ({
  re: new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"),
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
  for (const { re, country } of _patterns) {
    if (re.test(text)) seen[country] = true;
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
