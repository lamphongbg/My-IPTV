import fs from 'fs';
import path from 'path';
import type { Channel, Playlist, StreamTestResult, SubtitleTrackInfo } from '../types/iptv.js';
import { parseM3U } from '../../utils/m3uParser.js';
import {
  initCloudDatabase,
  fetchCloudPlaylists,
  fetchCloudChannels,
  bulkUpsertCloudChannels,
  bulkUpsertCloudPlaylists,
  bulkUpdateCloudChannelStatuses,
  getCloudStorageStatus,
  getRecommendedSqlSchema,
  type CloudStorageStatus,
} from './supabaseClient.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PLAYLISTS_FILE = path.join(DATA_DIR, 'playlists.json');
const CHANNELS_FILE = path.join(DATA_DIR, 'channels.json');
const CHANNELS_BAK_FILE = path.join(DATA_DIR, 'channels.json.bak');
const CHANNELS_M3U_FILE = path.join(DATA_DIR, 'channels.m3u');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// In-memory cache for ultra-low latency (<2ms reads for 11,000+ channels)
let playlistsCache: Playlist[] = [];
let channelsCache: Channel[] = [];

// Atomic write helper to prevent corrupted/truncated JSON files on crash or restart
function atomicWriteJsonSync(filePath: string, data: any) {
  const tmpPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// Seed default playlist and channels if empty
function seedDefaultData() {
  let initialChannels: Channel[] = [];

  // Try channels.json
  if (fs.existsSync(CHANNELS_FILE)) {
    try {
      initialChannels = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
    } catch (e) {
      console.warn('[Storage] Error parsing initial channels.json:', e);
    }
  }

  // Fallback to channels.json.bak
  if (initialChannels.length === 0 && fs.existsSync(CHANNELS_BAK_FILE)) {
    try {
      initialChannels = JSON.parse(fs.readFileSync(CHANNELS_BAK_FILE, 'utf-8'));
      console.log(`[Storage] Restored ${initialChannels.length} channels from channels.json.bak`);
    } catch (e) {
      console.warn('[Storage] Error parsing channels.json.bak:', e);
    }
  }

  // Fallback to channels.m3u
  if (initialChannels.length === 0 && fs.existsSync(CHANNELS_M3U_FILE)) {
    try {
      const m3uContent = fs.readFileSync(CHANNELS_M3U_FILE, 'utf-8');
      initialChannels = parseM3U(m3uContent, 'default-playlist');
      console.log(`[Storage] Fallback parsed ${initialChannels.length} channels from channels.m3u`);
    } catch (e) {
      console.warn('[Storage] Error parsing channels.m3u fallback:', e);
    }
  }

  if (playlistsCache.length === 0) {
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
  }

  if (channelsCache.length === 0 && initialChannels.length > 0) {
    channelsCache = initialChannels.map((c) => ({
      ...c,
      playlist_id: c.playlist_id || 'default-playlist',
      has_subtitles: c.has_subtitles ?? Boolean(c.subtitle_tracks && c.subtitle_tracks.length > 0),
      subtitle_tracks: Array.isArray(c.subtitle_tracks) ? c.subtitle_tracks : [],
      updated_at: c.updated_at || new Date().toISOString(),
    }));
  }

  saveFileState(true);
}

function loadFileState() {
  try {
    if (fs.existsSync(PLAYLISTS_FILE)) {
      playlistsCache = JSON.parse(fs.readFileSync(PLAYLISTS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Storage] Error reading playlists.json:', err);
    playlistsCache = [];
  }

  try {
    if (fs.existsSync(CHANNELS_FILE)) {
      channelsCache = JSON.parse(fs.readFileSync(CHANNELS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[Storage] Error reading channels.json, attempting fallback to channels.json.bak:', err);
    channelsCache = [];
  }

  // Fallback to backup file if channelsCache is empty
  if (channelsCache.length === 0 && fs.existsSync(CHANNELS_BAK_FILE)) {
    try {
      channelsCache = JSON.parse(fs.readFileSync(CHANNELS_BAK_FILE, 'utf-8'));
      console.log(`[Storage] Successfully recovered ${channelsCache.length} channels from channels.json.bak`);
      atomicWriteJsonSync(CHANNELS_FILE, channelsCache);
    } catch (bakErr) {
      console.error('[Storage] Error reading channels.json.bak:', bakErr);
    }
  }

  // Fallback to channels.m3u if still empty
  if (channelsCache.length === 0 && fs.existsSync(CHANNELS_M3U_FILE)) {
    try {
      const m3uContent = fs.readFileSync(CHANNELS_M3U_FILE, 'utf-8');
      channelsCache = parseM3U(m3uContent, 'default-playlist');
      console.log(`[Storage] Restored ${channelsCache.length} channels from channels.m3u`);
      atomicWriteJsonSync(CHANNELS_FILE, channelsCache);
    } catch (m3uErr) {
      console.error('[Storage] Error reading channels.m3u:', m3uErr);
    }
  }

  // Normalize all channels to ensure subtitle fields are defined
  if (channelsCache.length > 0) {
    channelsCache = channelsCache.map((c) => ({
      ...c,
      has_subtitles: c.has_subtitles ?? Boolean(c.subtitle_tracks && c.subtitle_tracks.length > 0),
      subtitle_tracks: Array.isArray(c.subtitle_tracks) ? c.subtitle_tracks : [],
    }));
  }

  // If playlistsCache is empty, or channelsCache was empty, run seedDefaultData
  if (playlistsCache.length === 0 || channelsCache.length === 0) {
    seedDefaultData();
  } else {
    try {
      if (channelsCache.length > 0 && (!fs.existsSync(CHANNELS_BAK_FILE) || Math.random() < 0.2)) {
        atomicWriteJsonSync(CHANNELS_BAK_FILE, channelsCache);
      }
    } catch {}
  }

  console.log(`[Storage] Local state loaded: ${playlistsCache.length} playlists, ${channelsCache.length} channels.`);
}

let saveDebounceTimer: NodeJS.Timeout | null = null;

export function saveFileState(immediate = false) {
  if (immediate) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    try {
      atomicWriteJsonSync(PLAYLISTS_FILE, playlistsCache);
      atomicWriteJsonSync(CHANNELS_FILE, channelsCache);
      atomicWriteJsonSync(CHANNELS_BAK_FILE, channelsCache);
    } catch (err) {
      console.error('[Storage] Error writing local data files atomically:', err);
    }
    return;
  }

  if (!saveDebounceTimer) {
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      try {
        atomicWriteJsonSync(PLAYLISTS_FILE, playlistsCache);
        atomicWriteJsonSync(CHANNELS_FILE, channelsCache);
      } catch (err) {
        console.error('[Storage] Error writing local data files atomically:', err);
      }
    }, 2000);
  }
}

// -----------------------------------------------------------------------------
// STATUS UPDATE BUFFERING (For high-speed batch channel scanning)
// -----------------------------------------------------------------------------

export interface CloudStatusUpdateItem {
  id: string;
  status: 'active' | 'offline';
  description?: string;
  has_subtitles?: boolean;
  subtitle_tracks?: SubtitleTrackInfo[];
  updated_at: string;
}

let pendingCloudUpdates: Array<CloudStatusUpdateItem> = [];
let cloudFlushTimer: NodeJS.Timeout | null = null;

export function queueCloudStatusUpdate(update: CloudStatusUpdateItem) {
  pendingCloudUpdates.push(update);
  if (pendingCloudUpdates.length >= 60) {
    flushCloudStatusUpdates();
  } else if (!cloudFlushTimer) {
    cloudFlushTimer = setTimeout(() => {
      flushCloudStatusUpdates();
    }, 1500);
  }
}

export async function flushCloudStatusUpdates(): Promise<void> {
  if (cloudFlushTimer) {
    clearTimeout(cloudFlushTimer);
    cloudFlushTimer = null;
  }
  if (pendingCloudUpdates.length === 0) return;

  const batch = [...pendingCloudUpdates];
  pendingCloudUpdates = [];

  try {
    await bulkUpdateCloudChannelStatuses(batch);
  } catch (err) {
    console.error('[Storage] Error flushing status updates to Cloud:', err);
  }
}

// -----------------------------------------------------------------------------
// INITIAL BOOTSTRAP: HYBRID LOCAL + CLOUD STORAGE
// -----------------------------------------------------------------------------

export async function initStorage(): Promise<void> {
  // Step 1: Always load local files into cache first (fast start, has initial data)
  loadFileState();

  // Step 2: Initialize Supabase / PostgreSQL cloud connection if configured
  try {
    const cloudStatus = await initCloudDatabase();
    if (cloudStatus.connected) {
      console.log(`[Storage] Cloud Storage connected (${cloudStatus.provider})! Channels in Cloud: ${cloudStatus.channelCount}`);

      if (cloudStatus.channelCount > 0) {
        // Cloud already has channels! Load them into RAM cache so that any Render deploy
        // immediately boots with the already scanned channels and statuses intact!
        const cloudChannels = await fetchCloudChannels();
        const cloudPlaylists = await fetchCloudPlaylists();

        if (cloudChannels && cloudChannels.length > 0) {
          channelsCache = cloudChannels;
          const onlineCount = cloudChannels.filter((c) => c.status !== 'offline').length;
          const offlineCount = cloudChannels.length - onlineCount;
          console.log(`[Storage] Synced ${cloudChannels.length} channels from Supabase (${onlineCount} Online, ${offlineCount} Offline). No rescan required!`);
        }

        if (cloudPlaylists && cloudPlaylists.length > 0) {
          playlistsCache = cloudPlaylists;
        }

        // Save local backup copies
        saveFileState(true);
      } else if (channelsCache.length > 0) {
        // Cloud database is connected but fresh/empty!
        // Automatically seed the local channels (with existing scan status) to Supabase
        console.log(`[Storage] Cloud database is empty. Auto-seeding ${channelsCache.length} channels with scan statuses to Cloud...`);
        bulkUpsertCloudPlaylists(playlistsCache).catch(console.error);
        bulkUpsertCloudChannels(channelsCache).then((res) => {
          if (res.success) {
            console.log(`[Storage] Successfully seeded ${res.totalUploaded} channels and scan statuses to Cloud!`);
          }
        }).catch(console.error);
      }
    } else {
      console.log('[Storage] Running in Local Storage Mode (data/channels.json). Add DATABASE_URL or SUPABASE_URL to persist to Cloud on Render.');
    }
  } catch (err) {
    console.error('[Storage] Error during cloud storage bootstrap:', err);
  }
}

// Run bootstrap immediately
initStorage().catch(console.error);

// -----------------------------------------------------------------------------
// PLAYLIST OPERATIONS
// -----------------------------------------------------------------------------

export async function getPlaylists(): Promise<Playlist[]> {
  return [...playlistsCache];
}

export async function getPlaylistById(id: string): Promise<Playlist | null> {
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

  playlistsCache.unshift(newPl);
  saveFileState();
  bulkUpsertCloudPlaylists([newPl]).catch(console.error);

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

  const idx = playlistsCache.findIndex((p) => p.id === id);
  if (idx !== -1) {
    playlistsCache[idx] = updated;
    saveFileState();
  }

  bulkUpsertCloudPlaylists([updated]).catch(console.error);
  return updated;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  playlistsCache = playlistsCache.filter((p) => p.id !== id);
  channelsCache = channelsCache.filter((c) => c.playlist_id !== id);
  saveFileState();

  // Also clean up from cloud if connected
  const { getPgPool, getSupabaseClient } = await import('./supabaseClient.js');
  const pool = getPgPool();
  if (pool) {
    pool.query('DELETE FROM channels WHERE playlist_id = $1', [id]).catch(console.error);
    pool.query('DELETE FROM playlists WHERE id = $1', [id]).catch(console.error);
  }
  const client = getSupabaseClient();
  if (client) {
    (async () => {
      try {
        await client.from('channels').delete().eq('playlist_id', id);
        await client.from('playlists').delete().eq('id', id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

  return true;
}

// -----------------------------------------------------------------------------
// CHANNELS OPERATIONS
// -----------------------------------------------------------------------------

export async function getAllActiveChannels(): Promise<Channel[]> {
  const playlists = await getPlaylists();
  const enabledPlaylistIds = new Set(playlists.filter((p) => p.enabled).map((p) => p.id));

  return channelsCache.filter((c) => {
    if (c.status === 'offline') return false;
    if (c.playlist_id && enabledPlaylistIds.size > 0 && !enabledPlaylistIds.has(c.playlist_id)) return false;
    return true;
  });
}

export async function getAllChannelsAdmin(): Promise<Channel[]> {
  return [...channelsCache];
}

export async function getChannelById(id: string): Promise<Channel | null> {
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
    has_subtitles: data.has_subtitles ?? false,
    subtitle_tracks: data.subtitle_tracks || [],
    updated_at: new Date().toISOString(),
  };

  channelsCache.push(channel);
  saveFileState();
  bulkUpsertCloudChannels([channel]).catch(console.error);

  return channel;
}

export async function updateChannel(id: string, data: Partial<Channel>): Promise<Channel | null> {
  const existing = await getChannelById(id);
  if (!existing) return null;

  const updated: Channel = {
    ...existing,
    ...data,
    has_subtitles: data.has_subtitles !== undefined ? data.has_subtitles : (existing.has_subtitles ?? false),
    subtitle_tracks: data.subtitle_tracks !== undefined ? data.subtitle_tracks : (existing.subtitle_tracks || []),
    updated_at: data.updated_at || new Date().toISOString(),
  };

  const idx = channelsCache.findIndex((c) => c.id === id);
  if (idx !== -1) {
    channelsCache[idx] = updated;
    saveFileState();
  }

  // Queue status updates for fast batch flushing, or sync metadata immediately
  if (data.status) {
    queueCloudStatusUpdate({
      id,
      status: (updated.status === 'offline' ? 'offline' : 'active') as 'active' | 'offline',
      description: updated.description || undefined,
      has_subtitles: updated.has_subtitles,
      subtitle_tracks: updated.subtitle_tracks,
      updated_at: updated.updated_at || new Date().toISOString(),
    });
  } else {
    bulkUpsertCloudChannels([updated]).catch(console.error);
  }

  return updated;
}

export async function getChannelsWithSubtitles(): Promise<Channel[]> {
  const active = await getAllActiveChannels();
  return active.filter((c) => c.has_subtitles || (c.subtitle_tracks && c.subtitle_tracks.length > 0));
}

export async function deleteChannel(id: string): Promise<boolean> {
  channelsCache = channelsCache.filter((c) => c.id !== id);
  saveFileState();

  const { getPgPool, getSupabaseClient } = await import('./supabaseClient.js');
  const pool = getPgPool();
  if (pool) {
    pool.query('DELETE FROM channels WHERE id = $1', [id]).catch(console.error);
  }
  const client = getSupabaseClient();
  if (client) {
    (async () => {
      try {
        await client.from('channels').delete().eq('id', id);
      } catch (e) {
        console.error(e);
      }
    })();
  }

  return true;
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

    // Replace channels for this playlist in memory and file
    channelsCache = channelsCache.filter((c) => c.playlist_id !== id);
    channelsCache.push(...parsedChannels);
    saveFileState();

    // Sync to Cloud in batches
    bulkUpsertCloudChannels(parsedChannels).catch(console.error);

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
// CLOUD SYNC & STATUS FUNCTIONS (For Admin Portal & Render Deployment)
// -----------------------------------------------------------------------------

export async function getCloudStatus(): Promise<CloudStorageStatus & { localChannelsCount: number; localPlaylistsCount: number }> {
  const status = await getCloudStorageStatus();
  return {
    ...status,
    localChannelsCount: channelsCache.length,
    localPlaylistsCount: playlistsCache.length,
  };
}

export async function pushAllToCloud(onProgress?: (done: number, total: number) => void) {
  await bulkUpsertCloudPlaylists(playlistsCache);
  const result = await bulkUpsertCloudChannels(channelsCache, onProgress);
  return result;
}

export async function pullAllFromCloud() {
  const channels = await fetchCloudChannels();
  const playlists = await fetchCloudPlaylists();

  if (channels && channels.length > 0) {
    channelsCache = channels;
    if (playlists && playlists.length > 0) {
      playlistsCache = playlists;
    }
    saveFileState(true);
    return {
      success: true,
      channelCount: channels.length,
      playlistCount: playlists?.length || 0,
    };
  }

  return {
    success: false,
    channelCount: 0,
    playlistCount: 0,
    error: 'Không tìm thấy kênh nào trên Supabase hoặc cơ sở dữ liệu rỗng.',
  };
}

export { getRecommendedSqlSchema };

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
