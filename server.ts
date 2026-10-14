import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import channelsRouter, { getAllChannels, getAllGroups, getChannelById } from './routes/channels.js';
import playerRouter from './routes/player.js';
import adminRouter from './routes/admin.js';
import proxyRouter from './routes/proxy.js';
import translateRouter from './routes/translate.js';
import { getPlaylists } from './src/db/storage.js';
import { detectDevice } from './utils/deviceDetector.js';
import { renderLegacyHome, renderLegacyChannel, renderLegacyNotFound, renderCorePlayerGuide } from './views/legacyRenderer.js';
import dotenv from 'dotenv';
import dns from 'node:dns';

// Force Node.js to prefer IPv4 over IPv6 on cloud providers like Render that do not support outbound IPv6
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // ignore if unsupported
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Trust Render's reverse proxy for correct proto, host and IP detection
app.set('trust proxy', 1);

// Helper to parse cookie string
function parseCookies(cookieHeader: string = ''): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Basic middleware with high JSON/form limits for M3U playlists
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Device detection & preference middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const ua = req.headers['user-agent'] || 'unknown';
  const cookies = parseCookies(req.headers.cookie);
  const viewQuery = req.query.view as string | undefined;

  // Handle explicit view preference query
  if (viewQuery === 'legacy' || viewQuery === 'modern') {
    res.setHeader('Set-Cookie', `iptv_view_mode=${viewQuery}; Path=/; Max-Age=31536000; SameSite=Lax`);
  } else if (viewQuery === 'reset') {
    res.setHeader('Set-Cookie', 'iptv_view_mode=; Path=/; Max-Age=0; SameSite=Lax');
  }

  // Handle host configuration cookie for E72 / CorePlayer LAN setup
  const hostParam = (req.query.host as string) || (req.query.ip as string);
  if (hostParam && hostParam.trim()) {
    res.setHeader('Set-Cookie', `e72_host=${encodeURIComponent(hostParam.trim())}; Path=/; Max-Age=31536000; SameSite=Lax`);
  }

  const cookiePref = viewQuery === 'reset' ? undefined : (cookies['iptv_view_mode'] || undefined);
  const detected = detectDevice(ua, viewQuery !== 'reset' ? viewQuery : undefined, cookiePref, req.headers as any);
  (req as any).deviceInfo = detected;
  (req as any).cookiePref = cookiePref;
  (req as any).e72Host = hostParam || cookies['e72_host'] || '';
  next();
});

// Health check endpoint (Render standard: supports both /health and /healthz)
app.get(['/health', '/healthz'], async (_req: Request, res: Response) => {
  try {
    const channels = await getAllChannels();
    const groups = await getAllGroups();
    const playlists = await getPlaylists();
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      channelsCount: channels.length,
      groupsCount: groups.length,
      playlistsCount: playlists.length,
      uptime: process.uptime(),
      dbConnected: Boolean(process.env.DATABASE_URL),
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Device detection API
app.get('/api/device-info', (req: Request, res: Response) => {
  const deviceInfo = (req as any).deviceInfo;
  const cookiePref = (req as any).cookiePref;
  res.json({
    ...deviceInfo,
    preference: cookiePref || 'auto',
    clientIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown',
  });
});

// Downloadable E72 Local HTTP Bridge script (Python & Node.js)
app.get(['/api/tools/e72-relay.py', '/e72-relay.py'], (req: Request, res: Response) => {
  const scriptPath = path.resolve(__dirname, 'e72-relay.py');
  if (fs.existsSync(scriptPath)) {
    let content = fs.readFileSync(scriptPath, 'utf-8');
    // Dynamically inject the deployment's live URL (Render, custom domain, or local host)
    const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim() || req.get('host') || process.env.RENDER_EXTERNAL_HOSTNAME || '127.0.0.1:3000';
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0].trim() || (req.secure ? 'https' : (process.env.RENDER ? 'https' : 'http'));
    const targetUrl = process.env.RENDER_EXTERNAL_URL || `${proto}://${host}`;
    content = content.replace(/DEFAULT_TARGET\s*=\s*[^\r\n]+/, `DEFAULT_TARGET = "${targetUrl}"`);

    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="e72-relay.py"');
    res.send(content);
  } else {
    res.status(404).send('Relay script not found');
  }
});

app.get(['/api/tools/e72-relay.js', '/e72-relay.js'], (req: Request, res: Response) => {
  const scriptPath = path.resolve(__dirname, 'e72-relay.js');
  if (fs.existsSync(scriptPath)) {
    let content = fs.readFileSync(scriptPath, 'utf-8');
    // Dynamically inject the deployment's live URL (Render, custom domain, or local host)
    const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim() || req.get('host') || process.env.RENDER_EXTERNAL_HOSTNAME || '127.0.0.1:3000';
    const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0].trim() || (req.secure ? 'https' : (process.env.RENDER ? 'https' : 'http'));
    const targetUrl = process.env.RENDER_EXTERNAL_URL || `${proto}://${host}`;
    content = content.replace(/const DEFAULT_TARGET\s*=\s*[^;\r\n]+;/, `const DEFAULT_TARGET = '${targetUrl}';`);

    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="e72-relay.js"');
    res.send(content);
  } else {
    res.status(404).send('Relay script not found');
  }
});

// Mount IPTV routes & Admin routes
app.use(channelsRouter);
app.use(playerRouter);
app.use(adminRouter);
app.use(proxyRouter);
app.use(translateRouter);

// -----------------------------------------------------------------------------
// LEGACY NOKIA E72 / SYMBIAN S60 ROUTES
// Pure Server-Side Rendered, Ultra-Lightweight, 0 Modern JS required
// -----------------------------------------------------------------------------

async function handleLegacyHome(req: Request, res: Response) {
  const page = parseInt(req.query.page as string, 10) || 1;
  const group = (req.query.group as string) || 'all';
  const query = (req.query.q as string) || '';
  const limit = 12; // 12 channels per page for Nokia QVGA screen

  let allChannels = await getAllChannels();
  if (group !== 'all') {
    allChannels = allChannels.filter((c) => c.group.toLowerCase() === group.toLowerCase());
  }
  if (query.trim()) {
    const qLower = query.toLowerCase().trim();
    allChannels = allChannels.filter(
      (c) =>
        c.name.toLowerCase().includes(qLower) ||
        c.group.toLowerCase().includes(qLower) ||
        (c.description && c.description.toLowerCase().includes(qLower))
    );
  }

  const totalChannels = allChannels.length;
  const totalPages = Math.ceil(totalChannels / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedChannels = allChannels.slice(startIndex, startIndex + limit);

  const groups = await getAllGroups();

  const customHost = (req.query.host as string) || (req.query.ip as string) || (req as any).e72Host || '';
  const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim();
  const host = customHost || forwardedHost || req.get('host') || process.env.RENDER_EXTERNAL_HOSTNAME || '';
  const resChoice = ((req.query.res as string) || '240p').toLowerCase();
  const playerChoice = (((req.query.player as string) || (req.query.app as string) || 'all').toLowerCase()) as 'all' | 'coreplayer' | 'realplayer';
  const deviceInfo = (req as any).deviceInfo;
  const isOperaMini = Boolean(
    deviceInfo?.isOperaMini ||
    /opera mini|opera mobi/i.test(req.headers['user-agent'] || '') ||
    req.headers['x-operamini-features'] ||
    req.headers['x-operamini-phone-ua']
  );

  const html = renderLegacyHome({
    channels: paginatedChannels,
    totalChannels,
    currentPage: page,
    totalPages,
    currentGroup: group,
    groups,
    searchQuery: query,
    host,
    resChoice,
    isOperaMini,
    playerChoice,
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

async function handleLegacyChannel(req: Request, res: Response) {
  const channel = await getChannelById(req.params.id);
  if (!channel) {
    res.status(404).setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(renderLegacyNotFound());
  }

  const customHost = (req.query.host as string) || (req.query.ip as string) || (req as any).e72Host || '';
  const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim();
  const host = customHost || forwardedHost || req.get('host') || process.env.RENDER_EXTERNAL_HOSTNAME || '';
  const resChoice = ((req.query.res as string) || '240p').toLowerCase();
  const playerChoice = (((req.query.player as string) || (req.query.app as string) || 'all').toLowerCase()) as 'all' | 'coreplayer' | 'realplayer';
  const html = renderLegacyChannel(channel, host, resChoice, playerChoice);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

function handleCorePlayerGuide(req: Request, res: Response) {
  const customHost = (req.query.host as string) || (req.query.ip as string) || (req as any).e72Host || '';
  const forwardedHost = (req.headers['x-forwarded-host'] as string)?.split(',')[0].trim();
  const host = customHost || forwardedHost || req.get('host') || process.env.RENDER_EXTERNAL_HOSTNAME || '';
  const resChoice = ((req.query.res as string) || '240p').toLowerCase();
  const html = renderCorePlayerGuide(host, resChoice);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// Explicit legacy and Opera Mini routes
app.get(['/legacy/guide', '/e72/guide', '/operamini/guide'], (req, res) => {
  handleCorePlayerGuide(req, res);
});

app.get(['/legacy', '/operamini', '/e72'], (req, res) => {
  handleLegacyHome(req, res).catch(() => res.status(500).send('Lỗi máy chủ'));
});

app.get(['/legacy/channel/:id', '/e72/channel/:id', '/operamini/channel/:id'], (req, res) => {
  handleLegacyChannel(req, res).catch(() => res.status(500).send('Lỗi máy chủ'));
});

app.get('/legacy/search', (req, res) => {
  handleLegacyHome(req, res).catch(() => res.status(500).send('Lỗi máy chủ'));
});

// Conditional Root & Channel Routes:
// Automatically detects Nokia E72 / Symbian devices and serves legacy HTML!
app.get('/channel/:id', (req: Request, res: Response, next: NextFunction) => {
  const deviceInfo = (req as any).deviceInfo;
  if (deviceInfo.recommendedView === 'legacy') {
    return handleLegacyChannel(req, res).catch(next);
  }
  next();
});

app.get('/', (req: Request, res: Response, next: NextFunction) => {
  const deviceInfo = (req as any).deviceInfo;
  if (deviceInfo.recommendedView === 'legacy') {
    return handleLegacyHome(req, res).catch(next);
  }
  next();
});

// -----------------------------------------------------------------------------
// MODERN WEB APPLICATION (React 19 + Vite)
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    // Development mode with Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Production mode: Serve built dist files
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('[Warning] dist directory not found. Please run "npm run build".');
      app.get('*', (req, res) => {
        handleLegacyHome(req, res).catch(() => res.status(500).send('Lỗi'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=================================================`);
    console.log(` IPTV Service running on http://0.0.0.0:${PORT}`);
    console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Auto Device Detection: ENABLED`);
    console.log(` Nokia E72 Mode: http://0.0.0.0:${PORT}/legacy`);
    console.log(` Modern Web Mode: http://0.0.0.0:${PORT}/?view=modern`);
    console.log(` Admin Portal:   http://0.0.0.0:${PORT}/admin`);
    console.log(` M3U Playlist:   http://0.0.0.0:${PORT}/playlist.m3u`);
    console.log(` Health Check:   http://0.0.0.0:${PORT}/health`);
    console.log(`=================================================`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
