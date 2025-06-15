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
app.all('/g/*', createProxyHandler('generativelanguage.googleapis.com', '/g'));
// Маршрут для Mistral (/m)
app.all('/m/*', createProxyHandler('api.mistral.ai', '/m')); 
// Маршрут для Gemini v2 (/g2)
app.all('/g2/*', createProxyHandler('render-gf.duckdns.org:4433', '/g2'));

function createProxyHandler(targetHost, prefixToStrip) {
  return async (req, res) => {
    try {
      // Убираем префикс из пути
      let targetPath = req.originalUrl;
      if (prefixToStrip && targetPath.startsWith(prefixToStrip)) {
        targetPath = targetPath.slice(prefixToStrip.length);
        // Если после удаления префикса путь не начинается с /, добавляем его
        if (!targetPath.startsWith('/')) {
          targetPath = '/' + targetPath;
        }
      }

      const targetUrl = new URL(targetPath, `https://${targetHost}`);

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
      if (req.body && req.body.length > 0) {
        externalReq.write(req.body);
      }
      externalReq.end();

    } catch (err) {
      console.error(`Error in ${targetHost} proxy:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
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
