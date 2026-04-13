import { FOOTER_COPY, normalizeLocale } from "../lib/i18n";

export default function Footer({ locale = "en" }) {
  const copy = FOOTER_COPY[normalizeLocale(locale)];

  return (
    <footer className="site-footer">
      <p>
        {copy.blurb}
      </p>
      <div className="footer-links">
        <a href="/rss.xml">{copy.rss}</a>
        <a href="/api/export?format=csv">{copy.exportCsv}</a>
      </div>
    </footer>
  );
}
