import { Html, Head, Main, NextScript } from "next/document";

export default function Document(props) {
  const locale = props?.__NEXT_DATA__?.locale === "fr" ? "fr" : "en";

  return (
    <Html lang={locale}>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@400&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,700;1,400;1,700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <script
          defer
          src="https://cloud.umami.is/script.js"
          data-website-id="2df10980-c9d7-4608-bef7-f69ca59db827"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
