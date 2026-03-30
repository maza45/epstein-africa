import "../styles/globals.css";
import Head from "next/head";

const BASE = "https://www.epsteinafrica.com";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:site_name" content="Epstein Africa" />
        <meta property="og:locale" content="en_US" />
        <meta name="twitter:card" content="summary_large_image" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Epstein Africa RSS"
          href={`${BASE}/rss.xml`}
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
