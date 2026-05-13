/**
 * app/+html.tsx
 * --------------
 * Expo Router web HTML shell. Controls the <html>, <head>, and <body> wrapper
 * rendered around every page on web.
 *
 * Head content lives in components/web/HTMLHead.tsx — edit that file to add
 * or change meta tags, stylesheets, and scripts.
 *
 * One job: compose the outer HTML document structure.
 */

import type { PropsWithChildren } from 'react';
import { HTMLHead, GTMNoScript } from '@/components/web/HTMLHead';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <HTMLHead />
      </head>
      <body>
        {/* Google Tag Manager (noscript) — must be the first child of <body> */}
        <GTMNoScript />
        {children}
      </body>
    </html>
  );
}
