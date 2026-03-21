import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import { PEOPLE } from "../../lib/people";
import { getDb } from "../../lib/db";

export async function getServerSideProps() {
  const db = getDb();

  const counts = PEOPLE.map((person) => {
    const termConditions = person.searchTerms
      .map(() => "(LOWER(sender) LIKE ? OR LOWER(all_participants) LIKE ?)")
      .join(" OR ");
    const params = person.searchTerms.flatMap((t) => [`%${t}%`, `%${t}%`]);
    const row = db
      .prepare(
        `SELECT COUNT(*) as count FROM emails
         WHERE is_promotional = 0 AND (${termConditions})`
      )
      .get(...params);
    return { slug: person.slug, count: row.count };
  });

  const countMap = Object.fromEntries(counts.map((c) => [c.slug, c.count]));

  const sortedPeople = [...PEOPLE].sort(
    (a, b) => (countMap[b.slug] ?? 0) - (countMap[a.slug] ?? 0)
  );

  return {
    props: {
      people: sortedPeople.map((p) => ({ ...p, emailCount: countMap[p.slug] ?? 0 })),
    },
  };
}

export default function PeopleIndex({ people }) {
  return (
    <>
      <Head>
        <title>Key Persons — Epstein Africa</title>
        <meta
          name="description"
          content="Profiles of key persons documented in Epstein's Africa-related correspondence."
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>Key Persons</h1>
          <p className="subtitle">
            Individuals identified in Epstein&apos;s Africa-related
            correspondence. Profiles are based on documented email records only.
          </p>
        </header>

        <div className="people-grid">
          {people.map((person) => (
            <Link
              key={person.slug}
              href={`/people/${person.slug}`}
              className="person-card"
            >
              <div className="person-name">{person.name}</div>
              <div className="person-title">{person.title}</div>
              <div className="person-countries">
                {person.countries.slice(0, 4).map((c) => (
                  <span key={c} className="tag">
                    {c}
                  </span>
                ))}
                {person.countries.length > 4 && (
                  <span className="tag">+{person.countries.length - 4}</span>
                )}
              </div>
              {person.emailCount > 0 && (
                <div className="person-email-count">{person.emailCount} emails</div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
