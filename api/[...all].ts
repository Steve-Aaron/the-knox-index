/**
 * api/[...all].ts
 * ---------------
 * Vercel serverless function entry point.
 * Catches all requests and delegates to the Expo Router server bundle,
 * which handles both API routes and HTML serving.
 *
 * WRITTEN IN COMMONJS ON PURPOSE — do not convert to import/export.
 * The Lambda executes the compiled file as CommonJS (.js, no
 * "type": "module"). ESM `import` syntax here compiles to an import
 * statement under the project tsconfig (module: esnext) and crashes EVERY
 * request with 'SyntaxError: Cannot use import statement outside a module'.
 * require() survives any tsconfig module setting.
 *
 * `build` must be a path string pointing at the dist/server directory —
 * NOT a require() call, since dist/server has no index.js entry point.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { createRequestHandler } = require('@expo/server/adapter/vercel');
const { join } = require('node:path');

module.exports = createRequestHandler({
  build: join(__dirname, '../dist/server'),
});
