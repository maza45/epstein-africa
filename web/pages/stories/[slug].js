import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import Footer from "../../components/Footer";
import ShareButtons from "../../components/ShareButtons";
import { STORIES, getStoryBySlug } from "../../lib/stories";
import { getDb } from "../../lib/db";
import { cleanSender, formatDate, splitCountries } from "../../lib/format";
import {
  BASE,
  getCanonicalUrl,
  getLocalizedCountryLabel,
  getLocalizedCountryLabels,
  getLocalizedPath,
  getOgLocale,
  getLocalizedStory,
  hasFrenchStory,
  normalizeLocale,
  resolveBackHref,
  STORY_COPY,
} from "../../lib/i18n";

// Turn inline email IDs like (EFTA01841982-0) into clickable links
const CITATION_RE = /\b((?:EFTA\d{8}(?:-\d+)?|vol00009-efta\d{8}-pdf(?:-\d+)?|HOUSE_OVERSIGHT_\d+(?:-\d+)?))\b/g;

function linkifyCitations(text, locale, backPath) {
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
      <Link
        key={`${id}-${match.index}`}
        href={`/emails/${encodeURIComponent(id)}?back=${encodeURIComponent(backPath)}`}
        locale={locale}
        className="citation-link"
      >
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
    paths: STORIES.flatMap((story) => {
      const paths = [{ params: { slug: story.slug }, locale: "en" }];
      if (hasFrenchStory(story)) {
        paths.push({ params: { slug: story.slug }, locale: "fr" });
      }
      return paths;
    }),
    fallback: false,
  };
}

export async function getStaticProps({ params, locale }) {
  const normalizedLocale = normalizeLocale(locale);
  const story = getStoryBySlug(params.slug);
  if (!story) return { notFound: true };
  if (normalizedLocale === "fr" && !hasFrenchStory(story)) {
    return { notFound: true };
  }
  const localizedStory = getLocalizedStory(story, normalizedLocale);

  let emails = [];
  if (localizedStory.email_ids.length > 0) {
    const db = getDb();
    const placeholders = localizedStory.email_ids.map(() => "?").join(",");
    emails = db
      .prepare(
        `SELECT id, doc_id, sender, subject, sent_at, countries, epstein_is_sender
         FROM emails
         WHERE id IN (${placeholders})
         ORDER BY COALESCE(sent_at, '9999-99-99') ASC`
      )
      .all(...localizedStory.email_ids);
  }

  const kind = story.kind || "atomic";
  const parents = (story.parents || [])
    .map((parentSlug) => {
      const p = getStoryBySlug(parentSlug);
      if (!p) return null;
      const loc = getLocalizedStory(p, normalizedLocale);
      return { slug: loc.slug, title: loc.title };
    })
    .filter(Boolean);
  const children =
    kind === "longread"
      ? STORIES
          .filter((s) => s.slug !== story.slug && (s.parents || []).includes(story.slug))
          .map((s) => {
            const loc = getLocalizedStory(s, normalizedLocale);
            return { slug: loc.slug, title: loc.title, date_range: loc.date_range };
          })
      : [];

  return {
    props: {
      story: localizedStory,
      emails,
      kind,
      parents,
      children,
      locale: normalizedLocale,
      frAvailable: hasFrenchStory(story),
    },
  };
}

export default function StoryPage({ story, emails, kind, parents, children, locale, frAvailable }) {
  const router = useRouter();
  const t = STORY_COPY[locale] || STORY_COPY.en;

  const pageUrl = `/stories/${story.slug}`;
  const localizedPageUrl = getLocalizedPath(pageUrl, locale);
  const backHref = resolveBackHref(router.query.back, "/stories", locale);
  const localizedCountries = getLocalizedCountryLabels(story.countries, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: story.title,
    description: story.summary,
    url: getCanonicalUrl(pageUrl, locale),
    publisher: { "@type": "Organization", name: "Epstein Africa", url: BASE },
    image: `${BASE}/api/og?title=${encodeURIComponent(story.title)}&subtitle=${encodeURIComponent(localizedCountries.join(", "))}&type=article`,
  };

  return (
    <>
      <Head>
        <title>{story.title} — Epstein Africa</title>
        <meta name="description" content={story.summary} />
        <link rel="canonical" href={getCanonicalUrl(pageUrl, locale)} />
        <meta property="og:title" content={story.title} />
        <meta property="og:description" content={story.summary} />
        <meta property="og:url" content={getCanonicalUrl(pageUrl, locale)} />
        <meta property="og:type" content="article" />
        <meta property="og:locale" content={getOgLocale(locale)} />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent(story.title)}&subtitle=${encodeURIComponent(localizedCountries.join(", "))}`} />
        {frAvailable && locale === "en" && (
          <link rel="alternate" hrefLang="fr" href={getCanonicalUrl(pageUrl, "fr")} />
        )}
        {frAvailable && locale === "fr" && (
          <link rel="alternate" hrefLang="en" href={getCanonicalUrl(pageUrl, "en")} />
        )}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="container">
        <Nav pagePath={pageUrl} frAvailable={frAvailable} />
        <Link className="back-btn" href={backHref} locale={false}>← {t.back}</Link>

        <article className={`story-article${kind === "longread" ? " story-article--longread" : ""}`}>
          {parents.length > 0 && (
            <div className="part-of-banner">
              <span className="part-of-label">{t.partOf}:</span>
              {parents.map((p) => (
                <Link key={p.slug} href={`/stories/${p.slug}`} locale={locale}>
                  {p.title}
                </Link>
              ))}
            </div>
          )}
          <header className="story-header">
            <div className="story-header-meta">
              <span className="story-date-range">{story.date_range}</span>
              {story.countries.map((c) => (
                <span key={c} className="tag">{getLocalizedCountryLabel(c, locale)}</span>
              ))}
            </div>
            <h1 className="story-heading">{story.title}</h1>
            <p className="story-lede">{story.summary}</p>
            <ShareButtons path={pageUrl} title={story.title} summary={story.summary} locale={locale} />
          </header>

          {story.body.length > 0 && (
            <div className="story-body">
              {story.body.map((para, i) => (
                    <p key={i}>{linkifyCitations(para, locale, localizedPageUrl)}</p>
              ))}
            </div>
          )}

          {children.length > 0 && (
            <section className="story-section source-stories">
              <h2 className="section-heading">{t.sourceStories}</h2>
              <ul className="source-stories-list">
                {children.map((child) => (
                  <li key={child.slug}>
                    <Link href={`/stories/${child.slug}`} locale={locale}>
                      <span className="source-story-date">{child.date_range}</span>
                      <h3 className="source-story-title">{child.title}</h3>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {emails.length > 0 && (
            <section className="story-section">
              <h2 className="section-heading">{t.sourceEmails}</h2>
              <div className="table-wrap">
                <table className="email-table">
                  <thead>
                    <tr>
                      <th className="col-date">{t.thDate}</th>
                      <th className="col-sender">{t.thSender}</th>
                      <th className="col-subject">{t.thSubject}</th>
                      <th className="col-countries">{t.thCountries}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emails.map((email) => (
                      <tr
                        key={email.id}
                        className={`clickable-row${email.epstein_is_sender ? " epstein-row" : ""}`}
                        onClick={() =>
                          router.push(
                            `/emails/${encodeURIComponent(email.id)}?back=${encodeURIComponent(localizedPageUrl)}`
                            ,
                            undefined,
                            { locale }
                          )
                        }
                      >
                        <td className="col-date">{formatDate(email.sent_at)}</td>
                        <td className="col-sender">{cleanSender(email.sender)}</td>
                        <td className="col-subject">{email.subject || t.noSubject}</td>
                        <td className="col-countries">
                          {email.countries
                            ? splitCountries(email.countries).map((c) => (
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
          )}

          {story.news_links.length > 0 && (
            <section className="story-section">
              <h2 className="section-heading">{t.externalCoverage}</h2>
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

        <Footer locale={locale} />
      </div>
    </>
  );
}
