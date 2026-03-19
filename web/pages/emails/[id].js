import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";

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

function Field({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className={`field-value${mono ? " mono" : ""}`}>{value}</div>
    </div>
  );
}

export default function EmailDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [email, setEmail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/emails/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setEmail)
      .catch(() => setError("Email not found."));
  }, [id]);

  const participants = email ? parseParticipants(email.all_participants) : [];

  return (
    <>
      <Head>
        <title>
          {email ? `${email.subject || "(no subject)"} — Epstein Africa` : "Loading…"}
        </title>
      </Head>

      <div className="container">
        <nav className="breadcrumb">
          <Link href="/">← Back to emails</Link>
        </nav>

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
              <Field label="From" value={email.sender} />
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

              <Field label="Release batch" value={email.release_batch} />
              <Field label="Document ID" value={email.doc_id} mono />
              <Field label="Record ID" value={email.id} mono />
            </div>
          </article>
        )}
      </div>
    </>
  );
}
