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
import {
  BASE,
  EMAIL_COPY,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getOgLocale,
  normalizeLocale,
} from "../../lib/i18n";

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

export async function getServerSideProps({ params, locale }) {
  const db = getDb();
  const requestedId = params.id;
  const normalizedLocale = normalizeLocale(locale);
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
      const dest = `/emails/${encodeURIComponent(siblings[0].id)}`;
      return {
        redirect: {
          destination: normalizedLocale === "fr" ? `/fr${dest}` : dest,
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
          locale: normalizedLocale,
        },
      };
    }

    return { notFound: true };
  }
  const senderProfileSlug = findSenderSlug(email.sender);
  return {
    props: {
      ssrEmail: email,
      senderProfileSlug,
      siblingChoices: [],
      requestedId,
      locale: normalizedLocale,
    },
  };
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

export default function EmailDetail({ ssrEmail, senderProfileSlug, siblingChoices = [], requestedId, locale }) {
  const router = useRouter();
  const copy = EMAIL_COPY[locale] || EMAIL_COPY.en;
  const [email] = useState(ssrEmail);
  const error = null;
  const isChooser = !email && siblingChoices.length > 1;

  const participants = email ? parseParticipants(email.all_participants) : [];

  const title = isChooser
    ? copy.chooserTitle
    : email
      ? `${email.subject || copy.noSubject} ${copy.pageTitleSuffix}`
      : "Epstein Africa";
  const description = email
    ? `${copy.descriptionPrefix} ${email.sender || copy.unknown} — ${email.sent_at ? new Date(email.sent_at).toLocaleDateString("en-GB") : copy.undated}${email.countries ? ` — ${email.countries}` : ""}`
    : isChooser
      ? copy.chooserDescription.replace("{requestedId}", requestedId)
      : "";
  const pageUrl = email ? `/emails/${encodeURIComponent(email.id)}` : `/emails/${encodeURIComponent(requestedId || "")}`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {!isChooser && <link rel="canonical" href={getCanonicalUrl(pageUrl, locale)} />}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        {!isChooser && <meta property="og:url" content={getCanonicalUrl(pageUrl, locale)} />}
        <meta property="og:type" content="article" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        {!isChooser && (
          <meta
            property="og:image"
            content={`${BASE}/api/og?title=${encodeURIComponent(email?.subject || copy.titleFallback)}&subtitle=${encodeURIComponent(description)}`}
          />
        )}
        {!isChooser && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl(pageUrl, "fr")} />
        )}
        {!isChooser && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl(pageUrl, "en")} />
        )}
        {isChooser && <meta name="robots" content="noindex" />}
      </Head>

      <div className="container">
        <Nav pagePath={pageUrl} frAvailable={true} />
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
          ← {copy.back}
        </a>

        {error && <p className="error-msg">{error}</p>}

        {!email && !error && !isChooser && <p className="loading-msg">{copy.loading}</p>}

        {email && (
          <article className="email-detail">
            <header className="detail-header">
              <h1 className="detail-subject">
                {email.subject || copy.noSubject}
              </h1>
              <div className="detail-meta">
                <span className="date">{formatDateTime(email.sent_at)}</span>
                {email.epstein_is_sender === 1 && (
                  <span className="badge-epstein">{copy.epsteinSender}</span>
                )}
              </div>
              <ShareButtons path={pageUrl} title={email.subject || copy.titleFallback} summary={description} locale={locale} />
            </header>

            <div className="detail-fields">
              {email.sender && (
                <div className="field">
                  <div className="field-label">{copy.from}</div>
                  <div className="field-value">
                    {senderProfileSlug ? (
                      <Link href={`/people/${senderProfileSlug}`} locale={locale}>
                        {email.sender}
                      </Link>
                    ) : (
                      email.sender
                    )}
                  </div>
                </div>
              )}
              <Field label={copy.to} value={email.to_recipients} />

              {participants.length > 0 && (
                <div className="field">
                  <div className="field-label">{copy.allParticipants}</div>
                  <div className="field-value participants">
                    {participants.map((p) => (
                      <span key={p} className="participant-tag">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {email.countries && (
                <div className="field">
                  <div className="field-label">{copy.countriesMentioned}</div>
                  <div className="field-value">
                    {splitCountries(email.countries).map((c) => (
                      <span key={c} className="tag">{getLocalizedCountryLabel(c, locale)}</span>
                    ))}
                  </div>
                </div>
              )}

              {email.body && (
                <div className="field">
                  <div className="field-label">{copy.body}</div>
                  <pre className="email-body">{email.body}</pre>
                </div>
              )}

              <Field label={copy.releaseBatch} value={email.release_batch} />
              <Field label={copy.documentId} value={email.doc_id} mono />
              <Field label={copy.recordId} value={email.id} mono />

              {email.doc_id && (
                <div className="field">
                  <div className="field-label">{copy.source}</div>
                  <div className="field-value">
                    <a
                      href={`https://jmail.world/thread/${email.doc_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {copy.viewOnJmail}
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
              <h1 className="detail-subject">{copy.chooserHeading}</h1>
              <p className="story-lede">
                {copy.chooserLeadPrefix} <span className="mono">{requestedId}</span>.{" "}
                {copy.chooserLeadSuffix}
              </p>
            </header>

            <section className="story-section">
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
                    {siblingChoices.map((choice) => (
                      <tr
                        key={choice.id}
                        className="clickable-row"
                        onClick={() =>
                          router.push(
                            `/emails/${encodeURIComponent(choice.id)}?back=${encodeURIComponent(router.asPath)}`,
                            undefined,
                            { locale }
                          )
                        }
                      >
                        <td className="col-date">{formatDateTime(choice.sent_at)}</td>
                        <td className="col-sender">{choice.sender || copy.unknown}</td>
                        <td className="col-subject">
                          <div>{choice.subject || copy.noSubject}</div>
                          {choice.preview && <div className="chooser-preview">{choice.preview}</div>}
                        </td>
                        <td className="col-countries">
                          {choice.countries
                            ? splitCountries(choice.countries).map((c) => (
                                <span key={c} className="tag">{getLocalizedCountryLabel(c, locale)}</span>
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

        <Footer locale={locale} />
      </div>
    </>
  );
}
