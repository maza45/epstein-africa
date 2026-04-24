export const CITATION_PATTERN = String.raw`(?:EFTA\d{8}(?:-\d+)?|vol00009-efta\d{8}-pdf(?:-\d+)?|HOUSE_OVERSIGHT_\d+(?:-\d+)?|[a-f0-9]{32}-\d+)`;

export function createCitationRegex() {
  return new RegExp(String.raw`\b(${CITATION_PATTERN})\b`, "g");
}

export function isSupportedCitationId(id) {
  return new RegExp(String.raw`^${CITATION_PATTERN}$`).test(id);
}

export function extractCitationIds(text) {
  const re = createCitationRegex();
  return Array.from(text.matchAll(re), (match) => match[1]);
}
