import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { BRAND } from '@/brand/constants';

/**
 * +html.tsx
 * ----------
 * Web HTML shell for The Knox Index.
 * Imports brand/tokens.css for all CSS custom properties and global resets.
 * Loads Montserrat from Google Fonts and Font Awesome for icons.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={BRAND.description} />
        <title>{BRAND.name}</title>

        {/* Preconnect for faster Google Fonts load */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* Montserrat — all weights used across the app */}
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />

        {/* Font Awesome 6 — TikTok + external-link icons */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css"
        />

        {/* Brand design tokens — single source of truth for CSS custom properties */}
        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
        {/* @ts-ignore — Expo Router's +html doesn't type-check link[rel=stylesheet] for local assets */}
        <link rel="stylesheet" href="/brand/tokens.css" />

        <ScrollViewStyleReset />

        {/* Vercel Speed Insights */}
        <script defer src="/_vercel/speed-insights/script.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
