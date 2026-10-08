import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import type { Channel } from '../src/types/iptv.js';
import { parseM3U, generateM3U } from '../utils/m3uParser.js';
import {
  getAllActiveChannels,
  getChannelById as getChannelFromDb,
} from '../src/db/storage.js';

const router = Router();

// Synchronous / async access helpers
export async function getAllChannels(): Promise<Channel[]> {
  return await getAllActiveChannels();
}

export async function getChannelById(id: string): Promise<Channel | null> {
  return await getChannelFromDb(id);
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
    const groupsSet = new Set<string>();
    const counts: Record<string, number> = {};

    for (const c of channels) {
      const g = (c.group && c.group.trim()) || 'Khác';
      groupsSet.add(g);
      counts[g] = (counts[g] || 0) + 1;
    }

    const groups = Array.from(groupsSet).sort((a, b) => a.localeCompare(b));

    res.json({
      groups,
      counts,
      totalChannels: channels.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, groups: [], counts: {}, totalChannels: 0 });
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

// Export dynamic M3U playlist file for VLC / CorePlayer / Nokia E72
router.get(
  [
    '/playlist.m3u',
    '/data/channels.m3u',
    '/api/channels/coreplayer.m3u',
    '/api/channels/e72.m3u',
  ],
  async (req: Request, res: Response) => {
    try {
      const channels = await getAllActiveChannels();
      const isCorePlayer =
        req.path.includes('coreplayer') ||
        req.path.includes('e72') ||
        req.query.target === 'coreplayer' ||
        req.query.profile === 'e72';

      if (isCorePlayer) {
        // CorePlayer on Nokia E72 (Symbian S60) CANNOT negotiate modern TLS 1.2/1.3 handshakes!
        // Connecting to HTTPS causes Symbian error: "HTTPS hỗ trợ các thỏa thuận không được".
        // Therefore, CorePlayer playlists must strictly use plain 'http://' and support custom LAN IP.
        const customHost = (req.query.host as string) || (req.query.ip as string) || (req.headers['x-custom-host'] as string);
        const host = customHost || req.get('host') || '127.0.0.1:3000';
        const proto = (req.query.proto as string) || 'http'; // Force plain HTTP for CorePlayer

        let body = '#EXTM3U\r\n';
        for (const ch of channels) {
          const safeName = sanitizeM3uFilename(ch.name, `ch_${ch.id}`);
          const streamUrl = `${proto}://${host}/api/channel/${encodeURIComponent(ch.id)}/e72.ts`;
          body += `#EXTINF:0,${safeName}\r\n${streamUrl}\r\n`;
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

// Live MPEG-TS stream endpoint specifically designed for CorePlayer & Nokia E72 (Symbian S60)
// - /e72.ts: Transcodes on-the-fly to QVGA 320x240, H.264 Baseline L1.3, AAC 64k (Smooth on ARM11 600MHz CPU)
// - /live.ts: Remuxes on-the-fly with "-c copy" (Lightweight, preserves original resolution)
router.get(
  [
    '/api/channel/:id/e72.ts',
    '/api/channel/:id/live.ts',
    '/api/channel/:id/stream.ts'
  ],
  async (req: Request, res: Response) => {
    try {
      const channel = await getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).send('Channel not found');
      }

      const streamUrl = channel.stream_url;

      res.setHeader('Content-Type', 'video/mp2t');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Connection', 'close');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const resQuery = ((req.query.res as string) || (req.query.resolution as string) || (req.query.profile as string) || '').toLowerCase();
      const isE72Endpoint = req.path.includes('e72');
      const isLiveEndpoint = req.path.includes('live');

      // Determine transcoding profile:
      // - 180p: Ultra-light, 240x180, 15fps, 180kbps (Instant loading on 2G/3G or slow cellular)
      // - 240p: Standard QVGA, 320x240, 20fps, 350kbps (Native pixel match for Nokia E72 screen)
      // - 360p: Smooth SD, 640x360, 24fps, 650kbps (Smooth for mobile web and low bandwidth)
      // - 480p: DVD SD, 854x480, 25fps, 1100kbps (Standard web)
      // - 720p: HD, 1280x720, 30fps, 1800kbps (High definition)
      // - copy: Direct remuxing without re-encoding
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

      if (profile === 'copy') {
        ffmpegArgs = [
          '-re',
          '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
          '-i', streamUrl,
          '-c', 'copy',
          '-f', 'mpegts',
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
          '-re',
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
          '-c:a', 'aac',
          '-b:a', config.bA,
          '-ar', config.ar,
          '-ac', '2',
          '-f', 'mpegts',
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

// Export single-channel M3U / M3U8 playlist file for VLC Media Player and Nokia CorePlayer
router.get(
  [
    '/api/channel/:id/vlc.m3u',
    '/api/channel/:id/vlc.m3u8',
    '/api/channel/:id/stream.m3u',
    '/api/channel/:id/stream.m3u8',
    '/api/channel/:id/coreplayer.m3u',
    '/api/channel/:id/e72.m3u',
  ],
  async (req: Request, res: Response) => {
    try {
      const channel = await getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).send('#EXTM3U\r\n# Kênh không tồn tại\r\n');
      }
      const isM3u8 = req.path.endsWith('.m3u8');
      const isCorePlayer = req.path.includes('coreplayer') || req.path.includes('e72');
      const safeAsciiName = sanitizeM3uFilename(channel.name, `channel_${channel.id}`);
      const cleanDisplayName = channel.name.replace(/["\r\n]/g, '').trim();

      const customHost = (req.query.host as string) || (req.query.ip as string) || (req.headers['x-custom-host'] as string);
      const host = customHost || req.get('host') || '127.0.0.1:3000';
      // CorePlayer on Symbian S60 requires plain HTTP ('http://'). HTTPS causes "HTTPS hỗ trợ các thỏa thuận không được".
      const proto = isCorePlayer
        ? ((req.query.proto as string) || 'http')
        : ((req.headers['x-forwarded-proto'] as string) || req.protocol || 'http');
      const resQuery = ((req.query.res as string) || (req.query.resolution as string) || '').toLowerCase();
      const resParam = resQuery ? `?res=${encodeURIComponent(resQuery)}` : '';

      const e72TsUrl = `${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts${resParam}`;
      const liveTsUrl = `${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/live.ts`;

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
          entries += `#EXTINF:0,${safeAsciiName} [180p Sieu Nhe - Mang Yeu 2G-3G]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=180p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=240p\r\n`;
        } else if (resQuery === '360p') {
          entries += `#EXTINF:0,${safeAsciiName} [360p SD - Man Hinh Lon]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=360p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=240p\r\n`;
        } else {
          entries += `#EXTINF:0,${safeAsciiName} [240p QVGA Chuan E72 - Muot Ma]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=240p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [180p Sieu Nhe - Tai Nhanh Mang Yeu]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=180p\r\n`;
          entries += `#EXTINF:0,${safeAsciiName} [360p SD - Net Hon]\r\n${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/e72.ts?res=360p\r\n`;
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
        `attachment; filename="${safeAsciiName}.${fileExt}"`
      );
      res.send(Buffer.from(m3uBody, 'utf-8'));
    } catch (err: any) {
      res.status(500).send('#EXTM3U\r\n# Error generating channel playlist\r\n');
    }
  }
);

export default router;
