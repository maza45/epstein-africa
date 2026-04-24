import Head from "next/head";
import Link from "next/link";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { getDb } from "../lib/db";
import { STORIES } from "../lib/stories";
import { splitCountries } from "../lib/format";
import {
  BASE,
  HOME_COPY,
  getCanonicalUrl,
  getLocalizedStory,
  getOgLocale,
  hasFrenchStaticPage,
  hasFrenchStory,
  normalizeLocale,
} from "../lib/i18n";

const LONGREAD_IMG_CLASS = {
  "sultan-africa-ports-decade": "mag-lr-card-img--topo",
  "wade-senegal-laboratory": "mag-lr-card-img--grid",
  "nikolic-gates-polio-backchannel": "mag-lr-card-img--dots",
  "ivory-coast-ouattara-bridge": "mag-lr-card-img--stripes",
  "libya-access-pipeline": "mag-lr-card-img--topo",
  "siad-trafficking-scouts": "mag-lr-card-img--dots",
};

const CURATED_SENDERS = [
  { name: "Nina Keita", initials: "NK", pattern: "Nina K", slug: "nina-keita" },
  {
    name: "Sultan Bin Sulayem",
    initials: "SB",
    pattern: "Sultan Bin Sulayem",
    slug: "sultan-bin-sulayem",
  },
  { name: "Mark Lloyd", initials: "ML", pattern: "Mark Lloyd", slug: "mark-lloyd" },
  {
    name: "Boris Nikolic",
    initials: "BN",
    pattern: "Boris Nikolic",
    slug: "boris-nikolic",
  },
  {
    name: "Ariane de Rothschild",
    initials: "AR",
    pattern: "Rothschild",
    slug: "ariane-de-rothschild",
  },
  { name: "Jabor Al Thani", initials: "JA", pattern: "Jabor", slug: "jabor-al-thani" },
];

function countryCodeFor(name) {
  const map = {
    Angola: "AO",
    Benin: "BJ",
    "Burkina Faso": "BF",
    Cameroon: "CM",
    "Central African Republic: ": "CF",
    "Central African Republic": "CF",
    Congo: "CG",
    "DR Congo": "CD",
    DRC: "CD",
    "Côte d'Ivoire": "CI",
    "Ivory Coast": "CI",
    Djibouti: "DJ",
    Egypt: "EG",
    "Equatorial Guinea": "GQ",
    Eritrea: "ER",
    Ethiopia: "ET",
    Gabon: "GA",
    Ghana: "GH",
    Kenya: "KE",
    Libya: "LY",
    Mali: "ML",
    Morocco: "MA",
    Mozambique: "MZ",
    Niger: "NE",
    Nigeria: "NG",
    Rwanda: "RW",
    Senegal: "SN",
    Somalia: "SO",
    Somaliland: "SO",
    "South Africa": "ZA",
    "South Sudan": "SS",
    Sudan: "SD",
    Tanzania: "TZ",
    Tunisia: "TN",
    Uganda: "UG",
    Zambia: "ZM",
    Zimbabwe: "ZW",
    Africa: "AF",
  };
  return map[name] || name.slice(0, 2).toUpperCase();
}

export async function getStaticProps({ locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const frAvailable = hasFrenchStaticPage("home");
  if (normalizedLocale === "fr" && !frAvailable) {
    return { notFound: true };
  }

  const db = getDb();

  const emailCount = db
    .prepare("SELECT COUNT(*) AS n FROM emails WHERE COALESCE(is_promotional, 0) = 0")
    .get().n;

  const countryRows = db
    .prepare(
      "SELECT DISTINCT countries FROM emails WHERE COALESCE(is_promotional, 0) = 0 AND countries IS NOT NULL"
    )
    .all();
  const countrySet = new Set();
  for (const row of countryRows) {
    for (const c of splitCountries(row.countries)) countrySet.add(c);
  }

  const sourceStories =
    normalizedLocale === "fr" ? STORIES.filter(hasFrenchStory) : STORIES;

  const longreadsRaw = sourceStories.filter((s) => s.kind === "longread");
  const longreads = longreadsRaw.map((story) => {
    const localized = getLocalizedStory(story, normalizedLocale);
    return {
      slug: localized.slug,
      title: localized.title,
      summary: localized.summary,
      countries: localized.countries,
      countryCodes: localized.countries.map(countryCodeFor).slice(0, 5),
      dateRange: (localized.date_range || "").replace(/–/g, " — "),
      emailCount: Array.isArray(story.email_ids) ? story.email_ids.length : 0,
      imgClass: LONGREAD_IMG_CLASS[localized.slug] || "mag-lr-card-img--grid",
    };
  });

  const atomicsAll = sourceStories.filter((s) => s.kind !== "longread");
  const atomicsRecent = atomicsAll.slice(-6).reverse().map((story, idx) => {
    const localized = getLocalizedStory(story, normalizedLocale);
    return {
      num: String(idx + 1).padStart(2, "0"),
      slug: localized.slug,
      title: localized.title,
      sub: `${localized.date_range || ""} · ${localized.countries.join(", ")}`,
      countryCodes: localized.countries.map(countryCodeFor).slice(0, 4),
    };
  });

  const figures = CURATED_SENDERS.map((s) => {
    const row = db
      .prepare(
        "SELECT COUNT(*) AS n FROM emails WHERE COALESCE(is_promotional, 0) = 0 AND sender LIKE ?"
      )
      .get(`%${s.pattern}%`);
    return { ...s, count: row.n };
  })
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    props: {
      emailCount,
      countryCount: countrySet.size,
      storyCount: sourceStories.length,
      atomicsCount: atomicsAll.length,
      longreads,
      atomicsRecent,
      figures,
      locale: normalizedLocale,
      frAvailable,
    },
  };
}

export default function Home({
  emailCount,
  countryCount,
  storyCount,
  atomicsCount,
  longreads,
  atomicsRecent,
  figures,
  locale,
  frAvailable,
}) {
  const copy = HOME_COPY[locale] || HOME_COPY.en;
  const hero = longreads[0];
  const second = longreads[1];
  const rest = longreads.slice(2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Epstein Africa",
    description: copy.description,
    url: BASE,
    publisher: { "@type": "Organization", name: "Epstein Africa", url: BASE },
  };

  return (
    <>
      <Head>
        <title>{copy.title}</title>
        <meta name="description" content={copy.description} />
        <link rel="canonical" href={getCanonicalUrl("/", locale)} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={copy.description} />
        <meta property="og:url" content={getCanonicalUrl("/", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta
          property="og:image"
          content={`${BASE}/api/og?title=${encodeURIComponent(copy.headline)}&subtitle=${encodeURIComponent(copy.ogSubtitle)}`}
        />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl("/", "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl("/", "en")} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <header className="site-masthead">
        <div className="site-masthead-inner">
          <Link href="/" locale={locale} className="mast-brand">
            <span className="mast-logo">{copy.brand}</span>
            <span className="mast-tagline">{copy.tagline}</span>
          </Link>
          <Nav pagePath="/" frAvailable={frAvailable} />
        </div>
      </header>

      <div className="magazine">
        <section className="issue-header">
          <div className="issue-meta">
            <span>{copy.metaLeft}</span>
            <span>{copy.metaRight}</span>
          </div>
          <h1 className="issue-title">
            {copy.headline} <em>{copy.headlineEm}</em>
          </h1>
          <p className="issue-subtitle">{copy.subhead}</p>
          <div className="issue-stats">
            <div className="issue-stat">
              <span className="issue-stat-num">{emailCount.toLocaleString()}</span>
              <span className="issue-stat-label">{copy.statEmailsLabel}</span>
            </div>
            <div className="issue-stat">
              <span className="issue-stat-num">{storyCount}</span>
              <span className="issue-stat-label">{copy.statStoriesLabel}</span>
            </div>
            <div className="issue-stat">
              <span className="issue-stat-num">{countryCount}</span>
              <span className="issue-stat-label">{copy.statCountriesLabel}</span>
            </div>
          </div>
        </section>

        {hero && (
          <section className="feature-grid">
            <Link href={`/stories/${hero.slug}`} locale={locale} className="feat-hero">
              <div className="feat-hero-img">
                <div className="feat-hero-img-inner">
                  <span className="feat-hero-img-label">◉ {hero.dateRange}</span>
                </div>
              </div>
              <div className="feat-kicker">
                {copy.leadKicker} · {hero.dateRange}
              </div>
              <h2 className="feat-hero-title">{hero.title}</h2>
              <p className="feat-hero-dek">{hero.summary}</p>
              <div className="feat-byline">
                <span>{hero.emailCount} emails</span>
                <span className="byline-sep">·</span>
                <span className="byline-countries">
                  {hero.countryCodes.map((c) => (
                    <span key={c} className="byline-country">
                      {c}
                    </span>
                  ))}
                </span>
              </div>
            </Link>

            {second && (
              <div className="feat-side">
                <Link
                  href={`/stories/${second.slug}`}
                  locale={locale}
                  className="feat-second"
                >
                  <div className="feat-second-img feat-second-img--grid" aria-hidden="true" />
                  <div className="feat-kicker">{second.dateRange}</div>
                  <h3 className="feat-second-title">{second.title}</h3>
                  <p className="feat-second-dek">{second.summary}</p>
                  <div className="feat-byline">
                    <span>{second.emailCount} emails</span>
                    <span className="byline-sep">·</span>
                    <span className="byline-countries">
                      {second.countryCodes.map((c) => (
                        <span key={c} className="byline-country">
                          {c}
                        </span>
                      ))}
                    </span>
                  </div>
                </Link>

                <div className="doc-excerpt">
                  <span className="doc-excerpt-label">{copy.exhibitLabel}</span>
                  <p>
                    &ldquo;I am good friends with{" "}
                    <span className="redacted">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </span>{" "}
                    as well as many of the more normal leaders. Boris told me of your
                    interest in africa. I am going to see the president of the{" "}
                    <span className="redacted">
                      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    </span>{" "}
                    in abdigan and spend a couple of days with him and his top
                    ministers. I wanted to know if there was something i could do to
                    help you there.&rdquo;
                  </p>
                  <div className="doc-excerpt-foot">
                    <span>{copy.exhibitFrom}</span>
                    <span>{copy.exhibitDate}</span>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        <div className="mag-section-head">
          <span className="mag-section-head-title">{copy.sectionHeadLongreads}</span>
        </div>

        <section className="longreads-grid-magazine">
          {longreads.map((lr) => (
            <Link
              key={lr.slug}
              href={`/stories/${lr.slug}`}
              locale={locale}
              className="mag-lr-card"
            >
              <div className={`mag-lr-card-img ${lr.imgClass}`} aria-hidden="true" />
              <div className="mag-lr-card-label">{lr.dateRange}</div>
              <div className="mag-lr-card-title">{lr.title}</div>
              <div className="mag-lr-card-dek">{lr.summary}</div>
              <div className="mag-lr-card-meta">
                <span>
                  {lr.countries.slice(0, 3).join(", ")}
                  {lr.countries.length > 3 ? "…" : ""}
                </span>
                <span>{lr.emailCount} emails</span>
              </div>
            </Link>
          ))}
        </section>

        <section className="dual-col">
          <div>
            <div className="mag-section-head">
              <span className="mag-section-head-title">{copy.sectionHeadAtomics}</span>
              <Link
                href="/stories"
                locale={locale}
                className="mag-section-head-link"
              >
                {copy.sectionHeadAtomicsLink.replace("{count}", atomicsCount)}
              </Link>
            </div>
            <div className="dossier-list">
              {atomicsRecent.map((a) => (
                <Link
                  key={a.slug}
                  href={`/stories/${a.slug}`}
                  locale={locale}
                  className="dossier-row"
                >
                  <span className="dossier-num">№ {a.num}</span>
                  <div className="dossier-body-col">
                    <div className="dossier-title">{a.title}</div>
                    <div className="dossier-sub">{a.sub}</div>
                  </div>
                  <div className="dossier-countries">
                    {a.countryCodes.map((c) => (
                      <span key={c} className="dossier-country">
                        {c}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="figures-side">
            <div className="mag-section-head">
              <span className="mag-section-head-title">{copy.sectionHeadFigures}</span>
            </div>
            {figures.map((f) => (
              <Link
                key={f.slug}
                href={`/people/${f.slug}`}
                locale={locale}
                className="figure-row"
              >
                <div className="figure-avatar">{f.initials}</div>
                <div className="figure-body">
                  <div className="figure-name">{f.name}</div>
                  <div className="figure-title">{f.pattern}</div>
                </div>
                <div className="figure-count">{f.count}</div>
              </Link>
            ))}

            <div className="doc-excerpt" style={{ marginTop: "1.5rem" }}>
              <span className="doc-excerpt-label">{copy.methodLabel}</span>
              <p>{copy.methodBody}</p>
            </div>
          </div>
        </section>
      </div>

      <Footer locale={locale} />
    </>
  );
}
