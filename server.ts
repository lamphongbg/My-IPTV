import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import channelsRouter, { getAllChannels, getAllGroups, getChannelById } from './routes/channels.js';
import playerRouter from './routes/player.js';
import adminRouter from './routes/admin.js';
import proxyRouter from './routes/proxy.js';
import { getPlaylists } from './src/db/storage.js';
import { detectDevice } from './utils/deviceDetector.js';
import { renderLegacyHome, renderLegacyChannel, renderLegacyNotFound } from './views/legacyRenderer.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

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

  const cookiePref = viewQuery === 'reset' ? undefined : (cookies['iptv_view_mode'] || undefined);
  const detected = detectDevice(ua, viewQuery !== 'reset' ? viewQuery : undefined, cookiePref);
  (req as any).deviceInfo = detected;
  (req as any).cookiePref = cookiePref;
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

// Downloadable E72 Local HTTP Bridge script
app.get(['/api/tools/e72-relay.py', '/e72-relay.py'], (_req: Request, res: Response) => {
  const scriptPath = path.resolve(__dirname, 'e72-relay.py');
  if (fs.existsSync(scriptPath)) {
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="e72-relay.py"');
    res.sendFile(scriptPath);
  } else {
    res.status(404).send('Relay script not found');
  }
});

// Mount IPTV routes & Admin routes
app.use(channelsRouter);
app.use(playerRouter);
app.use(adminRouter);
app.use(proxyRouter);

// -----------------------------------------------------------------------------
// LEGACY NOKIA E72 / SYMBIAN S60 ROUTES
// Pure Server-Side Rendered, Ultra-Lightweight, 0 Modern JS required
// -----------------------------------------------------------------------------

async function handleLegacyHome(req: Request, res: Response) {
  const page = parseInt(req.query.page as string, 10) || 1;
  const group = (req.query.group as string) || 'all';
  const query = (req.query.q as string) || '';
  const limit = 10; // 10 channels per page for Nokia QVGA screen

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

  const host = (req.query.host as string) || (req.query.ip as string) || '';

  const html = renderLegacyHome({
    channels: paginatedChannels,
    totalChannels,
    currentPage: page,
    totalPages,
    currentGroup: group,
    groups,
    searchQuery: query,
    host,
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

  const host = (req.query.host as string) || (req.query.ip as string) || '';
  const html = renderLegacyChannel(channel, host);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
}

// Explicit legacy routes
app.get('/legacy', (req, res) => {
  handleLegacyHome(req, res).catch(() => res.status(500).send('Lỗi máy chủ'));
});

app.get('/legacy/channel/:id', (req, res) => {
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
