import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import { getStoryBySlug } from "../../lib/stories";

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

export default function StoryPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [emails, setEmails] = useState([]);

  const story = slug ? getStoryBySlug(slug) : null;

  useEffect(() => {
    if (!story || story.email_ids.length === 0) return;
    fetch(`/api/stories/emails?ids=${story.email_ids.join(",")}`)
      .then((r) => r.json())
      .then(setEmails);
  }, [slug]);

  if (router.isReady && !story) {
    return (
      <div className="container">
        <Nav />
        <p className="error-msg">Story not found.</p>
      </div>
    );
  }

  if (!story) return null;

  return (
    <>
      <Head>
        <title>{story.title} — Epstein Africa</title>
        <meta name="description" content={story.summary} />
      </Head>

      <div className="container">
        <Nav />
        <button className="back-btn" onClick={() => router.back()}>← Back</button>

        <article className="story-article">
          <header className="story-header">
            <div className="story-header-meta">
              <span className="story-date-range">{story.date_range}</span>
              {story.countries.map((c) => (
                <span key={c} className="tag">{c}</span>
              ))}
            </div>
            <h1 className="story-heading">{story.title}</h1>
            <p className="story-lede">{story.summary}</p>
          </header>

          {story.body.length > 0 && (
            <div className="story-body">
              {story.body.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}

          {emails.length > 0 && (
            <section className="story-section">
              <h2 className="section-heading">Source emails</h2>
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
                    {emails.map((email) => (
                      <tr
                        key={email.id}
                        className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                        onClick={() =>
                          router.push(
                            `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(router.asPath)}`
                          )
                        }
                      >
                        <td className="col-date">{formatDate(email.sent_at)}</td>
                        <td className="col-sender">{cleanSender(email.sender)}</td>
                        <td className="col-subject">{email.subject || "(no subject)"}</td>
                        <td className="col-countries">
                          {email.countries
                            ? email.countries.split(", ").map((c) => (
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
          )}

          {story.news_links.length > 0 && (
            <section className="story-section">
              <h2 className="section-heading">External coverage</h2>
              <ul className="news-links">
                {story.news_links.map((link) => (
                  <li key={link.url}>
                    <span className="news-source">{link.source}</span>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.title} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </div>
    </>
  );
}
