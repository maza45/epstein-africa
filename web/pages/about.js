import Head from "next/head";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { getDb } from "../lib/db";
import {
  ABOUT_COPY,
  BASE,
  getCanonicalUrl,
  getOgLocale,
  hasFrenchStaticPage,
  normalizeLocale,
} from "../lib/i18n";

export async function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("about");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const db = getDb();
  const emailCount = db
    .prepare("SELECT COUNT(*) AS n FROM emails WHERE COALESCE(is_promotional, 0) = 0")
    .get().n;
  const rows = db
    .prepare("SELECT DISTINCT countries FROM emails WHERE COALESCE(is_promotional, 0) = 0 AND countries IS NOT NULL AND countries != ''")
    .all();
  const countrySet = new Set();
  for (const r of rows) {
    r.countries.split(",").map((c) => c.trim()).filter((c) => c && c !== "Africa").forEach((c) => countrySet.add(c));
  }
  return { props: { emailCount, countryCount: countrySet.size, locale: normalizedLocale, frAvailable } };
}

export default function About({ emailCount, countryCount, locale, frAvailable }) {
  const copy = ABOUT_COPY[locale] || ABOUT_COPY.en;
  const formatSectionBody = (body) =>
    body
      .replaceAll("{emailCount}", emailCount.toLocaleString())
      .replaceAll("{countryCount}", countryCount.toLocaleString());

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: copy.ogTitle,
    url: getCanonicalUrl("/about", locale),
    mainEntity: {
      "@type": "WebSite",
      name: "Epstein Africa",
      url: BASE,
      description: copy.description,
    },
  };

  return (
    <>
      <Head>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={getCanonicalUrl("/about", locale)} />
        <meta property="og:title" content={copy.ogTitle} />
        <meta property="og:description" content={copy.description} />
        <meta property="og:url" content={getCanonicalUrl("/about", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(copy.heading)}&subtitle=${encodeURIComponent(copy.ogSubtitle)}`} />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/about", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/about", "en")} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="container">
        <Nav pagePath="/about" frAvailable={frAvailable} />
        <header className="site-header">
          <h1>{copy.heading}</h1>
        </header>

        <div className="about-body">
          {copy.sections.map((section) => {
            const body = formatSectionBody(section.body);
            if (body.includes("{jmail}")) {
              const [before, after] = body.split("{jmail}");
              return (
                <div key={section.heading}>
                  <h2>{section.heading}</h2>
                  <p>
                    {before}
                    <a href="https://jmail.world" target="_blank" rel="noreferrer">
                      jmail.world
                    </a>
                    {after}
                  </p>
                </div>
              );
            }
            if (body.includes("{email}")) {
              const [before, after] = body.split("{email}");
              return (
                <div key={section.heading}>
                  <h2>{section.heading}</h2>
                  <p>
                    {before}
                    <a href="mailto:epsteinexposedafrica@pm.me">
                      epsteinexposedafrica@pm.me
                    </a>
                    {after}
                  </p>
                </div>
              );
            }
            return (
              <div key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{body}</p>
              </div>
            );
          })}
        </div>

        <Footer locale={locale} />
      </div>
    </>
  );
}
