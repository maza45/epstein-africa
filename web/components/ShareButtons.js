import { useState } from "react";

const BASE = "https://epstein-africa.vercel.app";

export default function ShareButtons({ path, title, summary }) {
  const [copied, setCopied] = useState(false);
  const url = `${BASE}${path}`;
  const text = `${title} — Epstein Africa`;

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
    <div className="share-buttons">
      <span className="share-label">Share</span>
      <a href={twitterUrl} target="_blank" rel="noreferrer" className="share-btn" title="Share on X">
        X
      </a>
      <a href={bskyUrl} target="_blank" rel="noreferrer" className="share-btn" title="Share on Bluesky">
        Bsky
      </a>
      <a href={redditUrl} target="_blank" rel="noreferrer" className="share-btn" title="Share on Reddit">
        Reddit
      </a>
      <button onClick={copyLink} className="share-btn" title="Copy link">
        {copied ? "Copied" : "Link"}
      </button>
    </div>
  );
}
