import "../styles/globals.css";
import Head from "next/head";
import { useRouter } from "next/router";
import { BASE } from "../lib/i18n";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:site_name" content="Epstein Africa" />
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
