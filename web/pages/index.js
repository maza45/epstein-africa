import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { getDb } from "../lib/db";
import { cleanSender, formatDate, splitCountries } from "../lib/format";

const BASE = "https://epstein-africa.vercel.app";

export async function getStaticProps() {
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

  return { props: { emailCount, countries } };
}

const LIMIT = 25;

export default function Home({ emailCount, countries }) {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const router = useRouter();

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

  const description = `Searchable database of Jeffrey Epstein's documented connections to Africa, sourced from DOJ Epstein Files Transparency Act releases. ${emailCount.toLocaleString()} verified emails.`;

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
        <title>Epstein Africa — Email Database</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={BASE} />
        <meta property="og:title" content="Epstein Africa — Email Database" />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={BASE} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent("Epstein Africa")}&subtitle=${encodeURIComponent(`${emailCount.toLocaleString()} verified emails from DOJ releases`)}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>Epstein Africa</h1>
          <p className="subtitle">
            Searchable database of Jeffrey Epstein&apos;s documented connections
            to Africa — {emailCount.toLocaleString()} verified emails, excluding promotional mail.{" "}
            <span className="source">
              Source: DOJ Epstein Files Transparency Act.
            </span>
          </p>
        </header>

        <div className="filters">
          <input
            type="text"
            className="search-input"
            placeholder="Search subject, sender…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search emails"
          />
          <select
            className="country-select"
            value={currentCountry}
            onChange={(e) => pushFilters({ page: 1, country: e.target.value })}
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="meta-row">
          <span className="result-count">
            {loading ? "Loading…" : `${total.toLocaleString()} emails`}
          </span>
          {(currentSearch || currentCountry) && (
            <button
              className="clear-btn"
              onClick={() => {
                setSearchInput("");
                pushFilters({ page: 1, country: "", search: "" });
              }}
            >
              Clear filters
            </button>
          )}
          <a href="/api/export?format=csv" className="download-btn" download>
            Download CSV
          </a>
        </div>

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
              {loading ? (
                <tr>
                  <td colSpan={4} className="loading-cell">
                    Loading…
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={4} className="loading-cell">
                    No results.
                  </td>
                </tr>
              ) : (
                emails.map((email) => (
                  <tr
                    key={email.id}
                    className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                    onClick={() => router.push(`/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(router.asPath)}`)}
                  >
                    <td className="col-date">{formatDate(email.sent_at)}</td>
                    <td className="col-sender">{cleanSender(email.sender)}</td>
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
              disabled={currentPage === 1}
              onClick={() => pushFilters({ page: currentPage - 1 })}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span>
              Page {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => pushFilters({ page: currentPage + 1 })}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}

        <Footer />
      </div>
    </>
  );
}
