/**
 * lib/gemini.ts
 * --------------
 * Calls Gemini via the Developer REST API using the API key from .env.local.
 */

import https from 'https';

const API_KEY = process.env.GEMINI_API_KEY ?? '';
const MODEL   = 'gemini-3-flash-preview';
const HOST    = 'generativelanguage.googleapis.com';

interface GeminiPart {
  text?:     string;
  fileData?: { mimeType: string; fileUri: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message: string };
}

function httpsPost(path: string, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: HOST,
      path,
      method:  'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', (c: Buffer) => { data += c.toString(); });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 300) {
          console.error(`[gemini] HTTP ${res.statusCode}:`, data.slice(0, 400));
          reject(new Error(`Gemini HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function generateContent(parts: GeminiPart[]): Promise<string> {
  if (!API_KEY) {
    console.error('[gemini] GEMINI_API_KEY not set');
    throw new Error('GEMINI_API_KEY is not set in environment');
  }

  const body = JSON.stringify({
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4196 },
  });

  const raw    = await httpsPost(`/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, body);
  const parsed = JSON.parse(raw) as GeminiResponse;

  if (parsed.error) throw new Error(`Gemini API error: ${parsed.error.message}`);

  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  if (!text) throw new Error('Gemini returned an empty response');
  return text.trim();
}

export function toGsUri(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const m = rawUrl.match(
    /storage\.googleapis\.com\/download\/storage\/v1\/b\/([^/]+)\/o\/([^?]+)/
  );
  if (m) return `gs://${decodeURIComponent(m[1])}/${decodeURIComponent(m[2])}`;
  if (rawUrl.startsWith('gs://')) return rawUrl;
  return null;
}
