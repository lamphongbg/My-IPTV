import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import type { Channel } from '../src/types/iptv.js';
import { parseM3U, generateM3U } from '../utils/m3uParser.js';
import {
  getAllActiveChannels,
  getAllChannelsAdmin,
  getChannelById as getChannelFromDb,
} from '../src/db/storage.js';

const router = Router();

// Synchronous / async access helpers
export async function getAllChannels(): Promise<Channel[]> {
  return await getAllActiveChannels();
}

export async function getChannelById(id: string): Promise<Channel | null> {
  if (!id) return null;
  const cleanId = id.replace(/\.(m3u|m3u8|pls|ts|ram|rpm|mp4|3gp|coreplayer|realplayer)$/i, '').trim();

  // 1. Direct DB lookup by ID
  const direct = await getChannelFromDb(cleanId);
  if (direct) return direct;

  // 2. Lookup by numeric index (1-based: 1 = channel 1, 2 = channel 2...)
  const num = parseInt(cleanId, 10);
  const all = await getAllActiveChannels();
  if (!isNaN(num) && num > 0 && num <= all.length) {
    return all[num - 1];
  }

  // 3. Lookup by slug/name match
  const normalized = cleanId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const matched = all.find(
    (c) =>
      c.id.toLowerCase() === cleanId.toLowerCase() ||
      c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normalized
  );
  return matched || null;
}

export async function getAllGroups(): Promise<string[]> {
  const channels = await getAllActiveChannels();
  const groupsSet = new Set<string>();
  for (const c of channels) {
    if (c.group && c.group.trim()) groupsSet.add(c.group.trim());
  }
  return Array.from(groupsSet);
}

// API: Get groups/categories list with channel counts
router.get(['/api/groups', '/api/categories'], async (_req: Request, res: Response) => {
  try {
    const channels = await getAllActiveChannels();
    const allChannels = await getAllChannelsAdmin();
    const groupsSet = new Set<string>();
    const counts: Record<string, number> = {};

    for (const c of channels) {
      const g = (c.group && c.group.trim()) || 'Khác';
      groupsSet.add(g);
      counts[g] = (counts[g] || 0) + 1;
    }

    const groups = Array.from(groupsSet).sort((a, b) => a.localeCompare(b));
    const offlineCount = allChannels.filter((c) => c.status === 'offline').length;

    res.json({
      groups,
      counts,
      totalChannels: allChannels.length,
      onlineChannels: channels.length,
      offlineChannels: offlineCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, groups: [], counts: {}, totalChannels: 0, onlineChannels: 0, offlineChannels: 0 });
  }
});

// API: Get channels with server-side search, group filtering, and pagination
router.get('/api/channels', async (req: Request, res: Response) => {
  try {
    const { q, group, page, limit } = req.query;
    let result = await getAllActiveChannels();

    // 1. Group filter
    if (typeof group === 'string' && group !== 'all' && group.trim()) {
      const gLower = group.toLowerCase().trim();
      result = result.filter((c) => c.group && c.group.toLowerCase().trim() === gLower);
    }

    // 2. Search query filter
    if (typeof q === 'string' && q.trim()) {
      const query = q.toLowerCase().trim();
      result = result.filter(
        (c) =>
          (c.name && c.name.toLowerCase().includes(query)) ||
          (c.group && c.group.toLowerCase().includes(query)) ||
          (c.tvg_id && c.tvg_id.toLowerCase().includes(query)) ||
          (c.description && c.description.toLowerCase().includes(query))
      );
    }

    const total = result.length;

    // Handle limit: support limit=all or numeric limit
    if (limit === 'all' || limit === '0') {
      return res.json({
        total,
        page: 1,
        limit: total,
        totalPages: 1,
        channels: result,
      });
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.max(1, Math.min(500, parseInt(limit as string, 10) || 60)); // Default 60 items per page
    const totalPages = Math.ceil(total / limitNum) || 1;
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = result.slice(startIndex, startIndex + limitNum);

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
      channels: paginated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to extract custom LAN host from query or e72_host cookie or Render proxy
function extractE72Host(req: Request): string {
  const queryHost = (req.query.host as string) || (req.query.ip as string) || (req.headers['x-custom-host'] as string);
  if (queryHost && queryHost.trim()) return queryHost.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)e72_host=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]).trim();
      if (decoded) return decoded.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    } catch {
      if (match[1].trim()) return match[1].trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    }
  }
  return '';
}

// Helper to determine the best external host on Render or Local
function resolveEffectiveServerHost(req: Request): string {
  const custom = extractE72Host(req);
  if (custom) return custom;
  const forwarded = req.headers['x-forwarded-host'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (req.get('host')) {
    return req.get('host')!.trim();
  }
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return process.env.RENDER_EXTERNAL_HOSTNAME.trim();
  }
  return '127.0.0.1:3000';
}

// Export dynamic M3U and PLS playlist files for VLC / CorePlayer / Nokia E72
router.get(
  [
    '/playlist.m3u',
    '/playlist.pls',
    '/data/channels.m3u',
    '/api/channels/coreplayer.m3u',
    '/api/channels/coreplayer.pls',
    '/api/channels/e72.m3u',
    '/api/channels/e72.pls',
    '/playlist_e72.m3u',
    '/playlist_e72.pls',
    '/realplayer.ram',
    '/playlist_realplayer.ram',
    '/api/channels/realplayer.ram',
    '/api/channels/realplayer.m3u',
  ],
  async (req: Request, res: Response) => {
    try {
      const channels = await getAllActiveChannels();
      const isRealPlayerRam = req.path.includes('realplayer') && req.path.endsWith('.ram');
      const isCorePlayer =
        req.path.includes('coreplayer') ||
        req.path.includes('e72') ||
        req.query.target === 'coreplayer' ||
        req.query.profile === 'e72';
      const isPls = req.path.endsWith('.pls');

      const host = resolveEffectiveServerHost(req);

      if (isRealPlayerRam) {
        // RealPlayer Batch Playlist (.ram file) for Nokia E72 / Symbian S60
        // RealPlayer on Symbian handles HTTP links directly
        const proto = (req.query.proto as string) || 'http';
        const resChoice = ((req.query.res as string) || '240p').toLowerCase();
        let ramBody = '';
        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          ramBody += `${proto}://${host}/c/${encodeURIComponent(ch.id)}.mp4?res=${resChoice}&player=realplayer\r\n`;
        }
        res.setHeader('Content-Type', 'audio/x-pn-realaudio; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="nokia_e72_realplayer.ram"'
        );
        return res.send(Buffer.from(ramBody, 'utf-8'));
      }

      if (isCorePlayer) {
        // CorePlayer on Nokia E72 (Symbian S60) CANNOT negotiate modern TLS 1.2/1.3 handshakes!
        // Connecting to HTTPS causes Symbian error: "HTTPS hỗ trợ các thỏa thuận không được".
        // Therefore, CorePlayer playlists must strictly use plain 'http://' and support custom LAN IP.
        const proto = (req.query.proto as string) || 'http'; // Force plain HTTP for CorePlayer
        const resChoice = ((req.query.res as string) || '240p').toLowerCase();
        const resParam = `?res=${resChoice}`;

        if (isPls) {
          // Standard PLS (SHOUTcast / Winamp Playlist) supported by CorePlayer 1.36
          let plsBody = `[playlist]\r\nNumberOfEntries=${channels.length}\r\n`;
          for (let i = 0; i < channels.length; i++) {
            const ch = channels[i];
            const idx = i + 1;
            const safeName = sanitizeM3uFilename(ch.name, `ch_${ch.id}`);
            const streamUrl = `${proto}://${host}/c/${encodeURIComponent(ch.id)}.ts${resParam}`;
            plsBody += `File${idx}=${streamUrl}\r\nTitle${idx}=${idx}. ${safeName} [${resChoice.toUpperCase()}]\r\nLength${idx}=-1\r\n`;
          }
          plsBody += `Version=2\r\n`;

          res.setHeader('Content-Type', 'audio/x-scpls; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Content-Disposition', 'attachment; filename="nokia_e72_playlist.pls"');
          return res.send(Buffer.from(plsBody, 'utf-8'));
        }

        // Standard M3U for CorePlayer
        let body = '#EXTM3U\r\n';
        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          const idx = i + 1;
          const safeName = sanitizeM3uFilename(ch.name, `ch_${ch.id}`);
          const streamUrl = `${proto}://${host}/c/${encodeURIComponent(ch.id)}.ts${resParam}`;
          body += `#EXTINF:0,${idx}. ${safeName} [${resChoice.toUpperCase()}]\r\n${streamUrl}\r\n`;
        }
        res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="nokia_e72_playlist.m3u"'
        );
        return res.send(Buffer.from(body, 'utf-8'));
      }

      if (isPls) {
        let plsBody = `[playlist]\r\nNumberOfEntries=${channels.length}\r\n`;
        for (let i = 0; i < channels.length; i++) {
          const ch = channels[i];
          const idx = i + 1;
          plsBody += `File${idx}=${ch.stream_url}\r\nTitle${idx}=${ch.name}\r\nLength${idx}=-1\r\n`;
        }
        plsBody += `Version=2\r\n`;
        res.setHeader('Content-Type', 'audio/x-scpls; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="playlist.pls"');
        return res.send(Buffer.from(plsBody, 'utf-8'));
      }

      const m3u = generateM3U(channels);
      res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u"');
      res.send(m3u);
    } catch (err: any) {
      res.status(500).send('#EXTM3U\r\n# Error generating playlist\r\n');
    }
  }
);

// API: Get single channel
router.get('/api/channels/:id', async (req: Request, res: Response) => {
  try {
    const channel = await getChannelFromDb(req.params.id);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json(channel);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to generate safe ASCII filenames for legacy Symbian S60 FAT32 and modern browsers
function sanitizeM3uFilename(name: string, fallback: string = 'channel'): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 32);
  return ascii || fallback;
}

// Live stream endpoints for CorePlayer (MPEG-TS) & RealPlayer (MP4/3GP/RTSP) on Nokia E72 (Symbian S60)
router.get(
  [
    '/api/channel/:id/e72.ts',
    '/api/channel/:id/live.ts',
    '/api/channel/:id/stream.ts',
    '/api/channel/:id/realplayer.mp4',
    '/api/channel/:id/realplayer.3gp',
    '/c/:id',
    '/c/:id.ts',
    '/c/:id.mp4',
    '/c/:id.3gp',
    '/s/:id',
    '/s/:id.ts',
    '/s/:id.mp4',
    '/s/:id.3gp',
    '/realplayer/:id',
    '/realplayer/:id.mp4',
    '/realplayer/:id.3gp',
    '/channel/:id.ts',
    '/live/:id.ts',
  ],
  async (req: Request, res: Response, next: any) => {
    // If request has playlist or launcher extension, let the launcher handler handle it
    if (
      req.path.endsWith('.m3u') ||
      req.path.endsWith('.m3u8') ||
      req.path.endsWith('.pls') ||
      req.path.endsWith('.ram') ||
      req.path.endsWith('.rpm')
    ) {
      return next();
    }

    try {
      const channel = await getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).send('Channel not found');
      }

      const streamUrl = channel.stream_url;
      const isRealPlayer =
        req.path.endsWith('.mp4') ||
        req.path.endsWith('.3gp') ||
        req.path.includes('realplayer') ||
        req.query.player === 'realplayer';

      const contentType = req.path.endsWith('.3gp') ? 'video/3gpp' : isRealPlayer ? 'video/mp4' : 'video/mp2t';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'close');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const resQuery = ((req.query.res as string) || (req.query.resolution as string) || (req.query.profile as string) || '').toLowerCase();
      const isE72Endpoint = req.path.includes('e72') || req.path.startsWith('/c/') || req.path.startsWith('/s/') || isRealPlayer;
      const isLiveEndpoint = req.path.includes('live') && !isRealPlayer;

      // Determine transcoding profile:
      let profile: '180p' | '240p' | '360p' | '480p' | '720p' | 'copy';

      if (resQuery === '180p' || resQuery === '180' || resQuery === 'nqvga' || resQuery === 'ultralight') {
        profile = '180p';
      } else if (resQuery === '240p' || resQuery === '240' || resQuery === 'qvga' || resQuery === 'e72') {
        profile = '240p';
      } else if (resQuery === '360p' || resQuery === '360' || resQuery === 'sd' || resQuery === 'low') {
        profile = '360p';
      } else if (resQuery === '480p' || resQuery === '480' || resQuery === 'hq') {
        profile = '480p';
      } else if (resQuery === '720p' || resQuery === '720' || resQuery === 'hd') {
        profile = '720p';
      } else if (resQuery === 'copy' || resQuery === 'original' || resQuery === 'goc' || isLiveEndpoint) {
        profile = 'copy';
      } else if (isE72Endpoint) {
        profile = '240p'; // Default for Nokia E72
      } else {
        profile = 'copy';
      }

      let ffmpegArgs: string[];

      if (isRealPlayer) {
        // Native Progressive MP4/3GP container for Symbian S60v3 RealPlayer hardware decoder
        // Strict parameters: H.264 Baseline Profile L1.2, 320x240, 15fps, AAC-LC 48kbps, fragmented MP4
        const config = {
          '180p': { w: 240, h: 180, fps: '15', bV: '160k', maxV: '200k', buf: '320k', bA: '40k', ar: '22050' },
          '240p': { w: 320, h: 240, fps: '18', bV: '250k', maxV: '320k', buf: '500k', bA: '48k', ar: '22050' },
          '360p': { w: 480, h: 320, fps: '20', bV: '450k', maxV: '550k', buf: '800k', bA: '64k', ar: '32000' },
          '480p': { w: 640, h: 360, fps: '24', bV: '650k', maxV: '800k', buf: '1200k', bA: '64k', ar: '44100' },
          '720p': { w: 640, h: 360, fps: '24', bV: '650k', maxV: '800k', buf: '1200k', bA: '64k', ar: '44100' },
          'copy': { w: 320, h: 240, fps: '18', bV: '250k', maxV: '320k', buf: '500k', bA: '48k', ar: '22050' },
        }[profile];

        ffmpegArgs = [
          '-fflags', '+nobuffer+discardcorrupt',
          '-analyzeduration', '1500000',
          '-probesize', '1500000',
          '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
          '-i', streamUrl,
          '-vf', `scale=${config.w}:${config.h}:force_original_aspect_ratio=decrease,pad=${config.w}:${config.h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
          '-c:v', 'libx264',
          '-profile:v', 'baseline',
          '-level', '1.2',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-b:v', config.bV,
          '-maxrate', config.maxV,
          '-bufsize', config.buf,
          '-r', config.fps,
          '-g', '30',
          '-keyint_min', '15',
          '-sc_threshold', '0',
          '-c:a', 'aac',
          '-profile:a', 'aac_low',
          '-b:a', config.bA,
          '-ar', config.ar,
          '-ac', '2',
          '-f', 'mp4',
          '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
          'pipe:1'
        ];
      } else if (profile === 'copy') {
        ffmpegArgs = [
          '-fflags', '+nobuffer+discardcorrupt',
          '-analyzeduration', '1500000',
          '-probesize', '1500000',
          '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
          '-i', streamUrl,
          '-c', 'copy',
          '-f', 'mpegts',
          '-mpegts_flags', '+resend_headers',
          '-flush_packets', '1',
          'pipe:1'
        ];
      } else {
        const config = {
          '180p': { w: 240, h: 180, fps: '15', bV: '180k', maxV: '240k', buf: '400k', bA: '48k', ar: '32000' },
          '240p': { w: 320, h: 240, fps: '20', bV: '350k', maxV: '450k', buf: '800k', bA: '64k', ar: '44100' },
          '360p': { w: 640, h: 360, fps: '24', bV: '650k', maxV: '850k', buf: '1300k', bA: '96k', ar: '44100' },
          '480p': { w: 854, h: 480, fps: '25', bV: '1100k', maxV: '1400k', buf: '2200k', bA: '128k', ar: '44100' },
          '720p': { w: 1280, h: 720, fps: '30', bV: '1800k', maxV: '2200k', buf: '3600k', bA: '128k', ar: '44100' }
        }[profile];

        ffmpegArgs = [
          '-fflags', '+nobuffer+discardcorrupt',
          '-analyzeduration', '1500000',
          '-probesize', '1500000',
          '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
          '-i', streamUrl,
          '-vf', `scale=${config.w}:${config.h}:force_original_aspect_ratio=decrease,pad=${config.w}:${config.h}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
          '-c:v', 'libx264',
          '-profile:v', 'baseline',
          '-level', '1.3',
          '-preset', 'ultrafast',
          '-tune', 'zerolatency',
          '-b:v', config.bV,
          '-maxrate', config.maxV,
          '-bufsize', config.buf,
          '-r', config.fps,
          '-g', `${parseInt(config.fps, 10) * 2}`, // IDR keyframe every 2 seconds for instant tune-in
          '-keyint_min', `${config.fps}`,
          '-sc_threshold', '0',
          '-c:a', 'aac',
          '-profile:a', 'aac_low',
          '-b:a', config.bA,
          '-ar', config.ar,
          '-ac', '2',
          '-f', 'mpegts',
          '-mpegts_flags', '+resend_headers',
          '-flush_packets', '1',
          'pipe:1'
        ];
      }

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      ffmpeg.stdout.pipe(res);

      let isCleanedUp = false;
      const cleanup = () => {
        if (!isCleanedUp) {
          isCleanedUp = true;
          ffmpeg.stdout.unpipe(res);
          try {
            ffmpeg.kill('SIGTERM');
          } catch {
            // Ignore
          }
        }
      };

      req.on('close', cleanup);
      res.on('close', cleanup);
      res.on('finish', cleanup);

      ffmpeg.stderr.on('data', () => {
        // Consume stderr to avoid buffer blocking
      });

      ffmpeg.on('error', (err) => {
        console.warn('[FFmpeg Stream Error]', err.message);
        cleanup();
        if (!res.headersSent) {
          res.status(502).send('Error streaming channel');
        }
      });

      ffmpeg.on('close', () => {
        cleanup();
      });
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }
);

// Export single-channel M3U / M3U8 / PLS / RAM launcher files for VLC, Nokia CorePlayer & RealPlayer
router.get(
  [
    '/play/coreplayer/:id',
    '/play/realplayer/:id',
    '/launch/coreplayer/:id',
    '/launch/realplayer/:id',
    '/api/channel/:id/vlc.m3u',
    '/api/channel/:id/vlc.m3u8',
    '/api/channel/:id/stream.m3u',
    '/api/channel/:id/stream.m3u8',
    '/api/channel/:id/coreplayer.m3u',
    '/api/channel/:id/coreplayer.pls',
    '/api/channel/:id/realplayer.ram',
    '/api/channel/:id/realplayer.rpm',
    '/api/channel/:id/realplayer.m3u',
    '/api/channel/:id/e72.m3u',
    '/api/channel/:id/e72.pls',
    '/c/:id.m3u',
    '/c/:id.pls',
    '/c/:id.ram',
    '/c/:id.rpm',
    '/s/:id.m3u',
    '/s/:id.pls',
    '/s/:id.ram',
    '/realplayer/:id.ram',
  ],
  async (req: Request, res: Response) => {
    try {
      const channel = await getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).send('#EXTM3U\r\n# Kênh không tồn tại\r\n');
      }
      const isM3u8 = req.path.endsWith('.m3u8');
      const isPls = req.path.endsWith('.pls');
      const isRam =
        req.path.endsWith('.ram') ||
        req.path.endsWith('.rpm') ||
        req.path.includes('realplayer');
      const isCorePlayer =
        !isRam &&
        (req.path.includes('coreplayer') ||
          req.path.includes('e72') ||
          req.path.startsWith('/c/') ||
          req.path.startsWith('/s/') ||
          isPls);
      const safeAsciiName = sanitizeM3uFilename(channel.name, `channel_${channel.id}`);
      const cleanDisplayName = channel.name.replace(/["\r\n]/g, '').trim();

      const host = resolveEffectiveServerHost(req);
      const proto = (req.query.proto as string) || (req.headers['x-forwarded-proto'] ? (req.headers['x-forwarded-proto'] as string).split(',')[0].trim() : (req.secure ? 'https' : 'http'));
      const resQuery = ((req.query.res as string) || (req.query.resolution as string) || '').toLowerCase();
      const resParam = resQuery ? `?res=${encodeURIComponent(resQuery)}` : '';

      // Direct launch on Symbian S60 requires 'inline' Content-Disposition so browser invokes viewer app
      // If user explicitly asks for download (dl=1), serve as 'attachment' to save to memory card
      const isDownload = req.query.dl === '1' || req.query.download === '1';
      const dispositionType = isDownload ? 'attachment' : 'inline';

      if (isRam) {
        // RealPlayer launcher file (.ram) - Symbian S60 directly invokes RealPlayer.exe (UID 0x10005a3e)
        const realPlayerUrl = `${proto}://${host}/c/${encodeURIComponent(channel.id)}.mp4?res=${resQuery || '240p'}&player=realplayer\r\n`;
        res.setHeader('Content-Type', 'audio/x-pn-realaudio; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader(
          'Content-Disposition',
          `${dispositionType}; filename="${safeAsciiName}_realplayer.ram"`
        );
        return res.send(Buffer.from(realPlayerUrl, 'utf-8'));
      }

      const e72TsUrl = `${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts${resParam}`;
      const liveTsUrl = `${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/live.ts`;

      if (isPls) {
        const plsBody = `[playlist]\r\nNumberOfEntries=1\r\nFile1=${e72TsUrl}\r\nTitle1=${safeAsciiName} [${(resQuery || '240p').toUpperCase()}]\r\nLength1=-1\r\nVersion=2\r\n`;
        res.setHeader('Content-Type', 'audio/x-scpls; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeAsciiName}_e72.pls"`);
        return res.send(Buffer.from(plsBody, 'utf-8'));
      }

      let m3uBody: string;

      if (isCorePlayer) {
        // STRICT CorePlayer compatibility for Nokia E72:
        // 1. NO UTF-8 BOM (\uFEFF) - BOM corrupts CorePlayer's parser causing "Error opening file"
        // 2. Simple EXTINF without quotes or unsupported IPTV metadata tags
        // 3. Absolute full plain HTTP link to E72 QVGA stream (CorePlayer requires absolute URL when opened from SD card)
        // 4. Multi-resolution options so user can switch between ultra-light 180p, standard 240p QVGA, and 360p SD
        // 5. DO NOT include https:// streams - Symbian TLS negotiation failure triggers "HTTPS hỗ trợ các thỏa thuận không được"
        let entries = `#EXTM3U\r\n`;
        // Selected or default resolution first
        if (resQuery === '180p') {
          entries += `#EXTINF:0,${safeAsciiName} [180p Sieu Nhe - Mang Yeu 2G-3G]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=180p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=240p\r\n`;
        } else if (resQuery === '360p') {
          entries += `#EXTINF:0,${safeAsciiName} [360p SD - Man Hinh Lon]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=360p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=240p\r\n`;
        } else {
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72 - Muot Ma]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=240p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [180p Sieu Nhe - Tai Nhanh Mang Yeu]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=180p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [360p SD - Net Hon]\r\n${proto}://${host}/c/${encodeURIComponent(channel.id)}.ts?res=360p\r\n`;
        }
        entries += `#EXTINF:0,${safeAsciiName} [Goc MPEG-TS Khong Nen]\r\n${liveTsUrl}\r\n`;
        if (channel.stream_url && channel.stream_url.startsWith('http://')) {
          entries += `#EXTINF:0,${safeAsciiName} [Nguon Goc HTTP]\r\n${channel.stream_url}\r\n`;
        }
        m3uBody = entries;
      } else {
        // Standard VLC / Modern IPTV playlist
        const ext = isM3u8 ? 'm3u8' : 'm3u';
        m3uBody = `#EXTM3U\r\n#EXTINF:-1 tvg-id="${channel.tvg_id || channel.id}" tvg-name="${cleanDisplayName}" tvg-logo="${channel.logo || ''}" group-title="${channel.group || 'IPTV'}",${cleanDisplayName}\r\n${channel.stream_url}\r\n`;
      }

      // DO NOT prepend BOM (\uFEFF): Standard UTF-8 without BOM is compatible with CorePlayer, VLC, and RFC 8216
      const mimeType = isM3u8
        ? 'application/vnd.apple.mpegurl; charset=utf-8'
        : 'audio/x-mpegurl; charset=utf-8';

      const fileExt = isM3u8 ? 'm3u8' : 'm3u';

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${safeAsciiName}.${fileExt}"`
      );
      res.send(Buffer.from(m3uBody, 'utf-8'));
    } catch (err: any) {
      res.status(500).send('#EXTM3U\r\n# Error generating channel playlist\r\n');
    }
  }
);

export default router;
