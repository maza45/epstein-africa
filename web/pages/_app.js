import "../styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta property="og:site_name" content="Epstein Africa" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
