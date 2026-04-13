import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { getDb } from "../lib/db";
import { cleanSender, formatDate, splitCountries } from "../lib/format";
import {
  BASE,
  HOME_COPY,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getLocalizedPath,
  getOgLocale,
  hasFrenchStaticPage,
  normalizeLocale,
} from "../lib/i18n";

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

  const rows = db
    .prepare(
      "SELECT DISTINCT countries FROM emails WHERE COALESCE(is_promotional, 0) = 0 AND countries IS NOT NULL"
    )
    .all();

  const countrySet = new Set();
  for (const row of rows) {
    for (const c of splitCountries(row.countries)) {
      countrySet.add(c);
    }
  }
  // "Africa" pinned first, rest alphabetical
  const countries = [
    "Africa",
    ...Array.from(countrySet)
      .filter((c) => c !== "Africa")
      .sort(),
  ];

  return { props: { emailCount, countries, locale: normalizedLocale, frAvailable } };
}

const LIMIT = 25;

export default function Home({ emailCount, countries, locale, frAvailable }) {
  const copy = HOME_COPY[locale] || HOME_COPY.en;
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();
  const localizedAsPath = getLocalizedPath(router.asPath || "/", locale);

  // All filter state derived from URL
  const currentPage = parseInt(router.query.page) || 1;
  const currentCountry = router.query.country || "";
  const currentSearch = router.query.search || "";

  // Initialize search input from URL once router is ready (e.g. on back navigation)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (router.isReady && !initializedRef.current) {
      initializedRef.current = true;
      setSearchInput(router.query.search || "");
    }
  }, [router.isReady]);

  // Push all filter state to URL as a single operation
  const pushFilters = useCallback(({ page = 1, country = currentCountry, search = searchInput } = {}) => {
    const query = { page };
    if (country) query.country = country;
    if (search) query.search = search;
    router.push({ pathname: "/", query }, undefined, { shallow: true });
  }, [router, currentCountry, searchInput]);

  // Debounce search input → URL (skip if unchanged to avoid init loop)
  useEffect(() => {
    if (!router.isReady) return;
    if (searchInput === currentSearch) return;
    const t = setTimeout(() => pushFilters({ page: 1, search: searchInput }), 300);
    return () => clearTimeout(t);
  }, [searchInput, router.isReady, currentSearch, pushFilters]);

  // Fetch whenever URL-derived state changes
  const fetchEmails = useCallback(async () => {
    if (!router.isReady) return;
    setLoading(true);
    const params = new URLSearchParams({ page: currentPage, limit: LIMIT });
    if (currentSearch) params.set("q", currentSearch);
    if (currentCountry) params.set("country", currentCountry);
    try {
      const res = await fetch(`/api/emails?${params}`);
      const data = await res.json();
      setEmails(data.emails);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [router.isReady, currentPage, currentSearch, currentCountry]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const totalPages = Math.ceil(total / LIMIT);

  const description = `${copy.description} ${emailCount.toLocaleString()} ${copy.resultCount}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Epstein Africa Email Database",
    description,
    url: BASE,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: { "@type": "Organization", name: "Epstein Africa", url: BASE },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: `${BASE}/api/export?format=csv`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/json",
        contentUrl: `${BASE}/api/export?format=json`,
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{copy.title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={getCanonicalUrl("/", locale)} />
        <meta property="og:title" content={copy.title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={getCanonicalUrl("/", locale)} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(copy.heading)}&subtitle=${encodeURIComponent(`${emailCount.toLocaleString()} ${copy.ogSubtitle}`)}`} />
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

      <div className="container">
        <Nav pagePath="/" frAvailable={frAvailable} />
        <header className="site-header">
          <h1>{copy.heading}</h1>
          <p className="subtitle">
            {copy.subtitlePrefix} — {emailCount.toLocaleString()} {copy.subtitleSuffix}{" "}
            <span className="source">
              {copy.sourceLabel}
            </span>
          </p>
          <p className="site-statement">
            {copy.statement}
          </p>
        </header>

        <div className="filters">
          <input
            type="text"
            className="search-input"
            placeholder={copy.searchPlaceholder}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label={copy.searchAria}
          />
          <select
            className="country-select"
            value={currentCountry}
            onChange={(e) => pushFilters({ page: 1, country: e.target.value })}
            aria-label={copy.filterAria}
          >
            <option value="">{copy.filterAll}</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {getLocalizedCountryLabel(c, locale)}
              </option>
            ))}
          </select>
        </div>

        <div className="meta-row">
          <span className="result-count">
            {loading ? copy.loading : `${total.toLocaleString()} ${copy.resultCount}`}
          </span>
          {(currentSearch || currentCountry) && (
            <button
              className="clear-btn"
              onClick={() => {
                setSearchInput("");
                pushFilters({ page: 1, country: "", search: "" });
              }}
            >
              {copy.clearFilters}
            </button>
          )}
          <a href="/api/export?format=csv" className="download-btn" download>
            {copy.downloadCsv}
          </a>
        </div>

        <div className="table-wrap">
          <table className="email-table">
            <thead>
              <tr>
                <th className="col-date">{copy.thDate}</th>
                <th className="col-sender">{copy.thSender}</th>
                <th className="col-subject">{copy.thSubject}</th>
                <th className="col-countries">{copy.thCountries}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="loading-cell">
                    {copy.loading}
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={4} className="loading-cell">
                    {copy.noResults}
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr
                    key={email.id}
                    className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                    onClick={() =>
                      router.push(
                        `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(localizedAsPath)}`,
                        undefined,
                        { locale }
                      )
                    }
                  >
                    <td className="col-date">{formatDate(email.sent_at)}</td>
                    <td className="col-sender">{cleanSender(email.sender)}</td>
                    <td className="col-subject">
                      {email.subject || copy.noSubject}
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
              disabled={currentPage === 1}
              onClick={() => pushFilters({ page: currentPage - 1 })}
              aria-label={copy.previousPageAria}
            >
              ← {copy.prevPage}
            </button>
            <span>
              {copy.pageOf} {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => pushFilters({ page: currentPage + 1 })}
              aria-label={copy.nextPageAria}
            >
              {copy.nextPage} →
            </button>
          </div>
        )}

        <Footer locale={locale} />
      </div>
    </>
  );
}
