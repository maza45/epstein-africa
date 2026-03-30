import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import ShareButtons from "../../components/ShareButtons";
import { STORIES, getStoryBySlug } from "../../lib/stories";
import { getDb } from "../../lib/db";
import { cleanSender, formatDate, splitCountries } from "../../lib/format";

const BASE = "https://www.epsteinafrica.com";

// Turn inline email IDs like (EFTA01841982-0) into clickable links
const CITATION_RE = /\b((?:EFTA\d{8}(?:-\d+)?|vol00009-efta\d{8}-pdf(?:-\d+)?|HOUSE_OVERSIGHT_\d+(?:-\d+)?))\b/g;

function linkifyCitations(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const id = match[1];
    parts.push(
      <Link key={`${id}-${match.index}`} href={`/emails/${encodeURIComponent(id)}`} className="citation-link">
        {id}
      </Link>
    );
    lastIndex = CITATION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 1 ? parts : text;
}

export async function getStaticPaths() {
  return {
    paths: STORIES.map((s) => ({ params: { slug: s.slug } })),
    fallback: false,
  };
}

export async function getStaticProps({ params }) {
  const story = getStoryBySlug(params.slug);
  if (!story) return { notFound: true };

  let emails = [];
  if (story.email_ids.length > 0) {
    const db = getDb();
    const placeholders = story.email_ids.map(() => "?").join(",");
    emails = db
      .prepare(
        `SELECT id, doc_id, sender, subject, sent_at, countries, epstein_is_sender
         FROM emails
         WHERE id IN (${placeholders})
         ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
      )
      .all(...story.email_ids);
  }

  return { props: { story, emails } };
}

export default function StoryPage({ story, emails }) {
  const router = useRouter();

  const pageUrl = `/stories/${story.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.summary,
    url: `${BASE}${pageUrl}`,
    publisher: { "@type": "Organization", name: "Epstein Africa", url: BASE },
    image: `${BASE}/api/og?title=${encodeURIComponent(story.title)}&subtitle=${encodeURIComponent(story.countries.join(", "))}&type=article`,
  };

  return (
    <>
      <Head>
        <title>{story.title} — Epstein Africa</title>
        <meta name="description" content={story.summary} />
        <link rel="canonical" href={`${BASE}${pageUrl}`} />
        <meta property="og:title" content={story.title} />
        <meta property="og:description" content={story.summary} />
        <meta property="og:url" content={`${BASE}${pageUrl}`} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(story.title)}&subtitle=${encodeURIComponent(story.countries.join(", "))}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
            <ShareButtons path={pageUrl} title={story.title} summary={story.summary} />
          </header>

          {story.body.length > 0 && (
            <div className="story-body">
              {story.body.map((para, i) => (
                <p key={i}>{linkifyCitations(para)}</p>
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
                            ? splitCountries(email.countries).map((c) => (
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

        <Footer />
      </div>
    </>
  );
}
