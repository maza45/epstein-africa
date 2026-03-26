/**
 * Shared formatting utilities used across pages.
 */

export function cleanSender(sender) {
  if (!sender) return "—";
  const match = sender.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return sender.replace(/[<>]/g, "").trim();
}

export function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * Split a comma-separated countries string into an array of trimmed values.
 * Handles both "Kenya, Nigeria" and "Kenya,Nigeria" formatting.
 */
export function splitCountries(raw) {
  if (!raw) return [];
  return raw.split(",").map((c) => c.trim()).filter(Boolean);
}
