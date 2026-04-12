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

const BASE = "https://www.epsteinafrica.com";

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
  const requestedId = params.id;
  const email = db
    .prepare(
      `SELECT id, doc_id, sender, subject, to_recipients, sent_at,
              countries, release_batch, epstein_is_sender, all_participants, body
       FROM emails WHERE id = ?`
    )
    .get(requestedId);

  if (!email) {
    // Compatibility redirect for stale bare doc_id URLs that were crawled
    // before canonical row ids ({doc_id}-N) became the public route format.
    const siblings = db
      .prepare(
        `SELECT id, sender, subject, sent_at, countries,
                substr(body, 1, 150) AS preview
         FROM emails
         WHERE doc_id = ?
         ORDER BY id ASC
        `
      )
      .all(requestedId);

    if (siblings.length === 1 && siblings[0].id !== requestedId) {
      return {
        redirect: {
          destination: `/emails/${encodeURIComponent(siblings[0].id)}`,
          permanent: true,
        },
      };
    }

    if (siblings.length > 1) {
      return {
        props: {
          ssrEmail: null,
          senderProfileSlug: null,
          siblingChoices: siblings,
          requestedId,
        },
      };
    }

    return { notFound: true };
  }
  const senderProfileSlug = findSenderSlug(email.sender);
  return { props: { ssrEmail: email, senderProfileSlug, siblingChoices: [], requestedId } };
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

export default function EmailDetail({ ssrEmail, senderProfileSlug, siblingChoices = [], requestedId }) {
  const router = useRouter();
  const [email] = useState(ssrEmail);
  const error = null;
  const isChooser = !email && siblingChoices.length > 1;

  const participants = email ? parseParticipants(email.all_participants) : [];

  const title = isChooser
    ? `Multiple Email Records — Epstein Africa`
    : email
      ? `${email.subject || "(no subject)"} — Epstein Africa`
      : "Epstein Africa";
  const description = email
    ? `Email from ${email.sender || "Unknown"} — ${email.sent_at ? new Date(email.sent_at).toLocaleDateString("en-GB") : "undated"}${email.countries ? ` — ${email.countries}` : ""}`
    : isChooser
      ? `The pasted email link "${requestedId}" matches multiple records. Choose the correct email record.`
      : "";
  const pageUrl = email ? `/emails/${encodeURIComponent(email.id)}` : `/emails/${encodeURIComponent(requestedId || "")}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {!isChooser && <link rel="canonical" href={`${BASE}${pageUrl}`} />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {!isChooser && <meta property="og:url" content={`${BASE}${pageUrl}`} />}
        <meta property="og:type" content="article" />
        {!isChooser && (
          <meta
            property="og:image"
            content={`${BASE}/api/og?title=${encodeURIComponent(email?.subject || "Email")}&subtitle=${encodeURIComponent(description)}`}
          />
        )}
        {isChooser && <meta name="robots" content="noindex" />}
      </Head>

      <div className="container">
        <Nav />
        <a
          className="back-btn"
          href={(() => {
            const raw = router.query.back ? decodeURIComponent(router.query.back) : "/";
            try {
              const url = new URL(raw, "https://www.epsteinafrica.com");
              if (url.origin !== "https://www.epsteinafrica.com") return "/";
            } catch { /* relative paths are fine */ }
            return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
          })()}
        >
          ← Back
        </a>

        {error && <p className="error-msg">{error}</p>}

        {!email && !error && !isChooser && <p className="loading-msg">Loading…</p>}

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

        {isChooser && (
          <article className="email-detail">
            <header className="detail-header">
              <h1 className="detail-subject">Multiple Email Records</h1>
              <p className="story-lede">
                The link you opened matches multiple email records for document <span className="mono">{requestedId}</span>.
                Choose the record you want to view.
              </p>
            </header>

            <section className="story-section">
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
                    {siblingChoices.map((choice) => (
                      <tr
                        key={choice.id}
                        className="clickable-row"
                        onClick={() =>
                          router.push(
                            `/emails/${encodeURIComponent(choice.id)}?back=${encodeURIComponent(router.asPath)}`
                          )
                        }
                      >
                        <td className="col-date">{formatDateTime(choice.sent_at)}</td>
                        <td className="col-sender">{choice.sender || "Unknown"}</td>
                        <td className="col-subject">
                          <div>{choice.subject || "(no subject)"}</div>
                          {choice.preview && <div className="chooser-preview">{choice.preview}</div>}
                        </td>
                        <td className="col-countries">
                          {choice.countries
                            ? splitCountries(choice.countries).map((c) => (
                                <span key={c} className="tag">{c}</span>
                              ))
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </article>
        )}

        <Footer />
      </div>
    </>
  );
}
