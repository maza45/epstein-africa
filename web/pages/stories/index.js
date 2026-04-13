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

const CORE_SLUGS = [
  "ivory-coast-surveillance",
  "libya-sovereign-wealth",
  "nikolic-gates-back-channel",
  "wade-dc-lobbying",
  "shaher-abdulhak-yemen-back-channel",
  "sultan-scouting-operation",
  "siad-cape-town-models",
  "marrakech-bin-ennakhil",
  "jagland-wade-echr",
];

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
    };
  });
  const allCountries = [...new Set(sourceStories.flatMap((s) => s.countries))].sort();
  const coreStories = CORE_SLUGS
    .map((slug) => stories.find((s) => s.slug === slug))
    .filter(Boolean);
  return { props: { stories, allCountries, coreStories, locale: normalizedLocale, frAvailable } };
}

export default function StoriesIndex({ stories, allCountries, coreStories, locale, frAvailable }) {
  const t = STORY_COPY[locale] || STORY_COPY.en;
  const [country, setCountry] = useState(null);

  const filtered = useMemo(
    () => {
      const base = country
        ? stories.filter((s) => s.countries.includes(country))
        : stories.filter((s) => !CORE_SLUGS.includes(s.slug));
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

        {!country && (
          <section className="core-stories">
            <h2 className="core-stories-heading">{t.startHereHeading}</h2>
            <p className="core-stories-subtitle">{t.startHereSubtitle}</p>
            <div className="core-stories-grid">
              {coreStories.map((story) => (
                <Link
                  key={story.slug}
                  href={`/stories/${story.slug}`}
                  locale={locale}
                  className="story-card core-card"
                >
                  <div className="story-date-range">{story.date_range}</div>
                  <div className="story-title">{story.title}</div>
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
