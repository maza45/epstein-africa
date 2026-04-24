import { useState, useMemo } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import { STORIES } from "../../lib/stories";
import {
  BASE,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getLocalizedStory,
  getOgLocale,
  hasFrenchStaticPage,
  hasFrenchStory,
  normalizeLocale,
  STORY_COPY,
} from "../../lib/i18n";

export async function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("stories");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const sourceStories = normalizedLocale === "fr" ? STORIES.filter(hasFrenchStory) : STORIES;
  const stories = sourceStories.map((story) => {
    const localized = getLocalizedStory(story, normalizedLocale);
    return {
      slug: localized.slug,
      title: localized.title,
      summary: localized.summary,
      countries: localized.countries,
      date_range: localized.date_range,
      kind: story.kind || "atomic",
    };
  });
  const allCountries = [...new Set(sourceStories.flatMap((s) => s.countries))].sort();
  const longreads = stories.filter((s) => s.kind === "longread");
  return { props: { stories, allCountries, longreads, locale: normalizedLocale, frAvailable } };
}

export default function StoriesIndex({ stories, allCountries, longreads, locale, frAvailable }) {
  const t = STORY_COPY[locale] || STORY_COPY.en;
  const [country, setCountry] = useState(null);

  const filtered = useMemo(
    () => {
      const base = country
        ? stories.filter((s) => s.countries.includes(country))
        : stories.filter((s) => s.kind !== "longread");
      return base;
    },
    [country, stories]
  );

  return (
    <>
      <Head>
        <title>{t.indexTitle}</title>
        <meta name="description" content={t.indexDescription} />
        <link rel="canonical" href={getCanonicalUrl("/stories", locale)} />
        <meta property="og:title" content={t.indexTitle} />
        <meta property="og:description" content={t.indexDescription} />
        <meta property="og:url" content={getCanonicalUrl("/stories", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(t.indexHeading)}&subtitle=${encodeURIComponent(t.ogSubtitle)}`} />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/stories", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/stories", "en")} />
        )}
      </Head>

      <div className="container">
        <Nav pagePath="/stories" frAvailable={frAvailable} />
        <header className="site-header">
          <h1>{t.indexHeading}</h1>
          <p className="subtitle">{t.indexSubtitle}</p>
        </header>

        <div className="country-filter">
          <button
            className={`filter-pill${country === null ? " active" : ""}`}
            onClick={() => setCountry(null)}
          >
            {t.filterAll}
          </button>
          {allCountries.map((c) => (
            <button
              key={c}
              className={`filter-pill${country === c ? " active" : ""}`}
              onClick={() => setCountry(c)}
            >
              {getLocalizedCountryLabel(c, locale)}
            </button>
          ))}
        </div>

        {!country && longreads.length > 0 && (
          <section className="longreads">
            <h2 className="longreads-heading">{t.longreadsHeading}</h2>
            <p className="longreads-subtitle">{t.longreadsSubtitle}</p>
            <div className="longreads-grid">
              {longreads.map((story) => (
                <Link
                  key={story.slug}
                  href={`/stories/${story.slug}`}
                  locale={locale}
                  className="story-card longread-card"
                >
                  <div className="story-date-range">{story.date_range}</div>
                  <div className="story-title">{story.title}</div>
                  <div className="story-summary">{story.summary}</div>
                  <div className="story-countries">
                    {story.countries.map((c) => (
                      <span key={c} className="tag">
                        {getLocalizedCountryLabel(c, locale)}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <h2 className="all-stories-heading">
          {country
            ? `${t.storiesLabel}: ${getLocalizedCountryLabel(country, locale)}`
            : t.allStories}
        </h2>

        <div className="stories-grid">
          {filtered.map((story) => (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              locale={locale}
              className="story-card"
            >
              <div className="story-date-range">{story.date_range}</div>
              <div className="story-title">{story.title}</div>
              <div className="story-summary">{story.summary}</div>
              <div className="story-countries">
                {story.countries.map((c) => (
                  <span key={c} className="tag">
                    {getLocalizedCountryLabel(c, locale)}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <Footer locale={locale} />
      </div>
    </>
  );
}
