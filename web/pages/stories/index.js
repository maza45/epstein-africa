import { useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { STORIES } from "../../lib/stories";

const BASE = "https://epstein-africa.vercel.app";

const ALL_COUNTRIES = [
  ...new Set(STORIES.flatMap((s) => s.countries)),
].sort();

export default function StoriesIndex() {
  const [country, setCountry] = useState(null);

  const filtered = useMemo(
    () =>
      country
        ? STORIES.filter((s) => s.countries.includes(country))
        : STORIES,
    [country]
  );

  return (
    <>
      <Head>
        <title>Stories \u2014 Epstein Africa</title>
        <meta
          name="description"
          content="Investigative narratives drawn from Epstein's Africa-related email archive."
        />
        <link rel="canonical" href={`${BASE}/stories`} />
        <meta property="og:title" content="Stories \u2014 Epstein Africa" />
        <meta property="og:description" content="Investigative narratives drawn from Epstein's Africa-related email archive." />
        <meta property="og:url" content={`${BASE}/stories`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent("Stories")}&subtitle=${encodeURIComponent("Investigative narratives from the email archive")}`} />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>Stories</h1>
          <p className="subtitle">
            Narratives drawn from the email archive. Each story is sourced
            directly from documented correspondence.
          </p>
        </header>

        <div className="country-filter">
          <button
            className={`filter-pill${country === null ? " active" : ""}`}
            onClick={() => setCountry(null)}
          >
            All
          </button>
          {ALL_COUNTRIES.map((c) => (
            <button
              key={c}
              className={`filter-pill${country === c ? " active" : ""}`}
              onClick={() => setCountry(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="stories-grid">
          {filtered.map((story) => (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="story-card"
            >
              <div className="story-date-range">{story.date_range}</div>
              <div className="story-title">{story.title}</div>
              <div className="story-summary">{story.summary}</div>
              <div className="story-countries">
                {story.countries.map((c) => (
                  <span key={c} className="tag">
                    {c}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <Footer />
      </div>
    </>
  );
}
