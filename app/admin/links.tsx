import { Redirect } from 'expo-router';

/**
 * /admin/links, the old address of the account tie-ins page. Tie-ins now sit
 * on /admin under World Leaders access; this keeps bookmarks working.
 */
export default function AdminLinksRedirect() {
  return <Redirect href="/admin" />;
}
