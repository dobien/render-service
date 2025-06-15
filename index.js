const express = require('express');
const https = require('https');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

// Общие middleware
app.use(cors({ origin: '*', methods: '*', allowedHeaders: '*' }));
app.use(bodyParser.raw({ type: '*/*' }));

// Маршрут для Gemini (/g)
app.all('/g*', createProxyHandler('generativelanguage.googleapis.com'));
// Маршрут для Mistral (/m)
app.all('/m*', createProxyHandler('api.mistral.ai')); 
// Маршрут для Gemini v2 (/g2)
app.all('/g2*', createProxyHandler('render-gf.duckdns.org:4433'));

function createProxyHandler(targetHost) {
  return async (req, res) => {
    try {
      const targetUrl = new URL(req.originalUrl, `https://${targetHost}`);
      
      const options = {
        method: req.method,
        headers: {
          ...req.headers,
          host: targetHost,
          'x-proxy-request': 'true'
        }
      };

      // Очистка заголовков
      ['content-length', 'x-proxy-request', 'origin', 'referer'].forEach(h => delete options.headers[h]);

      const externalReq = https.request(targetUrl, options, (externalRes) => {
        if (!res.headersSent) {
          res.writeHead(externalRes.statusCode, externalRes.headers);
          externalRes.pipe(res);
        }
      });

      externalReq.on('error', handleProxyError(res));
      req.body && externalReq.write(req.body);
      externalReq.end();

    } catch (err) {
      console.error(`Error in ${targetHost} proxy:`, err);
      !res.headersSent && res.status(500).json({ error: err.message });
    }
  };
}

function handleProxyError(res) {
  return (err) => {
    console.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.destroy();
    }
  };
}

app.listen(port, () => {
  console.log(`Unified proxy server running on port ${port}`);
});
