import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { PEOPLE } from "../../lib/people";
import { getDb } from "../../lib/db";
import {
  BASE,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getLocalizedPerson,
  getOgLocale,
  hasFrenchPerson,
  hasFrenchStaticPage,
  normalizeLocale,
  PEOPLE_COPY,
} from "../../lib/i18n";

export async function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("people");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const db = getDb();
  const sourcePeople = normalizedLocale === "fr" ? PEOPLE.filter(hasFrenchPerson) : PEOPLE;

  const counts = sourcePeople.map((person) => {
    const termConditions = person.searchTerms
      .map(() => "(LOWER(sender) LIKE ? OR LOWER(all_participants) LIKE ?)")
      .join(" OR ");
    const params = person.searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM emails
         WHERE COALESCE(is_promotional, 0) = 0 AND (${termConditions})`
      )
      .get(...params);
    return { slug: person.slug, count: row.count };
  });

  const countMap = Object.fromEntries(counts.map((c) => [c.slug, c.count]));

  const sortedPeople = [...sourcePeople].sort(
    (a, b) => (countMap[b.slug] ?? 0) - (countMap[a.slug] ?? 0)
  );

  return {
    props: {
      people: sortedPeople.map((p) => ({
        ...getLocalizedPerson(p, normalizedLocale),
        emailCount: countMap[p.slug] ?? 0,
      })),
      locale: normalizedLocale,
      frAvailable,
    },
  };
}

export default function PeopleIndex({ people, locale, frAvailable }) {
  const t = PEOPLE_COPY[locale] || PEOPLE_COPY.en;
  return (
    <>
      <Head>
        <title>{t.indexTitle}</title>
        <meta name="description" content={t.indexDescription} />
        <link rel="canonical" href={getCanonicalUrl("/people", locale)} />
        <meta property="og:title" content={t.indexTitle} />
        <meta property="og:description" content={t.indexDescription} />
        <meta property="og:url" content={getCanonicalUrl("/people", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(t.indexHeading)}&subtitle=${encodeURIComponent(`${people.length} ${t.ogSubtitle}`)}&type=person`} />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/people", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/people", "en")} />
        )}
      </Head>

      <div className="container">
        <Nav pagePath="/people" frAvailable={frAvailable} />
        <header className="site-header">
          <h1>{t.indexHeading}</h1>
          <p className="subtitle">{t.indexSubtitle}</p>
        </header>

        <div className="people-grid">
          {people.map((person) => (
            <Link
              key={person.slug}
              href={`/people/${person.slug}`}
              locale={locale}
              className="person-card"
            >
              <div className="person-name">{person.name}</div>
              <div className="person-title">{person.title}</div>
              <div className="person-countries">
                {person.countries.slice(0, 4).map((c) => (
                  <span key={c} className="tag">
                    {getLocalizedCountryLabel(c, locale)}
                  </span>
                ))}
                {person.countries.length > 4 && (
                  <span className="tag">+{person.countries.length - 4}</span>
                )}
              </div>
              {person.emailCount > 0 && (
                <div className="person-email-count">{person.emailCount} {t.emailCount}</div>
              )}
            </Link>
          ))}
        </div>

        <Footer locale={locale} />
      </div>
    </>
  );
}
