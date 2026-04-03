import Head from "next/head";
import Nav from "../components/Nav";
import Footer from "../components/Footer";
import { getDb } from "../lib/db";

const BASE = "https://www.epsteinafrica.com";

export async function getStaticProps() {
  const db = getDb();
  const emailCount = db
    .prepare("SELECT COUNT(*) AS n FROM emails WHERE COALESCE(is_promotional, 0) = 0")
    .get().n;
  const rows = db
    .prepare("SELECT DISTINCT countries FROM emails WHERE COALESCE(is_promotional, 0) = 0 AND countries IS NOT NULL AND countries != ''")
    .all();
  const countrySet = new Set();
  for (const r of rows) {
    r.countries.split(",").map((c) => c.trim()).filter((c) => c && c !== "Africa").forEach((c) => countrySet.add(c));
  }
  return { props: { emailCount, countryCount: countrySet.size } };
}

export default function About({ emailCount, countryCount }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Epstein Africa",
    url: `${BASE}/about`,
    mainEntity: {
      "@type": "WebSite",
      name: "Epstein Africa",
      url: BASE,
      description: "Searchable database of Jeffrey Epstein's documented connections to Africa.",
    },
  };

  return (
    <>
      <Head>
        <title>About — Epstein Africa</title>
        <meta
          name="description"
          content="About the Epstein Africa database — methodology, sources, and caveats."
        />
        <link rel="canonical" href={`${BASE}/about`} />
        <meta property="og:title" content="About — Epstein Africa" />
        <meta property="og:description" content="About the Epstein Africa database — methodology, sources, and caveats." />
        <meta property="og:url" content={`${BASE}/about`} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${BASE}/api/og?title=${encodeURIComponent("About")}&subtitle=${encodeURIComponent("Methodology, sources, and caveats")}`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>About</h1>
        </header>

        <div className="about-body">
          <h2>What this is</h2>
          <p>
            A searchable database of Jeffrey Epstein&apos;s documented
            connections to the African continent. {emailCount.toLocaleString()}{" "}
            emails, 46 investigative stories, 52 person profiles,{" "}
            {countryCount} countries. Every claim on this site links to a
            specific document ID from the U.S. Department of Justice release.
          </p>

          <h2>Why it exists</h2>
          <p>
            The DOJ released 1.78 million Epstein emails under the Epstein
            Files Transparency Act, signed November 2025. The Africa
            connections in those files have received almost no coverage in
            African media. This site filters, indexes, and contextualizes the
            Africa-relevant portion of the archive so journalists, researchers,
            and the public can work with the primary sources directly.
          </p>

          <h2>What the archive shows</h2>
          <p>
            The archive documents a pattern: humanitarian funding as the entry
            point, intelligence collection as the product, political access as
            the payoff. The same channel that carried polio field reports from
            Nigeria carried investment deals worth millions. The same
            relationships that opened doors to African presidents opened doors
            to their ministers, their ports, their resources. The documents
            don&apos;t explain why a convicted sex offender was at the center of
            this network. They show that he was.
          </p>

          <h2>Data sources</h2>
          <p>
            The email archive comes from{" "}
            <a href="https://jmail.world" target="_blank" rel="noreferrer">
              jmail.world
            </a>
            , which parsed the DOJ release into structured data. Additional
            documents come from the House Oversight Committee subpoena releases
            (September and November 2025). Every email in the database can be
            verified against the original DOJ files.
          </p>

          <h2>What you can do here</h2>
          <p>
            Search emails by keyword, sender, or country using full-text
            search. Read 46 investigative stories, each citing specific email
            document IDs. Browse 52 person profiles showing who communicated
            with whom. Explore the network graph to see relationships between
            people and countries. Export the full dataset as CSV or JSON.
            Subscribe to the RSS feed for new stories.
          </p>

          <h2>Methodology</h2>
          <p>
            The {emailCount.toLocaleString()} emails were filtered from the
            1.78 million email archive by keyword matching on subjects, senders,
            participant lists, and body text for African countries, cities, and
            documented individuals. Stories are written from the emails as
            primary sources. Every factual claim cites a document ID. Direct
            quotes preserve the original text, including typos.
          </p>

          <h2>Contact</h2>
          <p>
            If you are a journalist or researcher working on a specific lead
            in this database, you can reach us at{" "}
            <a href="mailto:epsteinexposedafrica@pm.me">
              epsteinexposedafrica@pm.me
            </a>
            . We can provide document IDs, source context, and data exports
            for any thread in the archive.
          </p>

          <h2>Caveats</h2>
          <p>
            The archive has gaps, redactions, and missing metadata. Some dates
            are null. Some senders show as Unknown or Redacted. Some emails
            appear in both electronic and PDF format, creating duplicate
            entries for the same exchange. We show the data as it is.
          </p>
        </div>

        <Footer />
      </div>
    </>
  );
}
