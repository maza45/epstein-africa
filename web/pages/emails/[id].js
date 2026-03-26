import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import { PEOPLE } from "../../lib/people";
import { getDb } from "../../lib/db";

function formatDate(d) {
  if (!d) return "Unknown";
  return new Date(d).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function parseParticipants(raw) {
  if (!raw) return [];
  // Format: "name <email> ["recip1", "recip2"] [] []"
  // Extract all email-like tokens
  const emails = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || [];
  const names = raw.match(/^([^<[]+)/);
  const parts = new Set(emails);
  if (names) parts.add(names[1].trim());
  return [...parts].filter(Boolean);
}

// Derive sender-to-slug mapping from canonical PEOPLE array
const SENDER_SLUGS = PEOPLE.map((p) => ({
  fragments: p.searchTerms,
  slug: p.slug,
}));

function senderSlug(sender) {
  if (!sender) return null;
  const lower = sender.toLowerCase();
  for (const { fragments, slug } of SENDER_SLUGS) {
    if (fragments.some((f) => lower.includes(f))) return slug;
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
  return { props: { ssrEmail: email } };
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

export default function EmailDetail({ ssrEmail }) {
  const router = useRouter();
  const [email] = useState(ssrEmail);
  const error = null;

  const participants = email ? parseParticipants(email.all_participants) : [];

  const title = email ? `${email.subject || "(no subject)"} — Epstein Africa` : "Epstein Africa";
  const description = email
    ? `Email from ${email.sender || "Unknown"} — ${email.sent_at ? new Date(email.sent_at).toLocaleDateString("en-GB") : "undated"}${email.countries ? ` — ${email.countries}` : ""}`
    : "";

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="article" />
      </Head>

      <div className="container">
        <Nav />
        <a
          className="back-btn"
          href={(() => {
            const raw = router.query.back ? decodeURIComponent(router.query.back) : "/";
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
                <span className="date">{formatDate(email.sent_at)}</span>
                {email.epstein_is_sender === 1 && (
                  <span className="badge-epstein">Epstein sender</span>
                )}
              </div>
            </header>

            <div className="detail-fields">
              {email.sender && (
                <div className="field">
                  <div className="field-label">From</div>
                  <div className="field-value">
                    {senderSlug(email.sender) ? (
                      <Link href={`/people/${senderSlug(email.sender)}`}>
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
                    {email.countries.split(", ").map((c) => (
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
      </div>
    </>
  );
}
