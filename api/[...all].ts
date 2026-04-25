/**
 * api/[...all].ts
 * ---------------
 * Vercel serverless function entry point.
 * Catches all requests and delegates to the Expo Router server bundle,
 * which handles both API routes and HTML serving.
 *
 * `build` must be a path string pointing at the dist/server directory —
 * NOT a require() call, since dist/server has no index.js entry point.
 */
import { createRequestHandler } from '@expo/server/adapter/vercel';
import { join } from 'node:path';

export default createRequestHandler({
  build: join(__dirname, '../dist/server'),
});
