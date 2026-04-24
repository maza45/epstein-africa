import Link from "next/link";
import { FOOTER_COPY, normalizeLocale } from "../lib/i18n";

export default function Footer({ locale = "en" }) {
  const loc = normalizeLocale(locale);
  const copy = FOOTER_COPY[loc];

  return (
    <footer className="site-footer mag-footer">
      <div className="mag-footer-inner">
        <div className="mag-footer-about">
          <strong>{copy.brand}</strong> {copy.about}
        </div>
        <div className="mag-footer-col">
          <h4>{copy.readHead}</h4>
          <ul>
            <li>
              <Link href="/stories" locale={loc}>
                {copy.readStories}
              </Link>
            </li>
            <li>
              <Link href="/" locale={loc}>
                {copy.readLongreads}
              </Link>
            </li>
            <li>
              <Link href="/people" locale={loc}>
                {copy.readPeople}
              </Link>
            </li>
            <li>
              <Link href="/about" locale={loc}>
                {copy.readAbout}
              </Link>
            </li>
          </ul>
        </div>
        <div className="mag-footer-col">
          <h4>{copy.dataHead}</h4>
          <ul>
            <li>
              <Link href="/archive" locale={loc}>
                {copy.dataArchive}
              </Link>
            </li>
            <li>
              <Link href="/map" locale={loc}>
                {copy.dataMap}
              </Link>
            </li>
            <li>
              <Link href="/graph" locale={loc}>
                {copy.dataGraph}
              </Link>
            </li>
            <li>
              <a href="/api/export?format=csv" download>
                {copy.dataCsv}
              </a>
            </li>
          </ul>
        </div>
        <div className="mag-footer-col">
          <h4>{copy.followHead}</h4>
          <ul>
            <li>
              <a href="/rss.xml">{copy.followRss}</a>
            </li>
            <li>
              <Link
                href="/about#contact"
                locale={loc}
                data-umami-event="footer_contact_click"
              >
                {copy.followContact}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="mag-footer-bottom">
        <span>{copy.license}</span>
        <span>{copy.source}</span>
      </div>
    </footer>
  );
}
