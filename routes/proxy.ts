import { Router, Request, Response } from 'express';
import http from 'http';
import https from 'https';
import { URL } from 'url';

const router = Router();

// Handle preflight CORS requests
router.options('/api/proxy/stream', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  res.sendStatus(204);
});

/**
 * Universal IPTV Stream Proxy
 * - Resolves CORS issues for modern browsers
 * - Bridges mixed-content (HTTP streams loaded on HTTPS pages)
 * - Automatically rewrites .m3u8 manifests so that chunklists and .ts segments route through this proxy
 */
router.get('/api/proxy/stream', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing "url" parameter');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).send('Invalid protocol. Only HTTP and HTTPS are supported.');
    }
  } catch (err) {
    return res.status(400).send('Invalid target URL');
  }

  // Set global CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');

  try {
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'identity', // Do not gzip manifests so we can rewrite text
      'Connection': 'keep-alive',
    };

    if (req.headers.range) {
      requestHeaders['Range'] = req.headers.range as string;
    }

    const requestOptions: https.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers: requestHeaders,
      timeout: 12000,
      rejectUnauthorized: false, // Permit IPTV servers with self-signed or expired certs
    };

    const proxyReq = client.request(requestOptions, (remoteRes) => {
      // Handle HTTP redirects (301, 302, 307, 308)
      if (
        remoteRes.statusCode &&
        [301, 302, 303, 307, 308].includes(remoteRes.statusCode) &&
        remoteRes.headers.location
      ) {
        try {
          const redirectUrl = new URL(remoteRes.headers.location, targetUrl).href;
          return res.redirect(`/api/proxy/stream?url=${encodeURIComponent(redirectUrl)}`);
        } catch {
          // Fall through
        }
      }

      const contentType = remoteRes.headers['content-type'] || '';
      const isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        parsedUrl.pathname.endsWith('.m3u8') ||
        parsedUrl.search.includes('.m3u8');

      if (isM3u8 && req.method !== 'HEAD') {
        // Read manifest into buffer and rewrite segment links
        const chunks: Buffer[] = [];
        remoteRes.on('data', (chunk) => chunks.push(chunk));
        remoteRes.on('end', () => {
          const manifestText = Buffer.concat(chunks).toString('utf-8');

          if (!manifestText.includes('#EXTM3U')) {
            // Not a real manifest, send as-is
            res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
            return res.status(remoteRes.statusCode || 200).send(manifestText);
          }

          // Rewrite lines: any URI should go through /api/proxy/stream
          const lines = manifestText.split(/\r?\n/);
          const rewrittenLines = lines.map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            // Handle any tag containing URI="..." (e.g. #EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, #EXT-X-I-FRAME-STREAM-INF)
            if (trimmed.startsWith('#') && trimmed.includes('URI=')) {
              return trimmed.replace(/URI="([^"]+)"/g, (_match, uriVal) => {
                try {
                  const resolvedUri = new URL(uriVal, targetUrl).href;
                  return `URI="/api/proxy/stream?url=${encodeURIComponent(resolvedUri)}"`;
                } catch {
                  return `URI="${uriVal}"`;
                }
              });
            }

            // Skip other comments and directives
            if (trimmed.startsWith('#')) {
              return line;
            }

            // Media URI or sub-manifest URI
            try {
              const resolvedMediaUrl = new URL(trimmed, targetUrl).href;
              return `/api/proxy/stream?url=${encodeURIComponent(resolvedMediaUrl)}`;
            } catch {
              return line;
            }
          });

          const rewrittenManifest = rewrittenLines.join('\n');
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          return res.status(200).send(rewrittenManifest);
        });

        remoteRes.on('error', (err) => {
          console.error('[Proxy] Manifest read error:', err.message);
          if (!res.headersSent) res.status(502).send('Error reading stream manifest');
        });
      } else {
        // Binary media chunks (.ts, .aac, .m4s) or HEAD request: pipe directly
        res.status(remoteRes.statusCode || 200);
        if (contentType) res.setHeader('Content-Type', contentType);
        if (remoteRes.headers['content-length']) {
          res.setHeader('Content-Length', remoteRes.headers['content-length']);
        }
        if (remoteRes.headers['content-range']) {
          res.setHeader('Content-Range', remoteRes.headers['content-range']);
        }
        if (remoteRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', remoteRes.headers['accept-ranges']);
        }
        res.setHeader('Cache-Control', 'public, max-age=60');
        remoteRes.pipe(res);
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) res.status(504).send('Stream source connection timed out');
    });

    proxyReq.on('error', (err) => {
      console.warn('[Proxy] Request error for', targetUrl, ':', err.message);
      if (!res.headersSent) res.status(502).send(`Proxy connection error: ${err.message}`);
    });

    proxyReq.end();
  } catch (err: any) {
    if (!res.headersSent) {
      res.status(500).send(`Internal proxy error: ${err.message}`);
    }
  }
});

export default router;
