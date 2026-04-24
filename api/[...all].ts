/**
 * api/[...all].ts
 * ---------------
 * Vercel serverless function entry point.
 * Catches every request to /api/* and delegates it to the Expo Router
 * server bundle (compiled by `expo export --platform web` into dist/server/).
 *
 * The @expo/server adapter translates between Vercel's Request/Response
 * contract and Expo Router's internal handler.
 */
import { createRequestHandler } from '@expo/server/adapter/vercel';

export default createRequestHandler({
  build: require('../dist/server'),
});
