import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Nav from "../components/Nav";

const COUNTRIES = [
  "Africa",
  "Angola",
  "Ethiopia",
  "Ghana",
  "Ivory Coast",
  "Kenya",
  "Morocco",
  "Mozambique",
  "Nigeria",
  "Rwanda",
  "Senegal",
  "Somalia",
  "South Africa",
  "Tanzania",
  "Zimbabwe",
];

const LIMIT = 25;

function cleanSender(sender) {
  if (!sender) return "—";
  const match = sender.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return sender.replace(/[<>]/g, "").trim();
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Initialise page from URL query param (e.g. when returning from detail page)
  const [page, setPage] = useState(() => {
    if (typeof window !== "undefined") {
      const p = parseInt(new URLSearchParams(window.location.search).get("page"));
      return p > 0 ? p : 1;
    }
    return 1;
  });

  // Debounce search input — also resets page
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: LIMIT });
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (country) params.set("country", country);
    try {
      const res = await fetch(`/api/emails?${params}`);
      const data = await res.json();
      setEmails(data.emails);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, country]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
      <Head>
        <title>Epstein Africa — Email Database</title>
        <meta
          name="description"
          content="Searchable database of Jeffrey Epstein's documented connections to Africa, sourced from DOJ Epstein Files Transparency Act releases."
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>Epstein Africa</h1>
          <p className="subtitle">
            Searchable database of Jeffrey Epstein&apos;s documented connections
            to Africa — 752 verified emails, excluding promotional mail.{" "}
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
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by country"
          >
            <option value="">All countries</option>
            {COUNTRIES.map((c) => (
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
          {(debouncedSearch || country) && (
            <button
              className="clear-btn"
              onClick={() => {
                setSearchInput("");
                setCountry("");
                setPage(1);
              }}
            >
              Clear filters
            </button>
          )}
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
                    onClick={() => router.push(`/emails/${encodeURIComponent(email.id)}?from=page=${page}`)}
                  >
                    <td className="col-date">{formatDate(email.sent_at)}</td>
                    <td className="col-sender">{cleanSender(email.sender)}</td>
                    <td className="col-subject">
                      {email.subject || "(no subject)"}
                    </td>
                    <td className="col-countries">
                      {email.countries
                        ? email.countries.split(", ").map((c) => (
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
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}

        <footer className="site-footer">
          <p>
            Public interest journalism. Free, ad-free, open source.{" "}
            <a
              href="https://github.com/Iskanenani/epstein-africa"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
