import React from 'react';
import { Redirect } from 'expo-router';

/**
 * /privacy → /privacy-policy
 * --------------------------
 * The policy lives at /privacy-policy. On Vercel, vercel.json answers /privacy
 * with a 301 before the app loads; this covers in-app navigation, native deep
 * links and the local dev server, where that redirect does not run.
 *
 * One job: send old /privacy links to the canonical page.
 */
export default function PrivacyRedirect() {
  return <Redirect href="/privacy-policy" />;
}
