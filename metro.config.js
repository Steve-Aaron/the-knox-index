const https = require('https');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Local dev: DEV_API_PROXY=https://index.knox.digital answers /api/* from that
// deployment instead of the local API routes, so no GCP/Firebase keys are needed.
const apiProxy = process.env.DEV_API_PROXY && new URL(process.env.DEV_API_PROXY);

if (apiProxy) {
  config.server.enhanceMiddleware = (metroMiddleware) => (req, res, next) => {
    if (!req.url.startsWith('/api/')) return metroMiddleware(req, res, next);
    // Keep local analytics out of the prod Mixpanel project.
    if (req.url.startsWith('/api/mp/')) return res.writeHead(204).end();

    const upstream = https.request(
      new URL(req.url, apiProxy),
      { method: req.method, headers: { ...req.headers, host: apiProxy.host } },
      (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); },
    );
    upstream.on('error', (e) => res.writeHead(502).end(`DEV_API_PROXY: ${e.message}`));
    req.pipe(upstream);
  };
}

module.exports = config;
