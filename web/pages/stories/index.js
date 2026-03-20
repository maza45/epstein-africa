import Head from "next/head";
import Link from "next/link";
import Nav from "../../components/Nav";
import { STORIES } from "../../lib/stories";

export default function StoriesIndex() {
  return (
    <>
      <Head>
        <title>Stories — Epstein Africa</title>
        <meta
          name="description"
          content="Investigative narratives drawn from Epstein's Africa-related email archive."
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>Stories</h1>
          <p className="subtitle">
            Narratives drawn from the email archive. Each story is sourced
            directly from documented correspondence.
          </p>
        </header>

        <div className="stories-grid">
          {STORIES.map((story) => (
            <Link
              key={story.slug}
              href={`/stories/${story.slug}`}
              className="story-card"
            >
              <div className="story-date-range">{story.date_range}</div>
              <div className="story-title">{story.title}</div>
              <div className="story-summary">{story.summary}</div>
              <div className="story-countries">
                {story.countries.map((c) => (
                  <span key={c} className="tag">
                    {c}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
