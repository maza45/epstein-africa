import Head from "next/head";
import Nav from "../components/Nav";
import { getDb } from "../lib/db";

export async function getStaticProps() {
  const db = getDb();
  const emailCount = db
    .prepare("SELECT COUNT(*) AS n FROM emails WHERE is_promotional = 0")
    .get().n;
  return { props: { emailCount } };
}

export default function About({ emailCount }) {
  return (
    <>
      <Head>
        <title>About — Epstein Africa</title>
        <meta
          name="description"
          content="About the Epstein Africa database — methodology, sources, and caveats."
        />
      </Head>

      <div className="container">
        <Nav />
        <header className="site-header">
          <h1>About</h1>
        </header>

        <div className="about-body">
          <p>
            This site documents Jeffrey Epstein&apos;s connections to Africa as
            recorded in his email archive, released by the U.S. Department of
            Justice in January 2026.
          </p>

          <p>
            The archive has 1.7 million emails. We filtered it down to{" "}
            {emailCount.toLocaleString()} that reference African countries,
            cities, or people with documented African ties — by keyword search
            on subjects, senders, participant lists, and email body text.
          </p>

          <p>
            Beyond the raw emails, the site includes documented profiles of key
            correspondents and narrative investigations into the major threads —
            the Ivory Coast surveillance deal, the Libya operation, the Senegal
            political network, the Kenya safari.
          </p>

          <p>
            The site combines a searchable archive with original investigations
            into the major threads. The emails are the evidence. The stories
            don&apos;t go beyond what they show.
          </p>

          <p>
            The Africa angle has gotten almost no coverage in African media.
            That bothered me enough to build this.
          </p>

          <p>
            Some caveats worth knowing: the archive has gaps, redactions, and
            missing metadata. Some dates are null. Some senders show as Unknown
            or Redacted. We show the data as it is, not as we&apos;d like it to
            be.
          </p>

          <p>
            Source data comes from{" "}
            <a href="https://jmail.world" target="_blank" rel="noreferrer">
              jmail.world
            </a>
            , compiled from the DOJ release files. The code and data pipeline
            are on GitHub at{" "}
            <a
              href="https://github.com/Iskanenani/epstein-africa"
              target="_blank"
              rel="noreferrer"
            >
              github.com/Iskanenani/epstein-africa
            </a>
            .
          </p>
        </div>
      </div>
    </>
  );
}
