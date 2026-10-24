import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Channel, Playlist, SubtitleTrackInfo } from '../types/iptv.js';

const { Pool } = pg;

export interface CloudStorageStatus {
  enabled: boolean;
  provider: 'postgres_pool' | 'supabase_api' | 'local_fallback';
  connected: boolean;
  channelCount: number;
  onlineCount?: number;
  offlineCount?: number;
  playlistCount: number;
  pingMs?: number;
  error?: string;
  configUrlMasked?: string;
}

export interface CloudStorageConfig {
  enabled?: boolean;
  databaseUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
}

// Global clients
let pgPool: pg.Pool | null = null;
let supabaseClient: SupabaseClient | null = null;
let activeProvider: 'postgres_pool' | 'supabase_api' | 'local_fallback' = 'local_fallback';

const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'cloud-config.json');

/**
 * Load persisted custom config from data/cloud-config.json
 */
export function loadSavedCloudConfig(): CloudStorageConfig | null {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

/**
 * Save custom cloud storage config to data/cloud-config.json
 */
export function saveCloudStorageConfig(cfg: CloudStorageConfig): void {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[CloudStorage] Failed to save cloud-config.json:', err.message);
  }
}

/**
 * Helper to safely extract a hostname from any URL or connection string
 */
function extractHostname(urlStr: string): string | null {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname;
  } catch {
    const match = urlStr.match(/@([^:/]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Fast DNS pre-flight probe with timeout (prevents undici fetch throwing unhandled TypeError: fetch failed)
 */
async function canResolveHostname(hostname: string, timeoutMs: number = 3000): Promise<{ ok: boolean; error?: string }> {
  if (!hostname) return { ok: false, error: 'Empty hostname' };
  try {
    const lookupPromise = dns.promises.lookup(hostname);
    const timeoutPromise = new Promise<{ ok: boolean; error: string }>((_, reject) =>
      setTimeout(() => reject(new Error('DNS lookup timeout')), timeoutMs)
    );
    await Promise.race([lookupPromise, timeoutPromise]);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.code || err.message };
  }
}

export function getCloudStorageConfig() {
  const saved = loadSavedCloudConfig();

  const enabled = saved?.enabled !== false;
  const databaseUrl = (saved?.databaseUrl !== undefined ? saved.databaseUrl : process.env.DATABASE_URL)?.trim() || undefined;
  const supabaseUrl = (saved?.supabaseUrl !== undefined ? saved.supabaseUrl : (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL))?.trim() || undefined;
  const supabaseKey = (
    saved?.supabaseKey !== undefined
      ? saved.supabaseKey
      : (
          process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.SUPABASE_KEY ||
          process.env.VITE_SUPABASE_ANON_KEY ||
          process.env.SUPABASE_ANON_KEY
        )
  )?.trim() || undefined;

  return { enabled, databaseUrl, supabaseUrl, supabaseKey };
}

/**
 * Initialize cloud database connection (PostgreSQL direct / Supabase Pooler OR Supabase REST Client)
 * Includes pre-flight DNS verification to prevent fetch failed crashes on paused or deleted Supabase projects.
 */
export async function initCloudDatabase(): Promise<CloudStorageStatus> {
  const { enabled, databaseUrl, supabaseUrl, supabaseKey } = getCloudStorageConfig();

  // If cloud storage is explicitly disabled or no credentials provided
  if (!enabled) {
    if (pgPool) {
      pgPool.end().catch(() => {});
      pgPool = null;
    }
    supabaseClient = null;
    activeProvider = 'local_fallback';
    lastStatus = {
      enabled: false,
      provider: 'local_fallback',
      connected: false,
      channelCount: 0,
      playlistCount: 0,
      error: undefined,
    };
    return lastStatus;
  }

  let connectionError: string | undefined;

  // 1. Try PostgreSQL Connection String (Supported by Supabase Direct & Transaction/Session Pooler)
  if (databaseUrl) {
    const dbHost = extractHostname(databaseUrl);
    let dbHostResolves = true;

    if (dbHost) {
      const dnsCheck = await canResolveHostname(dbHost);
      if (!dnsCheck.ok) {
        dbHostResolves = false;
        connectionError = `Host PostgreSQL "${dbHost}" không tìm thấy (DNS ${dnsCheck.error}). Dự án có thể đã bị tạm ngưng trên Supabase.`;
        console.warn(`[CloudStorage] PostgreSQL host "${dbHost}" cannot be resolved (${dnsCheck.error}). Trying Supabase REST fallback.`);
      }
    }

    if (dbHostResolves) {
      try {
        if (!pgPool) {
          pgPool = new Pool({
            connectionString: databaseUrl,
            ssl: { rejectUnauthorized: false },
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
          });
        }

        const startTime = Date.now();
        await pgPool.query('SELECT NOW()');
        const pingMs = Date.now() - startTime;

        activeProvider = 'postgres_pool';
        console.log(`[CloudStorage] Connected to PostgreSQL/Supabase Pool in ${pingMs}ms`);

        // Ensure tables & indexes exist
        await initPostgresSchema(pgPool);

        const [pCountRes, cCountRes, onlineRes, offlineRes] = await Promise.all([
          pgPool.query('SELECT COUNT(*)::int as count FROM playlists'),
          pgPool.query('SELECT COUNT(*)::int as count FROM channels'),
          pgPool.query("SELECT COUNT(*)::int as count FROM channels WHERE status != 'offline'"),
          pgPool.query("SELECT COUNT(*)::int as count FROM channels WHERE status = 'offline'"),
        ]);

        const playlistCount = pCountRes.rows[0]?.count || 0;
        const channelCount = cCountRes.rows[0]?.count || 0;
        const onlineCount = onlineRes.rows[0]?.count || 0;
        const offlineCount = offlineRes.rows[0]?.count || 0;

        // Mask URL for display
        const masked = databaseUrl.replace(/:([^:@]+)@/, ':***@');

        lastStatus = {
          enabled: true,
          provider: 'postgres_pool',
          connected: true,
          channelCount,
          onlineCount,
          offlineCount,
          playlistCount,
          pingMs,
          configUrlMasked: masked,
        };
        return lastStatus;
      } catch (err: any) {
        connectionError = err.message || 'Lỗi kết nối PostgreSQL';
        console.warn('[CloudStorage] PostgreSQL connection attempt failed, trying Supabase REST fallback:', err.message);
        if (pgPool) {
          pgPool.end().catch(() => {});
          pgPool = null;
        }
      }
    }
  }

  // 2. Try Supabase REST Client (HTTPS port 443)
  if (supabaseUrl && supabaseKey) {
    const sbHost = extractHostname(supabaseUrl);
    let sbHostResolves = true;

    if (sbHost) {
      const dnsCheck = await canResolveHostname(sbHost);
      if (!dnsCheck.ok) {
        sbHostResolves = false;
        connectionError = `Host Supabase "${sbHost}" không phân giải được (DNS ${dnsCheck.error}). Dự án Supabase có thể đang ở trạng thái Tạm ngưng (Paused) hoặc bị xóa. Ứng dụng tự động chuyển sang chế độ Local Storage.`;
        console.warn(`[CloudStorage] Supabase REST host "${sbHost}" cannot be resolved (${dnsCheck.error}). Falling back cleanly to Local Storage.`);
      }
    }

    if (sbHostResolves) {
      try {
        if (!supabaseClient) {
          supabaseClient = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          });
        }

        const startTime = Date.now();
        const [pRes, cRes, onlineRes, offlineRes] = await Promise.all([
          supabaseClient.from('playlists').select('*', { count: 'exact', head: true }),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }).neq('status', 'offline'),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }).eq('status', 'offline'),
        ]);

        if (pRes.error && pRes.error.code !== 'PGRST116') {
          throw new Error(pRes.error.message);
        }
        if (cRes.error && cRes.error.code !== 'PGRST116') {
          throw new Error(cRes.error.message);
        }

        const pingMs = Date.now() - startTime;
        activeProvider = 'supabase_api';
        console.log(`[CloudStorage] Connected to Supabase REST API in ${pingMs}ms`);

        const status: CloudStorageStatus = {
          enabled: true,
          provider: 'supabase_api',
          connected: true,
          channelCount: cRes.count || 0,
          onlineCount: onlineRes.count ?? (cRes.count || 0),
          offlineCount: offlineRes.count ?? 0,
          playlistCount: pRes.count || 0,
          pingMs,
          configUrlMasked: supabaseUrl,
        };
        lastStatus = status;
        return status;
      } catch (err: any) {
        const rawMsg = err?.cause?.message || err?.message || String(err);
        connectionError = `Lỗi kết nối Supabase REST: ${rawMsg}`;
        console.warn('[CloudStorage] Supabase REST connection failed, falling back to Local Storage:', rawMsg);
        supabaseClient = null;
      }
    }
  }

  activeProvider = 'local_fallback';
  lastStatus = {
    enabled: false,
    provider: 'local_fallback',
    connected: false,
    channelCount: 0,
    playlistCount: 0,
    error: connectionError,
    configUrlMasked: supabaseUrl || (databaseUrl ? databaseUrl.replace(/:([^:@]+)@/, ':***@') : undefined),
  };
  return lastStatus;
}

let lastStatus: CloudStorageStatus = {
  enabled: false,
  provider: 'local_fallback',
  connected: false,
  channelCount: 0,
  playlistCount: 0,
};

export async function getCloudStorageStatus(): Promise<CloudStorageStatus> {
  if (lastStatus.connected) {
    if (pgPool) {
      try {
        const [pCountRes, cCountRes, onlineRes, offlineRes] = await Promise.all([
          pgPool.query('SELECT COUNT(*)::int as count FROM playlists'),
          pgPool.query('SELECT COUNT(*)::int as count FROM channels'),
          pgPool.query("SELECT COUNT(*)::int as count FROM channels WHERE status != 'offline'"),
          pgPool.query("SELECT COUNT(*)::int as count FROM channels WHERE status = 'offline'"),
        ]);
        lastStatus.playlistCount = pCountRes.rows[0]?.count || 0;
        lastStatus.channelCount = cCountRes.rows[0]?.count || 0;
        lastStatus.onlineCount = onlineRes.rows[0]?.count || 0;
        lastStatus.offlineCount = offlineRes.rows[0]?.count || 0;
      } catch {}
    } else if (supabaseClient) {
      try {
        const [pRes, cRes, onlineRes, offlineRes] = await Promise.all([
          supabaseClient.from('playlists').select('*', { count: 'exact', head: true }),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }).neq('status', 'offline'),
          supabaseClient.from('channels').select('*', { count: 'exact', head: true }).eq('status', 'offline'),
        ]);
        if (pRes.count !== null && pRes.count !== undefined) lastStatus.playlistCount = pRes.count;
        if (cRes.count !== null && cRes.count !== undefined) lastStatus.channelCount = cRes.count;
        if (onlineRes.count !== null && onlineRes.count !== undefined) lastStatus.onlineCount = onlineRes.count;
        if (offlineRes.count !== null && offlineRes.count !== undefined) lastStatus.offlineCount = offlineRes.count;
      } catch {}
    }
  }
  return { ...lastStatus };
}

/**
 * Get currently active provider
 */
export function getActiveProvider() {
  return activeProvider;
}

export function getPgPool() {
  return pgPool;
}

export function getSupabaseClient() {
  return supabaseClient;
}

/**
 * Creates schema, tables, and high-performance indexes in PostgreSQL / Supabase
 */
async function initPostgresSchema(pool: pg.Pool) {
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
      has_subtitles BOOLEAN DEFAULT false,
      subtitle_tracks JSONB DEFAULT '[]'::jsonb,
      updated_at TEXT NOT NULL
    );

    -- Migrations for existing deployments
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS has_subtitles BOOLEAN DEFAULT false;
    ALTER TABLE channels ADD COLUMN IF NOT EXISTS subtitle_tracks JSONB DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
    CREATE INDEX IF NOT EXISTS idx_channels_group ON channels("group");
    CREATE INDEX IF NOT EXISTS idx_channels_playlist ON channels(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_channels_updated_at ON channels(updated_at);
    CREATE INDEX IF NOT EXISTS idx_channels_has_subtitles ON channels(has_subtitles);
  `);
}

/**
 * Fetch all playlists from Cloud
 */
export async function fetchCloudPlaylists(): Promise<Playlist[] | null> {
  if (pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM playlists ORDER BY channel_count DESC, name ASC');
      return res.rows;
    } catch (err) {
      console.error('[CloudStorage] Error fetching playlists from Postgres:', err);
    }
  }

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from('playlists')
        .select('*')
        .order('channel_count', { ascending: false });
      if (!error && data) return data as Playlist[];
    } catch (err) {
      console.error('[CloudStorage] Error fetching playlists from Supabase API:', err);
    }
  }

  return null;
}

/**
 * Fetch all channels from Cloud
 */
export async function fetchCloudChannels(): Promise<Channel[] | null> {
  if (pgPool) {
    try {
      const res = await pgPool.query('SELECT * FROM channels');
      return res.rows;
    } catch (err) {
      console.error('[CloudStorage] Error fetching channels from Postgres:', err);
    }
  }

  if (supabaseClient) {
    try {
      // Supabase has 1000 rows default limit per page, paginate to fetch all
      const all: Channel[] = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabaseClient
          .from('channels')
          .select('*')
          .range(from, from + step - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as Channel[]));
        if (data.length < step) break;
        from += step;
      }
      return all;
    } catch (err) {
      console.error('[CloudStorage] Error fetching channels from Supabase API:', err);
    }
  }

  return null;
}

/**
 * High-performance bulk upload of channels into Supabase/PostgreSQL
 * Uses batched multi-row UPSERT (500 items per batch) to achieve 11,000+ records in <3 seconds
 */
export async function bulkUpsertCloudChannels(
  channels: Channel[],
  onProgress?: (done: number, total: number) => void
): Promise<{ success: boolean; totalUploaded: number; error?: string }> {
  if (!channels || channels.length === 0) {
    return { success: true, totalUploaded: 0 };
  }

  const batchSize = 500;
  let done = 0;

  // 1. Direct PostgreSQL / Supabase Pooler batch upsert
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize);
        const values: any[] = [];
        const placeholders: string[] = [];

        batch.forEach((ch, idx) => {
          const base = idx * 17;
          placeholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, $${base + 16}, $${base + 17})`
          );
          values.push(
            ch.id,
            ch.playlist_id || 'manual',
            ch.name || 'Kênh mới',
            ch.group || 'Khác',
            ch.logo || '',
            ch.stream_url || '',
            ch.format || 'hls',
            ch.tvg_id || null,
            ch.tvg_name || null,
            ch.video_codec || 'h264',
            ch.audio_codec || 'aac',
            ch.resolution || 'HD',
            ch.status || 'active',
            ch.description || null,
            ch.has_subtitles ?? false,
            JSON.stringify(ch.subtitle_tracks || []),
            ch.updated_at || new Date().toISOString()
          );
        });

        const sql = `
          INSERT INTO channels (
            id, playlist_id, name, "group", logo, stream_url, format,
            tvg_id, tvg_name, video_codec, audio_codec, resolution, status, description,
            has_subtitles, subtitle_tracks, updated_at
          ) VALUES ${placeholders.join(', ')}
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            "group" = EXCLUDED."group",
            logo = EXCLUDED.logo,
            stream_url = EXCLUDED.stream_url,
            format = EXCLUDED.format,
            tvg_id = EXCLUDED.tvg_id,
            tvg_name = EXCLUDED.tvg_name,
            video_codec = EXCLUDED.video_codec,
            audio_codec = EXCLUDED.audio_codec,
            resolution = EXCLUDED.resolution,
            status = EXCLUDED.status,
            description = EXCLUDED.description,
            has_subtitles = EXCLUDED.has_subtitles,
            subtitle_tracks = EXCLUDED.subtitle_tracks,
            updated_at = EXCLUDED.updated_at
        `;

        await client.query(sql, values);
        done += batch.length;
        if (onProgress) onProgress(done, channels.length);
      }

      await client.query('COMMIT');
      return { success: true, totalUploaded: done };
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('[CloudStorage] Postgres bulk upsert error:', err);
      return { success: false, totalUploaded: done, error: err.message };
    } finally {
      client.release();
    }
  }

  // 2. Supabase REST API batch upsert
  if (supabaseClient) {
    try {
      for (let i = 0; i < channels.length; i += batchSize) {
        const batch = channels.slice(i, i + batchSize).map((ch) => ({
          id: ch.id,
          playlist_id: ch.playlist_id || 'manual',
          name: ch.name || 'Kênh mới',
          group: ch.group || 'Khác',
          logo: ch.logo || '',
          stream_url: ch.stream_url || '',
          format: ch.format || 'hls',
          tvg_id: ch.tvg_id || null,
          tvg_name: ch.tvg_name || null,
          video_codec: ch.video_codec || 'h264',
          audio_codec: ch.audio_codec || 'aac',
          resolution: ch.resolution || 'HD',
          status: ch.status || 'active',
          description: ch.description || null,
          has_subtitles: ch.has_subtitles ?? false,
          subtitle_tracks: ch.subtitle_tracks || [],
          updated_at: ch.updated_at || new Date().toISOString(),
        }));

        const { error } = await supabaseClient.from('channels').upsert(batch, { onConflict: 'id' });
        if (error) throw error;

        done += batch.length;
        if (onProgress) onProgress(done, channels.length);
      }
      return { success: true, totalUploaded: done };
    } catch (err: any) {
      console.error('[CloudStorage] Supabase API bulk upsert error:', err);
      return { success: false, totalUploaded: done, error: err.message };
    }
  }

  return { success: false, totalUploaded: 0, error: 'Chưa cấu hình Supabase hoặc PostgreSQL' };
}

/**
 * Bulk upsert playlists
 */
export async function bulkUpsertCloudPlaylists(playlists: Playlist[]): Promise<boolean> {
  if (pgPool) {
    try {
      for (const pl of playlists) {
        await pgPool.query(
          `INSERT INTO playlists (id, name, type, url, content, enabled, channel_count, last_updated, status, error_message)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             type = EXCLUDED.type,
             url = EXCLUDED.url,
             content = EXCLUDED.content,
             enabled = EXCLUDED.enabled,
             channel_count = EXCLUDED.channel_count,
             last_updated = EXCLUDED.last_updated,
             status = EXCLUDED.status,
             error_message = EXCLUDED.error_message`,
          [
            pl.id,
            pl.name,
            pl.type,
            pl.url || null,
            pl.content || null,
            pl.enabled,
            pl.channel_count,
            pl.last_updated,
            pl.status,
            pl.error_message || null,
          ]
        );
      }
      return true;
    } catch (err) {
      console.error('[CloudStorage] Error saving playlists to Postgres:', err);
    }
  }

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from('playlists').upsert(playlists, { onConflict: 'id' });
      if (!error) return true;
    } catch (err) {
      console.error('[CloudStorage] Error saving playlists to Supabase API:', err);
    }
  }

  return false;
}

/**
 * Fast batched status flush for scanner
 * Buffers channel updates and applies them in a single multi-row UPDATE query
 */
export async function bulkUpdateCloudChannelStatuses(
  updates: Array<{
    id: string;
    status: 'active' | 'offline';
    description?: string;
    has_subtitles?: boolean;
    subtitle_tracks?: SubtitleTrackInfo[];
    updated_at: string;
  }>
): Promise<boolean> {
  if (updates.length === 0) return true;

  if (pgPool) {
    try {
      // Build a multi-row VALUES list: (id, status, description, has_subtitles, subtitle_tracks, updated_at)
      const values: any[] = [];
      const rows: string[] = [];
      updates.forEach((u, i) => {
        const b = i * 6;
        rows.push(`($${b + 1}::text, $${b + 2}::text, $${b + 3}::text, $${b + 4}::boolean, $${b + 5}::jsonb, $${b + 6}::text)`);
        values.push(
          u.id,
          u.status,
          u.description || null,
          u.has_subtitles !== undefined ? u.has_subtitles : null,
          u.subtitle_tracks ? JSON.stringify(u.subtitle_tracks) : null,
          u.updated_at
        );
      });

      const sql = `
        UPDATE channels AS c
        SET
          status = v.status,
          description = v.description,
          has_subtitles = COALESCE(v.has_subtitles, c.has_subtitles, false),
          subtitle_tracks = COALESCE(v.subtitle_tracks, c.subtitle_tracks, '[]'::jsonb),
          updated_at = v.updated_at
        FROM (VALUES ${rows.join(', ')}) AS v(id, status, description, has_subtitles, subtitle_tracks, updated_at)
        WHERE c.id = v.id
      `;

      await pgPool.query(sql, values);
      return true;
    } catch (err) {
      console.error('[CloudStorage] Error bulk updating statuses in Postgres:', err);
    }
  }

  if (supabaseClient) {
    try {
      const payload = updates.map((u) => {
        const item: any = {
          id: u.id,
          status: u.status,
          description: u.description || null,
          updated_at: u.updated_at,
        };
        if (u.has_subtitles !== undefined) {
          item.has_subtitles = u.has_subtitles;
        }
        if (u.subtitle_tracks !== undefined) {
          item.subtitle_tracks = u.subtitle_tracks;
        }
        return item;
      });
      const { error } = await supabaseClient.from('channels').upsert(payload, { onConflict: 'id' });
      if (!error) return true;
    } catch (err) {
      console.error('[CloudStorage] Error bulk updating statuses in Supabase API:', err);
    }
  }

  return false;
}

/**
 * Returns SQL DDL script for Supabase SQL Editor
 */
export function getRecommendedSqlSchema(): string {
  return `-- ====================================================================
-- IPTV SUPABASE SCHEMA - BẢO LƯU 11.186 KÊNH & TRẠNG THÁI RÀ SOÁT
-- Chạy đoạn script này tại Supabase Dashboard -> SQL Editor -> Run
-- ====================================================================

-- 1. Bảng lưu trữ Playlist M3U
CREATE TABLE IF NOT EXISTS public.playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'url',
    url TEXT,
    content TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    channel_count INT NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng lưu trữ Kênh & Trạng thái hoạt động (Online / Offline)
CREATE TABLE IF NOT EXISTS public.channels (
    id TEXT PRIMARY KEY,
    playlist_id TEXT,
    name TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'Khác',
    logo TEXT,
    stream_url TEXT NOT NULL,
    format TEXT NOT NULL DEFAULT 'hls',
    tvg_id TEXT,
    tvg_name TEXT,
    video_codec TEXT DEFAULT 'h264',
    audio_codec TEXT DEFAULT 'aac',
    resolution TEXT DEFAULT 'HD',
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT,
    has_subtitles BOOLEAN DEFAULT false,
    subtitle_tracks JSONB DEFAULT '[]'::jsonb,
    updated_at TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migration nếu bảng đã tồn tại sẵn
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS has_subtitles BOOLEAN DEFAULT false;
ALTER TABLE public.channels ADD COLUMN IF NOT EXISTS subtitle_tracks JSONB DEFAULT '[]'::jsonb;

-- 3. Tạo chỉ mục tối ưu tốc độ tìm kiếm & lọc trạng thái
CREATE INDEX IF NOT EXISTS idx_channels_status ON public.channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_group ON public.channels("group");
CREATE INDEX IF NOT EXISTS idx_channels_playlist ON public.channels(playlist_id);
CREATE INDEX IF NOT EXISTS idx_channels_has_subtitles ON public.channels(has_subtitles);
CREATE INDEX IF NOT EXISTS idx_channels_name_trgm ON public.channels(name);

-- 4. Bật quyền truy cập công khai (nếu sử dụng Supabase Anon Key)
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cho phép đọc công khai danh sách playlist" ON public.playlists FOR SELECT USING (true);
CREATE POLICY "Cho phép toàn quyền quản trị playlist" ON public.playlists FOR ALL USING (true);

CREATE POLICY "Cho phép đọc công khai danh sách kênh" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Cho phép toàn quyền quản trị kênh" ON public.channels FOR ALL USING (true);
`;
}
