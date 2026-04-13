import { useState } from "react";
import { SHARE_COPY, getCanonicalUrl, normalizeLocale } from "../lib/i18n";

export default function ShareButtons({ path, title, locale = "en" }) {
  const [copied, setCopied] = useState(false);
  const normalizedLocale = normalizeLocale(locale);
  const url = getCanonicalUrl(path, normalizedLocale);
  const text = `${title} — Epstein Africa`;
  const copy = SHARE_COPY[normalizedLocale];

  const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`;
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`;

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="share-buttons" role="group" aria-label={copy.groupLabel}>
      <span className="share-label">{copy.label}</span>
      <a href={twitterUrl} target="_blank" rel="noreferrer" className="share-btn" aria-label={copy.x}>
        X
      </a>
      <a href={bskyUrl} target="_blank" rel="noreferrer" className="share-btn" aria-label={copy.bsky}>
        Bsky
      </a>
      <a href={redditUrl} target="_blank" rel="noreferrer" className="share-btn" aria-label={copy.reddit}>
        Reddit
      </a>
      <button onClick={copyLink} className="share-btn" aria-label={copy.copy}>
        {copied ? copy.copied : copy.link}
      </button>
    </div>
  );
}
