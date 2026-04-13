import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import ShareButtons from "../../components/ShareButtons";
import { PEOPLE, getPersonBySlug } from "../../lib/people";
import { getDb } from "../../lib/db";
import { cleanSender, formatDate, splitCountries } from "../../lib/format";
import {
  BASE,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getLocalizedPath,
  getLocalizedPerson,
  getOgLocale,
  hasFrenchPerson,
  normalizeLocale,
  PEOPLE_COPY,
  resolveBackHref,
} from "../../lib/i18n";

const LIMIT = 25;

export async function getStaticPaths() {
  return {
    paths: PEOPLE.flatMap((person) => {
      const paths = [{ params: { slug: person.slug }, locale: "en" }];
      if (hasFrenchPerson(person)) {
        paths.push({ params: { slug: person.slug }, locale: "fr" });
      }
      return paths;
    }),
    fallback: false,
  };
}

export async function getStaticProps({ params, locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const person = getPersonBySlug(params.slug);
  if (!person) return { notFound: true };
  if (normalizedLocale === "fr" && !hasFrenchPerson(person)) {
    return { notFound: true };
  }
  const localizedPerson = getLocalizedPerson(person, normalizedLocale);

  const db = getDb();
  const page = 1;
  const offset = 0;

  // Section 1: emails where person is sender or participant
  const termConditions = person.searchTerms
    .map(() => "(LOWER(sender) LIKE ? OR LOWER(all_participants) LIKE ?)")
    .join(" OR ");
  const sqlParams = person.searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM emails
       WHERE COALESCE(is_promotional, 0) = 0 AND (${termConditions})`
    )
    .get(...sqlParams).n;

  const emails = db
    .prepare(
      `SELECT id, sender, subject, sent_at, countries, epstein_is_sender
       FROM emails
       WHERE COALESCE(is_promotional, 0) = 0 AND (${termConditions})
       ORDER BY COALESCE(sent_at, '9999-99-99') ASC
       LIMIT ? OFFSET ?`
    )
    .all(...sqlParams, LIMIT, offset);

  // Section 2: emails mentioning person in body (only if person has bodySearchTerms)
  let mentionEmails = [];
  let mentionTotal = 0;
  if (person.bodySearchTerms && person.bodySearchTerms.length > 0) {
    const bodyTerms = person.bodySearchTerms;
    const personCountries = (person.countries || []).filter((c) => c !== "Africa");

    // Find body mentions, exclude emails already in Section 1
    const bodyConditions = bodyTerms
      .map(() => "LOWER(body) LIKE ?")
      .join(" OR ");
    const bodyParams = bodyTerms.map((t) => `%${t.toLowerCase()}%`);

    const senderExclude = termConditions;
    const senderExcludeParams = [...sqlParams];

    const candidateRows = db
      .prepare(
        `SELECT id, sender, subject, sent_at, countries, epstein_is_sender, body
         FROM emails
         WHERE COALESCE(is_promotional, 0) = 0
           AND (${bodyConditions})
           AND NOT (${senderExclude})
         ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
      )
      .all(...bodyParams, ...senderExcludeParams);

    // Noise filter: name appears 2+ times in body, OR email country overlaps with person countries
    const filtered = candidateRows.filter((row) => {
      const bodyLower = (row.body || "").toLowerCase();
      let nameCount = 0;
      for (const term of bodyTerms) {
        const re = new RegExp(term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const matches = bodyLower.match(re);
        if (matches) nameCount += matches.length;
      }
      if (nameCount >= 2) return true;

      if (personCountries.length > 0 && row.countries) {
        const emailCountries = row.countries.split(",").map((c) => c.trim());
        if (personCountries.some((pc) => emailCountries.includes(pc))) return true;
      }

      return false;
    });

    mentionTotal = filtered.length;
    mentionEmails = filtered.slice(0, LIMIT).map(({ body, ...rest }) => rest);
  }

  return {
    props: {
      person: localizedPerson,
      emails,
      total,
      page,
      mentionEmails,
      mentionTotal,
      locale: normalizedLocale,
      frAvailable: hasFrenchPerson(person),
    },
  };
}

export default function PersonProfile({ person: ssrPerson, emails: ssrEmails, total: ssrTotal, page: ssrPage, mentionEmails: ssrMentionEmails, mentionTotal: ssrMentionTotal, locale, frAvailable }) {
  const router = useRouter();
  const t = PEOPLE_COPY[locale] || PEOPLE_COPY.en;
  const [page, setPage] = useState(ssrPage);
  const [data, setData] = useState({ person: ssrPerson, emails: ssrEmails, total: ssrTotal });
  const [error, setError] = useState(null);

  // Client-side fetch for page changes after initial SSR load
  useEffect(() => {
    if (page === ssrPage) return;
    fetch(`/api/people/${ssrPerson.slug}?page=${page}&limit=${LIMIT}&locale=${encodeURIComponent(locale)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load."));
  }, [locale, page, ssrPage, ssrPerson.slug]);

  const person = data?.person;
  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const pageUrl = person ? `/people/${person.slug}` : "/people";
  const localizedPageUrl = getLocalizedPath(pageUrl, locale);
  const backHref = resolveBackHref(router.query.back, "/people", locale);

  const jsonLd = person ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    jobTitle: person.title,
    description: person.bio,
    url: getCanonicalUrl(pageUrl, locale),
  } : null;

  return (
    <>
      <Head>
        <title>{person ? `${person.name} — Epstein Africa` : "Epstein Africa"}</title>
        {person && (
          <>
            <meta name="description" content={`${person.title}. ${person.bio.slice(0, 150)}...`} />
            <link rel="canonical" href={getCanonicalUrl(pageUrl, locale)} />
            <meta property="og:title" content={`${person.name} — Epstein Africa`} />
            <meta property="og:description" content={person.title} />
            <meta property="og:url" content={getCanonicalUrl(pageUrl, locale)} />
            <meta property="og:type" content="profile" />
            <meta property="og:locale" content={getOgLocale(locale)} />
            <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(person.name)}&subtitle=${encodeURIComponent(person.title)}&type=person`} />
            {frAvailable && locale === "en" && (
              <link rel="alternate" hrefLang="fr" href={getCanonicalUrl(pageUrl, "fr")} />
            )}
            {frAvailable && locale === "fr" && (
              <link rel="alternate" hrefLang="en" href={getCanonicalUrl(pageUrl, "en")} />
            )}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
          </>
        )}
      </Head>

      <div className="container">
        <Nav pagePath={pageUrl} frAvailable={frAvailable} />
        <Link className="back-btn" href={backHref} locale={false}>← {t.back}</Link>

        {error && <p className="error-msg">{t.loadFailed}</p>}
        {!data && !error && <p className="loading-msg">{t.loading}</p>}

        {person && (
          <>
            <header className="site-header">
              <h1>{person.name}</h1>
              <p className="subtitle">{person.title}</p>
              <ShareButtons path={pageUrl} title={person.name} summary={person.title} locale={locale} />
            </header>

            <div className="profile-body">
              <section className="profile-bio">
                <p>{person.bio}</p>
              </section>

              <div className="profile-meta-row">
                <div className="profile-countries">
                  {person.countries.map((c) => (
                    <span key={c} className="tag">
                      {getLocalizedCountryLabel(c, locale)}
                    </span>
                  ))}
                </div>
              </div>

              <section className="profile-emails">
                <h2 className="section-heading">
                  {t.emailsHeading} ({total})
                </h2>

                <div className="table-wrap">
                  <table className="email-table">
                    <thead>
                      <tr>
                        <th className="col-date">{t.thDate}</th>
                        <th className="col-sender">{t.thSender}</th>
                        <th className="col-subject">{t.thSubject}</th>
                        <th className="col-countries">{t.thCountries}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emails.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="loading-cell">
                            {t.noEmails}
                          </td>
                        </tr>
                      ) : (
                        emails.map((email) => (
                          <tr
                            key={email.id}
                            className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                            onClick={() =>
                              router.push(
                                `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(localizedPageUrl)}`
                                ,
                                undefined,
                                { locale }
                              )
                            }
                          >
                            <td className="col-date">
                              {formatDate(email.sent_at)}
                            </td>
                            <td className="col-sender">
                              {cleanSender(email.sender)}
                            </td>
                            <td className="col-subject">
                              {email.subject || t.noSubject}
                            </td>
                            <td className="col-countries">
                              {email.countries
                                ? splitCountries(email.countries).map((c) => (
                                    <span key={c} className="tag">
                                      {getLocalizedCountryLabel(c, locale)}
                                    </span>
                                  ))
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                      aria-label={t.prevPage}
                    >
                      ← {t.prevPage}
                    </button>
                    <span>
                      {t.pageOf} {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      aria-label={t.nextPage}
                    >
                      {t.nextPage} →
                    </button>
                  </div>
                )}
              </section>

              {ssrMentionEmails && ssrMentionEmails.length > 0 && (
                <section className="profile-emails">
                  <h2 className="section-heading">
                    {t.mentionHeading} {person.name} ({ssrMentionTotal})
                  </h2>
                  <p className="mention-note">
                    {person.name} {t.mentionNote}
                  </p>

                  <div className="table-wrap">
                    <table className="email-table">
                      <thead>
                        <tr>
                          <th className="col-date">{t.thDate}</th>
                          <th className="col-sender">{t.thSender}</th>
                          <th className="col-subject">{t.thSubject}</th>
                          <th className="col-countries">{t.thCountries}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ssrMentionEmails.map((email) => (
                          <tr
                            key={email.id}
                            className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                            onClick={() =>
                              router.push(
                                `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(localizedPageUrl)}`,
                                undefined,
                                { locale }
                              )
                            }
                          >
                            <td className="col-date">
                              {formatDate(email.sent_at)}
                            </td>
                            <td className="col-sender">
                              {cleanSender(email.sender)}
                            </td>
                            <td className="col-subject">
                              {email.subject || t.noSubject}
                            </td>
                            <td className="col-countries">
                              {email.countries
                                ? splitCountries(email.countries).map((c) => (
                                    <span key={c} className="tag">
                                      {getLocalizedCountryLabel(c, locale)}
                                    </span>
                                  ))
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </>
        )}

        <Footer locale={locale} />
      </div>
    </>
  );
}
