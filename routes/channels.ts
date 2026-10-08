import { Router, Request, Response } from 'express';
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

export default router;
