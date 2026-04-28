/**
 * lib/errors.ts
 * --------------
 * Helpers for turning raw error objects into safe, log-friendly strings.
 *
 * The Google Cloud SDKs sometimes embed configuration values into their error
 * messages — for example, an ENAMETOOLONG error includes the path argument it
 * tried to open, and a malformed `keyFilename` value can contain the entire
 * service-account JSON including the private key. We must never echo those
 * messages back to clients, and even server-side logs should be redacted in
 * case they're shipped to a third-party log aggregator.
 *
 * One job: produce a short, redacted message that's safe to surface, and a
 * longer (still redacted) message for server logs.
 */

/**
 * Strip anything that looks like credential material from an arbitrary string.
 * Conservative — would rather over-redact than leak.
 */
export function redactSecrets(input: string): string {
  if (!input) return input;

  let out = input;

  // 1. PEM blocks of any flavour: -----BEGIN x KEY----- … -----END x KEY-----
  out = out.replace(
    /-----BEGIN [A-Z0-9 ]+-----[\s\S]*?-----END [A-Z0-9 ]+-----/g,
    '[REDACTED PEM]',
  );

  // 2. JSON-style key fields that hold secrets, with either escaped or raw
  //    string values. Covers private_key, private_key_id, client_secret, token.
  out = out.replace(
    /"(private_key|private_key_id|client_secret|refresh_token|access_token)"\s*:\s*"(?:\\.|[^"\\])*"/gi,
    '"$1":"[REDACTED]"',
  );

  // 3. Any remaining `xxxx-key=...` style query-string secrets
  out = out.replace(
    /([?&](?:key|api[_-]?key|token|access_token)=)[^&\s"']+/gi,
    '$1[REDACTED]',
  );

  // 4. Bearer tokens in headers
  out = out.replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [REDACTED]');

  return out;
}

/**
 * Convert any thrown value into:
 *   - clientDetail: a short, generic message safe to put in an HTTP response.
 *     Never includes raw SDK output. The client should treat this as opaque.
 *   - logMessage:   a fuller (but still redacted) message for server logs.
 *
 * Use this in every API route. Never spread `err.message` into a Response.
 */
export function safeErrorDetail(err: unknown): {
  clientDetail: string;
  logMessage:   string;
} {
  const raw = err instanceof Error ? err.message : String(err);
  const redacted = redactSecrets(raw);

  // Truncate the log message so a giant payload can't pollute logs even after
  // redaction; 600 chars is plenty for stack traces.
  const logMessage = redacted.length > 600 ? redacted.slice(0, 600) + '…' : redacted;

  // Surface a generic message to clients. Different SDK errors pick different
  // wording, but never the raw text. Specific known-safe codes can be passed
  // through later if needed.
  const clientDetail = looksLikeAuthError(redacted)
    ? 'Authentication error contacting upstream service'
    : looksLikeNetworkError(redacted)
      ? 'Upstream service unreachable'
      : 'Internal server error';

  return { clientDetail, logMessage };
}

function looksLikeAuthError(msg: string): boolean {
  return /unauth|forbid|permission|invalid[_ -]?credential|invalid[_ -]?key|401|403/i.test(msg);
}

function looksLikeNetworkError(msg: string): boolean {
  return /econnrefused|enotfound|etimedout|fetch failed|socket|network/i.test(msg);
}
