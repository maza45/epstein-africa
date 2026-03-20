import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function cleanSender(sender) {
  if (!sender) return "—";
  const match = sender.match(/^([^<]+)</);
  if (match) return match[1].trim();
  return sender.replace(/[<>]/g, "").trim();
}

export default function PersonProfile() {
  const router = useRouter();
  const { slug } = router.query;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/people/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setData)
      .catch(() => setError("Person not found."));
  }, [slug]);

  const person = data?.person;
  const emails = data?.emails ?? [];

  return (
    <>
      <Head>
        <title>
          {person ? `${person.name} — Epstein Africa` : "Loading…"}
        </title>
      </Head>

      <div className="container">
        <Nav />
        <button className="back-btn" onClick={() => router.back()}>← Back</button>

        {error && <p className="error-msg">{error}</p>}
        {!data && !error && <p className="loading-msg">Loading…</p>}

        {person && (
          <>
            <header className="site-header">
              <h1>{person.name}</h1>
              <p className="subtitle">{person.title}</p>
            </header>

            <div className="profile-body">
              <section className="profile-bio">
                <p>{person.bio}</p>
              </section>

              <div className="profile-meta-row">
                <div className="profile-countries">
                  {person.countries.map((c) => (
                    <span key={c} className="tag">
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <section className="profile-emails">
                <h2 className="section-heading">
                  Emails ({data.total})
                </h2>

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
                      {emails.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="loading-cell">
                            No emails found.
                          </td>
                        </tr>
                      ) : (
                        emails.map((email) => (
                          <tr
                            key={email.id}
                            className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                            onClick={() =>
                              router.push(
                                `/emails/${encodeURIComponent(email.id)}`
                              )
                            }
                          >
                            <td className="col-date">
                              {formatDate(email.sent_at)}
                            </td>
                            <td className="col-sender">
                              {cleanSender(email.sender)}
                            </td>
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
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
