import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <meta name="application-name" content="Monitor CETEL" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Monitor CETEL" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js" async />
        <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js" async />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
