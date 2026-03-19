import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import { PEOPLE } from "../../lib/people";

export default function PeopleIndex() {
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
          {PEOPLE.map((person) => (
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
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
