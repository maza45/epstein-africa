import { useRouter } from "next/router";
import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import ShareButtons from "../../components/ShareButtons";
import { PEOPLE } from "../../lib/people";
import { getDb } from "../../lib/db";
import { formatDateTime, splitCountries } from "../../lib/format";

const BASE = "https://epstein-africa.vercel.app";

function parseParticipants(raw) {
  if (!raw) return [];
  const emails = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  const names = raw.match(/^([^<[]+)/);
  const parts = new Set(emails);
  if (names) parts.add(names[1].trim());
  return [...parts].filter(Boolean);
}

function findSenderSlug(sender) {
  if (!sender) return null;
  const lower = sender.toLowerCase();
  for (const p of PEOPLE) {
    if (p.searchTerms.some((f) => lower.includes(f))) return p.slug;
  }
  return null;
}

export async function getServerSideProps({ params }) {
  const db = getDb();
  const email = db
    .prepare(
      `SELECT id, doc_id, sender, subject, to_recipients, sent_at,
              countries, release_batch, epstein_is_sender, all_participants, body
       FROM emails WHERE id = ?`
    )
    .get(params.id);
  if (!email) return { notFound: true };
  const senderProfileSlug = findSenderSlug(email.sender);
  return { props: { ssrEmail: email, senderProfileSlug } };
}

function Field({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className={`field-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

export default function EmailDetail({ ssrEmail, senderProfileSlug }) {
  const router = useRouter();
  const [email] = useState(ssrEmail);
  const error = null;

  const participants = email ? parseParticipants(email.all_participants) : [];

  const title = email ? `${email.subject || "(no subject)"} — Epstein Africa` : "Epstein Africa";
  const description = email
    ? `Email from ${email.sender || "Unknown"} — ${email.sent_at ? new Date(email.sent_at).toLocaleDateString("en-GB") : "undated"}${email.countries ? ` — ${email.countries}` : ""}`
    : "";
  const pageUrl = email ? `/emails/${encodeURIComponent(email.id)}` : "/";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={`${BASE}${pageUrl}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={`${BASE}${pageUrl}`} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(email?.subject || "Email")}&subtitle=${encodeURIComponent(description)}`} />
      </Head>

      <div className="container">
        <Nav />
        <a
          className="back-btn"
          href={(() => {
            const raw = router.query.back ? decodeURIComponent(router.query.back) : "/";
            try {
              const url = new URL(raw, "https://epstein-africa.vercel.app");
              if (url.origin !== "https://epstein-africa.vercel.app") return "/";
            } catch { /* relative paths are fine */ }
            return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
          })()}
        >
          ← Back
        </a>

        {error && <p className="error-msg">{error}</p>}

        {!email && !error && <p className="loading-msg">Loading…</p>}

        {email && (
          <article className="email-detail">
            <header className="detail-header">
              <h1 className="detail-subject">
                {email.subject || "(no subject)"}
              </h1>
              <div className="detail-meta">
                <span className="date">{formatDateTime(email.sent_at)}</span>
                {email.epstein_is_sender === 1 && (
                  <span className="badge-epstein">Epstein sender</span>
                )}
              </div>
              <ShareButtons path={pageUrl} title={email.subject || "Email"} summary={description} />
            </header>

            <div className="detail-fields">
              {email.sender && (
                <div className="field">
                  <div className="field-label">From</div>
                  <div className="field-value">
                    {senderProfileSlug ? (
                      <Link href={`/people/${senderProfileSlug}`}>
                        {email.sender}
                      </Link>
                    ) : (
                      email.sender
                    )}
                  </div>
                </div>
              )}
              <Field label="To" value={email.to_recipients} />

              {participants.length > 0 && (
                <div className="field">
                  <div className="field-label">All participants</div>
                  <div className="field-value participants">
                    {participants.map((p) => (
                      <span key={p} className="participant-tag">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {email.countries && (
                <div className="field">
                  <div className="field-label">Countries mentioned</div>
                  <div className="field-value">
                    {splitCountries(email.countries).map((c) => (
                      <span key={c} className="tag">{c}</span>
                    ))}
                  </div>
                </div>
              )}

              {email.body && (
                <div className="field">
                  <div className="field-label">Body</div>
                  <pre className="email-body">{email.body}</pre>
                </div>
              )}

              <Field label="Release batch" value={email.release_batch} />
              <Field label="Document ID" value={email.doc_id} mono />
              <Field label="Record ID" value={email.id} mono />

              {email.doc_id && (
                <div className="field">
                  <div className="field-label">Source</div>
                  <div className="field-value">
                    <a
                      href={`https://jmail.world/thread/${email.doc_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Jmail ↗
                    </a>
                  </div>
                </div>
              )}
            </div>
          </article>
        )}

        <Footer />
      </div>
    </>
  );
}
