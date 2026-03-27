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

const BASE = "https://epstein-africa.vercel.app";

const LIMIT = 25;

export async function getStaticPaths() {
  return {
    paths: PEOPLE.map((p) => ({ params: { slug: p.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const person = getPersonBySlug(params.slug);
  if (!person) return { notFound: true };

  const db = getDb();
  const page = 1;
  const offset = 0;

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

  return { props: { person, emails, total, page } };
}

export default function PersonProfile({ person: ssrPerson, emails: ssrEmails, total: ssrTotal, page: ssrPage }) {
  const router = useRouter();
  const [page, setPage] = useState(ssrPage);
  const [data, setData] = useState({ person: ssrPerson, emails: ssrEmails, total: ssrTotal });
  const [error, setError] = useState(null);

  // Client-side fetch for page changes after initial SSR load
  useEffect(() => {
    if (page === ssrPage) return;
    fetch(`/api/people/${ssrPerson.slug}?page=${page}&limit=${LIMIT}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Failed to load."));
  }, [page]);

  const person = data?.person;
  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);
  const pageUrl = person ? `/people/${person.slug}` : "/people";

  const jsonLd = person ? {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    jobTitle: person.title,
    description: person.bio,
    url: `${BASE}${pageUrl}`,
  } : null;

  return (
    <>
      <Head>
        <title>{person ? `${person.name} — Epstein Africa` : "Epstein Africa"}</title>
        {person && (
          <>
            <meta name="description" content={`${person.title}. ${person.bio.slice(0, 150)}...`} />
            <link rel="canonical" href={`${BASE}${pageUrl}`} />
            <meta property="og:title" content={`${person.name} — Epstein Africa`} />
            <meta property="og:description" content={person.title} />
            <meta property="og:url" content={`${BASE}${pageUrl}`} />
            <meta property="og:type" content="profile" />
            <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(person.name)}&subtitle=${encodeURIComponent(person.title)}&type=person`} />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
          </>
        )}
      </Head>

      <div className="container">
        <Nav />
        <button className="back-btn" onClick={() => router.back()}>← Back</button>

        {error && <p className="error-msg">{error}</p>}
        {!data && !error && <p className="loading-msg">Loading…</p>}

        {person && (
          <>
            <header className="site-header">
              <h1>{person.name}</h1>
              <p className="subtitle">{person.title}</p>
              <ShareButtons path={pageUrl} title={person.name} summary={person.title} />
            </header>

            <div className="profile-body">
              <section className="profile-bio">
                <p>{person.bio}</p>
              </section>

              <div className="profile-meta-row">
                <div className="profile-countries">
                  {person.countries.map((c) => (
                    <span key={c} className="tag">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <section className="profile-emails">
                <h2 className="section-heading">
                  Emails ({total})
                </h2>

                <div className="table-wrap">
                  <table className="email-table">
                    <thead>
                      <tr>
                        <th className="col-date">Date</th>
                        <th className="col-sender">Sender</th>
                        <th className="col-subject">Subject</th>
                        <th className="col-countries">Countries</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emails.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="loading-cell">
                            No emails found.
                          </td>
                        </tr>
                      ) : (
                        emails.map((email) => (
                          <tr
                            key={email.id}
                            className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                            onClick={() =>
                              router.push(
                                `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(router.asPath)}`
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
                              {email.subject || "(no subject)"}
                            </td>
                            <td className="col-countries">
                              {email.countries
                                ? splitCountries(email.countries).map((c) => (
                                    <span key={c} className="tag">
                                      {c}
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
                      aria-label="Previous page"
                    >
                      ← Prev
                    </button>
                    <span>
                      Page {page} / {totalPages}
                    </span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      aria-label="Next page"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </section>
            </div>
          </>
        )}

        <Footer />
      </div>
    </>
  );
}
