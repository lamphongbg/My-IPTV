import fs from 'fs';
import path from 'path';
import pg from 'pg';
import type { Channel, Playlist, StreamTestResult } from '../types/iptv.js';
import { parseM3U } from '../../utils/m3uParser.js';

const { Pool } = pg;

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PLAYLISTS_FILE = path.join(DATA_DIR, 'playlists.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// PostgreSQL connection pool (if DATABASE_URL is set)
let pool: pg.Pool | null = null;
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  try {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });
    console.log('[Storage] Connected to PostgreSQL via DATABASE_URL');
  } catch (err) {
    console.error('[Storage] Failed to initialize PostgreSQL pool, falling back to local file storage:', err);
    pool = null;
  }
}

// Initialize tables in PostgreSQL
async function initPostgresTables() {
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        url TEXT,
        content TEXT,
        enabled BOOLEAN NOT NULL DEFAULT true,
        channel_count INT NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        playlist_id TEXT,
        name TEXT NOT NULL,
        "group" TEXT NOT NULL,
        logo TEXT,
        stream_url TEXT NOT NULL,
        format TEXT NOT NULL DEFAULT 'hls',
        tvg_id TEXT,
        tvg_name TEXT,
        video_codec TEXT,
        audio_codec TEXT,
        resolution TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        description TEXT,
        updated_at TEXT NOT NULL
      );
    `);
    console.log('[Storage] PostgreSQL tables verified.');
  } catch (err) {
    console.error('[Storage] Error initializing PostgreSQL tables:', err);
  }
}

// In-memory / file fallback state
let playlistsCache: Playlist[] = [];
let channelsCache: Channel[] = [];

// Seed default playlist and channels if empty
function seedDefaultData() {
  if (playlistsCache.length === 0) {
    let initialChannels: Channel[] = [];
    if (fs.existsSync(CHANNELS_FILE)) {
      try {
        initialChannels = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
      } catch (e) {
        console.warn('[Storage] Error parsing initial channels.json:', e);
      }
    }

    const defaultPlaylist: Playlist = {
      id: 'default-playlist',
      name: 'Danh sách VTV & Quốc tế (Mặc định)',
      type: 'content',
      enabled: true,
      channel_count: initialChannels.length,
      last_updated: new Date().toISOString(),
      status: 'active',
    };

    playlistsCache = [defaultPlaylist];
    channelsCache = initialChannels.map((c) => ({
      ...c,
      playlist_id: 'default-playlist',
      updated_at: new Date().toISOString(),
    }));

    saveFileState();
  }
}

function loadFileState() {
  try {
    if (fs.existsSync(PLAYLISTS_FILE)) {
      playlistsCache = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
    }
    if (fs.existsSync(CHANNELS_FILE)) {
      channelsCache = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Storage] Error reading local data files:', err);
  }

  if (playlistsCache.length === 0) {
    seedDefaultData();
  }
}

function saveFileState() {
  try {
    fs.writeFileSync(PLAYLISTS_FILE, JSON.stringify(playlistsCache, null, 2), 'utf-8');
    fs.writeFileSync(CHANNELS_FILE, JSON.stringify(channelsCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Storage] Error writing local data files:', err);
  }
}

// Initial bootstrap
if (pool) {
  initPostgresTables().catch(console.error);
} else {
  loadFileState();
}

// -----------------------------------------------------------------------------
// PLAYLIST OPERATIONS
// -----------------------------------------------------------------------------

export async function getPlaylists(): Promise<Playlist[]> {
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM playlists ORDER BY last_updated DESC');
      return res.rows;
    } catch (err) {
      console.error('[Storage] Postgres getPlaylists error:', err);
    }
  }
  return [...playlistsCache];
}

export async function getPlaylistById(id: string): Promise<Playlist | null> {
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM playlists WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[Storage] Postgres getPlaylistById error:', err);
    }
  }
  return playlistsCache.find((p) => p.id === id) || null;
}

export async function createPlaylist(data: {
  name: string;
  type: 'url' | 'content';
  url?: string;
  content?: string;
  enabled?: boolean;
}): Promise<Playlist> {
  const id = `pl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newPl: Playlist = {
    id,
    name: data.name.trim() || 'Playlist mới',
    type: data.type,
    url: data.url?.trim(),
    content: data.content,
    enabled: data.enabled !== undefined ? data.enabled : true,
    channel_count: 0,
    last_updated: new Date().toISOString(),
    status: 'syncing',
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO playlists (id, name, type, url, content, enabled, channel_count, last_updated, status, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          newPl.id,
          newPl.name,
          newPl.type,
          newPl.url || null,
          newPl.content || null,
          newPl.enabled,
          newPl.channel_count,
          newPl.last_updated,
          newPl.status,
          null,
        ]
      );
    } catch (err) {
      console.error('[Storage] Postgres createPlaylist error:', err);
    }
  } else {
    playlistsCache.unshift(newPl);
    saveFileState();
  }

  // Immediately sync channels for the new playlist
  await syncPlaylist(id);

  return (await getPlaylistById(id)) || newPl;
}

export async function updatePlaylist(id: string, data: Partial<Playlist>): Promise<Playlist | null> {
  const existing = await getPlaylistById(id);
  if (!existing) return null;

  const updated: Playlist = {
    ...existing,
    ...data,
    last_updated: new Date().toISOString(),
  };

  if (pool) {
    try {
      await pool.query(
        `UPDATE playlists SET name = $1, type = $2, url = $3, content = $4, enabled = $5,
         channel_count = $6, last_updated = $7, status = $8, error_message = $9 WHERE id = $10`,
        [
          updated.name,
          updated.type,
          updated.url || null,
          updated.content || null,
          updated.enabled,
          updated.channel_count,
          updated.last_updated,
          updated.status,
          updated.error_message || null,
          id,
        ]
      );
    } catch (err) {
      console.error('[Storage] Postgres updatePlaylist error:', err);
    }
  } else {
    const idx = playlistsCache.findIndex((p) => p.id === id);
    if (idx !== -1) {
      playlistsCache[idx] = updated;
      saveFileState();
    }
  }

  return updated;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  if (pool) {
    try {
      await pool.query('DELETE FROM channels WHERE playlist_id = $1', [id]);
      await pool.query('DELETE FROM playlists WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('[Storage] Postgres deletePlaylist error:', err);
      return false;
    }
  } else {
    playlistsCache = playlistsCache.filter((p) => p.id !== id);
    channelsCache = channelsCache.filter((c) => c.playlist_id !== id);
    saveFileState();
    return true;
  }
}

// -----------------------------------------------------------------------------
// CHANNELS OPERATIONS
// -----------------------------------------------------------------------------

export async function getAllActiveChannels(): Promise<Channel[]> {
  const playlists = await getPlaylists();
  const enabledPlaylistIds = new Set(playlists.filter((p) => p.enabled).map((p) => p.id));

  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM channels WHERE status = $1', ['active']);
      return res.rows.filter((c) => !c.playlist_id || enabledPlaylistIds.has(c.playlist_id));
    } catch (err) {
      console.error('[Storage] Postgres getAllActiveChannels error:', err);
    }
  }

  return channelsCache.filter((c) => {
    if (c.status === 'offline') return false;
    if (c.playlist_id && !enabledPlaylistIds.has(c.playlist_id)) return false;
    return true;
  });
}

export async function getAllChannelsAdmin(): Promise<Channel[]> {
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM channels ORDER BY name ASC');
      return res.rows;
    } catch (err) {
      console.error('[Storage] Postgres getAllChannelsAdmin error:', err);
    }
  }
  return [...channelsCache];
}

export async function getChannelById(id: string): Promise<Channel | null> {
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM channels WHERE id = $1', [id]);
      return res.rows[0] || null;
    } catch (err) {
      console.error('[Storage] Postgres getChannelById error:', err);
    }
  }
  return channelsCache.find((c) => c.id === id) || null;
}

export async function createChannel(data: Partial<Channel>): Promise<Channel> {
  const id = data.id || `chan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const channel: Channel = {
    id,
    playlist_id: data.playlist_id || 'manual',
    name: data.name?.trim() || 'Kênh mới',
    group: data.group?.trim() || 'Khác',
    logo: data.logo?.trim() || '',
    stream_url: data.stream_url?.trim() || '',
    format: data.format || 'hls',
    tvg_id: data.tvg_id,
    tvg_name: data.tvg_name,
    video_codec: data.video_codec || 'h264',
    audio_codec: data.audio_codec || 'aac',
    resolution: data.resolution || 'HD',
    status: data.status || 'active',
    description: data.description || '',
    updated_at: new Date().toISOString(),
  };

  if (pool) {
    try {
      await pool.query(
        `INSERT INTO channels (id, playlist_id, name, "group", logo, stream_url, format, tvg_id, tvg_name, video_codec, audio_codec, resolution, status, description, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          channel.id,
          channel.playlist_id || null,
          channel.name,
          channel.group,
          channel.logo,
          channel.stream_url,
          channel.format,
          channel.tvg_id || null,
          channel.tvg_name || null,
          channel.video_codec || null,
          channel.audio_codec || null,
          channel.resolution || null,
          channel.status || 'active',
          channel.description || null,
          channel.updated_at,
        ]
      );
    } catch (err) {
      console.error('[Storage] Postgres createChannel error:', err);
    }
  } else {
    channelsCache.push(channel);
    saveFileState();
  }

  return channel;
}

export async function updateChannel(id: string, data: Partial<Channel>): Promise<Channel | null> {
  const existing = await getChannelById(id);
  if (!existing) return null;

  const updated: Channel = {
    ...existing,
    ...data,
    updated_at: new Date().toISOString(),
  };

  if (pool) {
    try {
      await pool.query(
        `UPDATE channels SET name = $1, "group" = $2, logo = $3, stream_url = $4, format = $5,
         tvg_id = $6, tvg_name = $7, video_codec = $8, audio_codec = $9, resolution = $10,
         status = $11, description = $12, updated_at = $13 WHERE id = $14`,
        [
          updated.name,
          updated.group,
          updated.logo,
          updated.stream_url,
          updated.format,
          updated.tvg_id || null,
          updated.tvg_name || null,
          updated.video_codec || null,
          updated.audio_codec || null,
          updated.resolution || null,
          updated.status || 'active',
          updated.description || null,
          updated.updated_at,
          id,
        ]
      );
    } catch (err) {
      console.error('[Storage] Postgres updateChannel error:', err);
    }
  } else {
    const idx = channelsCache.findIndex((c) => c.id === id);
    if (idx !== -1) {
      channelsCache[idx] = updated;
      saveFileState();
    }
  }

  return updated;
}

export async function deleteChannel(id: string): Promise<boolean> {
  if (pool) {
    try {
      await pool.query('DELETE FROM channels WHERE id = $1', [id]);
      return true;
    } catch (err) {
      console.error('[Storage] Postgres deleteChannel error:', err);
      return false;
    }
  } else {
    channelsCache = channelsCache.filter((c) => c.id !== id);
    saveFileState();
    return true;
  }
}

// -----------------------------------------------------------------------------
// PLAYLIST SYNC / REFRESH ENGINE
// -----------------------------------------------------------------------------

export async function syncPlaylist(id: string): Promise<{ success: boolean; count: number; error?: string }> {
  const playlist = await getPlaylistById(id);
  if (!playlist) return { success: false, count: 0, error: 'Không tìm thấy playlist' };

  let rawContent = '';

  try {
    if (playlist.type === 'url') {
      if (!playlist.url) {
        throw new Error('Chưa cung cấp đường dẫn URL cho playlist');
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const res = await fetch(playlist.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*',
        },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Máy chủ IPTV từ chối (HTTP ${res.status} ${res.statusText})`);
      }

      rawContent = await res.text();
    } else {
      rawContent = playlist.content || '';
    }

    if (!rawContent || !rawContent.trim()) {
      throw new Error('Nội dung M3U rỗng');
    }

    // Parse M3U content
    const parsedChannels = parseM3U(rawContent, playlist.id);

    if (parsedChannels.length === 0) {
      throw new Error('Không phân tích được kênh nào từ định dạng M3U');
    }

    // Replace channels for this playlist
    if (pool) {
      await pool.query('DELETE FROM channels WHERE playlist_id = $1', [id]);
      for (const ch of parsedChannels) {
        await pool.query(
          `INSERT INTO channels (id, playlist_id, name, "group", logo, stream_url, format, tvg_id, tvg_name, video_codec, audio_codec, resolution, status, description, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, stream_url = EXCLUDED.stream_url`,
          [
            ch.id,
            id,
            ch.name,
            ch.group,
            ch.logo || '',
            ch.stream_url,
            ch.format,
            ch.tvg_id || null,
            ch.tvg_name || null,
            ch.video_codec || 'h264',
            ch.audio_codec || 'aac',
            ch.resolution || 'HD',
            'active',
            ch.description || null,
            ch.updated_at || new Date().toISOString(),
          ]
        );
      }
    } else {
      channelsCache = channelsCache.filter((c) => c.playlist_id !== id);
      channelsCache.push(...parsedChannels);
      saveFileState();
    }

    // Update playlist status
    await updatePlaylist(id, {
      channel_count: parsedChannels.length,
      status: 'active',
      error_message: undefined,
      last_updated: new Date().toISOString(),
    });

    return { success: true, count: parsedChannels.length };
  } catch (err: any) {
    const errorMsg = err.message || 'Lỗi không xác định khi tải playlist';
    console.warn(`[Storage] Sync failed for playlist ${playlist.name} (${id}):`, errorMsg);

    await updatePlaylist(id, {
      status: 'error',
      error_message: errorMsg,
      last_updated: new Date().toISOString(),
    });

    return { success: false, count: 0, error: errorMsg };
  }
}

export async function syncAllPlaylists(): Promise<{ totalSuccess: number; totalFailed: number }> {
  const playlists = await getPlaylists();
  let totalSuccess = 0;
  let totalFailed = 0;

  for (const pl of playlists) {
    if (pl.enabled) {
      const res = await syncPlaylist(pl.id);
      if (res.success) {
        totalSuccess++;
      } else {
        totalFailed++;
      }
    }
  }

  return { totalSuccess, totalFailed };
}

// -----------------------------------------------------------------------------
// STREAM TEST ENGINE (Lightweight, non-proxy HTTP probe)
// -----------------------------------------------------------------------------

export async function testStreamUrl(url: string): Promise<StreamTestResult> {
  const startTime = Date.now();
  const isHttps = url.startsWith('https://');

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        url,
        status: 'offline',
        is_https: isHttps,
        response_time_ms: 0,
        message: 'Giao thức URL không hợp lệ (yêu cầu http hoặc https)',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s probe timeout

    // Perform lightweight probe: HEAD first, fallback to GET range bytes 0-100
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
    } catch {
      // If HEAD is blocked by IPTV provider, test small GET range
      res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Range': 'bytes=0-100',
        },
      });
    }
    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const contentType = res.headers.get('content-type') || 'unknown';

    if (res.status >= 200 && res.status < 400) {
      return {
        url,
        status: 'online',
        http_status: res.status,
        content_type: contentType,
        is_https: isHttps,
        response_time_ms: responseTime,
        message: `Phản hồi tốt (HTTP ${res.status}, ${responseTime}ms)`,
      };
    } else {
      return {
        url,
        status: 'warning',
        http_status: res.status,
        content_type: contentType,
        is_https: isHttps,
        response_time_ms: responseTime,
        message: `Máy chủ trả về mã lỗi HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    const responseTime = Date.now() - startTime;
    return {
      url,
      status: 'offline',
      is_https: isHttps,
      response_time_ms: responseTime,
      message: err.name === 'AbortError' ? 'Hết thời gian phản hồi (>6s)' : (err.message || 'Không thể kết nối'),
    };
  }
}
