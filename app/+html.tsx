import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * +html.tsx
 * ----------
 * Customises the web HTML document shell for Expo Router's server output.
 * This is the correct place for global CSS that applies before React hydrates.
 *
 * Font strategy:
 *   1. Load Montserrat from Google Fonts (all weights used in the app).
 *   2. Set body { font-family: 'Montserrat', Verdana, sans-serif } so every
 *      element that doesn't have an explicit fontFamily in its RN style picks
 *      up Montserrat instead of the browser default (Times New Roman).
 *
 * The useFonts() call in _layout.tsx registers the same weights for React
 * Native's style system — this CSS rule covers the remaining browser-level
 * fallback that RN styles don't reach (tooltips, InfoTip text, SVG text,
 * the DevLabel span, and any unstyled HTML elements).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Preconnect for faster Google Fonts load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* Load all Montserrat weights used in the app */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Font Awesome 6 — for TikTok and external-link icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
        />

        {/* Global styles */}
        <style dangerouslySetInnerHTML={{ __html: `
          body {
            font-family: 'Montserrat', Verdana, sans-serif;
          }

          /* Left-to-right fill sweep on all pressable/button elements.
             A ::before overlay expands from 0 → 100% width on hover.
             border-radius: inherit keeps pill shapes clean.
             pointer-events: none prevents it blocking clicks.          */
          div[role="button"] {
            position: relative;
            overflow: hidden;
          }
          div[role="button"]::before {
            content: '';
            position: absolute;
            inset: 0 auto 0 0;
            width: 0;
            background: rgba(255, 255, 255, 0.07);
            transition: width 0.22s ease-out;
            pointer-events: none;
            border-radius: inherit;
            z-index: 0;
          }
          div[role="button"]:hover::before {
            width: 100%;
          }
        `}} />

        {/* Vercel Speed Insights — injected as script so Metro doesn't need to bundle it */}
        <script defer src="/_vercel/speed-insights/script.js" />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
