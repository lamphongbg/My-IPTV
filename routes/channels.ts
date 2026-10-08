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

// API: Get unique groups with channel counts and total channels
router.get('/api/groups', async (_req: Request, res: Response) => {
  try {
    const channels = await getAllActiveChannels();
    const countMap: Record<string, number> = {};

    for (const c of channels) {
      const grp = (c.group && c.group.trim()) ? c.group.trim() : 'Khác';
      countMap[grp] = (countMap[grp] || 0) + 1;
    }

    // Sort groups: Priority categories first, then alphabetical
    const priorityGroups = ['VTV', 'VTC', 'HTV', 'Tin tức', 'Thể thao', 'Giải trí', 'Khoa học', 'Quốc tế', 'Phim', 'Movies', 'News', 'Sports', 'General', 'Music'];
    const groupsList = Object.keys(countMap).sort((a, b) => {
      const pA = priorityGroups.indexOf(a);
      const pB = priorityGroups.indexOf(b);
      if (pA !== -1 && pB !== -1) return pA - pB;
      if (pA !== -1) return -1;
      if (pB !== -1) return 1;
      return a.localeCompare(b);
    });

    res.json({
      totalChannels: channels.length,
      groups: groupsList,
      counts: countMap,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Parse custom M3U text preview
router.post('/api/parse-m3u', (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing M3U content in request body' });
    }

    const parsed = parseM3U(content);
    res.json({
      success: true,
      count: parsed.length,
      channels: parsed,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to parse M3U', message: err.message });
  }
});

// Export dynamic M3U playlist file for VLC / CorePlayer
router.get(['/playlist.m3u', '/data/channels.m3u'], async (_req: Request, res: Response) => {
  try {
    const channels = await getAllActiveChannels();
    const m3u = generateM3U(channels);
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="playlist.m3u"');
    res.send(m3u);
  } catch (err: any) {
    res.status(500).send('#EXTM3U\n# Error generating playlist');
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

// Live MPEG-TS stream endpoint specifically designed for CorePlayer (Symbian S60 / Mobile)
// Remuxes HLS (.m3u8) on-the-fly into continuous MPEG-TS packets using ffmpeg (-c copy)
// CorePlayer natively supports MPEG-TS container with H.264 / AAC
router.get(['/api/channel/:id/live.ts', '/api/channel/:id/stream.ts'], async (req: Request, res: Response) => {
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

    // Spawn ffmpeg with copy codecs: 0 re-encoding, extremely lightweight
    const ffmpeg = spawn('ffmpeg', [
      '-re',
      '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
      '-i', streamUrl,
      '-c', 'copy',
      '-f', 'mpegts',
      'pipe:1'
    ]);

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
      // Consume stderr so buffer does not block
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
});

// Export single-channel M3U / M3U8 playlist file for VLC Media Player and Nokia CorePlayer
router.get(
  [
    '/api/channel/:id/vlc.m3u',
    '/api/channel/:id/vlc.m3u8',
    '/api/channel/:id/stream.m3u',
    '/api/channel/:id/stream.m3u8',
    '/api/channel/:id/coreplayer.m3u',
  ],
  async (req: Request, res: Response) => {
    try {
      const channel = await getChannelById(req.params.id);
      if (!channel) {
        return res.status(404).send('#EXTM3U\r\n# Kênh không tồn tại\r\n');
      }
      const isM3u8 = req.path.endsWith('.m3u8');
      const isCorePlayer = req.path.includes('coreplayer');
      const safeAsciiName = sanitizeM3uFilename(channel.name, `channel_${channel.id}`);
      const cleanDisplayName = channel.name.replace(/["\r\n]/g, '').trim();

      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
      const host = req.get('host') || '127.0.0.1:3000';
      const liveTsUrl = `${proto}://${host}/api/channel/${encodeURIComponent(channel.id)}/live.ts`;

      let m3uBody: string;

      if (isCorePlayer) {
        // STRICT CorePlayer compatibility:
        // 1. NO UTF-8 BOM (\uFEFF) - BOM corrupts CorePlayer's parser causing "Error opening file"
        // 2. Simple EXTINF without quotes or unsupported IPTV metadata tags
        // 3. Direct MPEG-TS live remux (.ts) as primary stream (CorePlayer natively plays MPEG-TS, but NOT .m3u8)
        // 4. Raw stream URL as secondary entry
        m3uBody = `#EXTM3U\r\n#EXTINF:0,${safeAsciiName} (MPEG-TS Live)\r\n${liveTsUrl}\r\n#EXTINF:0,${safeAsciiName} (Stream Goc)\r\n${channel.stream_url}\r\n`;
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
