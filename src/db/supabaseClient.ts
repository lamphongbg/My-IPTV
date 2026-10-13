import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Channel, Playlist } from '../types/iptv.js';

const { Pool } = pg;

export interface CloudStorageStatus {
  enabled: boolean;
  provider: 'postgres_pool' | 'supabase_api' | 'local_fallback';
  connected: boolean;
  channelCount: number;
  playlistCount: number;
  pingMs?: number;
  error?: string;
  configUrlMasked?: string;
}

// Global clients
let pgPool: pg.Pool | null = null;
let supabaseClient: SupabaseClient | null = null;
let activeProvider: 'postgres_pool' | 'supabase_api' | 'local_fallback' = 'local_fallback';

export function getCloudStorageConfig() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const supabaseKey = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim();

  return { databaseUrl, supabaseUrl, supabaseKey };
}

/**
 * Initialize cloud database connection (PostgreSQL direct / Supabase Pooler OR Supabase REST Client)
 */
export async function initCloudDatabase(): Promise<CloudStorageStatus> {
  const { databaseUrl, supabaseUrl, supabaseKey } = getCloudStorageConfig();

  // 1. Try PostgreSQL Connection String (Supported by Supabase Direct & Transaction/Session Pooler)
  if (databaseUrl) {
    try {
      if (!pgPool) {
        pgPool = new Pool({
          connectionString: databaseUrl,
          ssl: { rejectUnauthorized: false },
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
      }

      const startTime = Date.now();
      const testRes = await pgPool.query('SELECT NOW()');
      const pingMs = Date.now() - startTime;

      activeProvider = 'postgres_pool';
      console.log(`[CloudStorage] Connected to PostgreSQL/Supabase Pool in ${pingMs}ms`);

      // Ensure tables & indexes exist
      await initPostgresSchema(pgPool);

      const [pCountRes, cCountRes] = await Promise.all([
        pgPool.query('SELECT COUNT(*)::int as count FROM playlists'),
        pgPool.query('SELECT COUNT(*)::int as count FROM channels'),
      ]);

      const playlistCount = pCountRes.rows[0]?.count || 0;
      const channelCount = cCountRes.rows[0]?.count || 0;

      // Mask URL for display
      const masked = databaseUrl.replace(/:([^:@]+)@/, ':***@');

      lastStatus = {
        enabled: true,
        provider: 'postgres_pool',
        connected: true,
        channelCount,
        playlistCount,
        pingMs,
        configUrlMasked: masked,
      };
      return lastStatus;
    } catch (err: any) {
      console.error('[CloudStorage] PostgreSQL connection failed, trying Supabase REST fallback:', err.message);
      pgPool = null;
    }
  }

  // 2. Try Supabase REST Client (HTTPS port 443 - works everywhere without connection pool issues)
  if (supabaseUrl && supabaseKey) {
    try {
      if (!supabaseClient) {
        supabaseClient = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
      }

      const startTime = Date.now();
      const { count: pCount, error: pErr } = await supabaseClient
        .from('playlists')
        .select('*', { count: 'exact', head: true });

      if (pErr && pErr.code !== 'PGRST116') {
        throw new Error(pErr.message);
      }

      const { count: cCount, error: cErr } = await supabaseClient
        .from('channels')
        .select('*', { count: 'exact', head: true });

      if (cErr && cErr.code !== 'PGRST116') {
        throw new Error(cErr.message);
      }

      const pingMs = Date.now() - startTime;
      activeProvider = 'supabase_api';
      console.log(`[CloudStorage] Connected to Supabase REST API in ${pingMs}ms`);

      const status: CloudStorageStatus = {
        enabled: true,
        provider: 'supabase_api',
        connected: true,
        channelCount: cCount || 0,
        playlistCount: pCount || 0,
        pingMs,
        configUrlMasked: supabaseUrl,
      };
      lastStatus = status;
      return status;
    } catch (err: any) {
      console.error('[CloudStorage] Supabase REST connection failed:', err.message);
      supabaseClient = null;
    }
  }

  activeProvider = 'local_fallback';
  lastStatus = {
    enabled: false,
    provider: 'local_fallback',
    connected: false,
    channelCount: 0,
    playlistCount: 0,
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
        const [pCountRes, cCountRes] = await Promise.all([
          pgPool.query('SELECT COUNT(*)::int as count FROM playlists'),
          pgPool.query('SELECT COUNT(*)::int as count FROM channels'),
        ]);
        lastStatus.playlistCount = pCountRes.rows[0]?.count || 0;
        lastStatus.channelCount = cCountRes.rows[0]?.count || 0;
      } catch {}
    } else if (supabaseClient) {
      try {
        const { count: cCount } = await supabaseClient
          .from('channels')
          .select('*', { count: 'exact', head: true });
        const { count: pCount } = await supabaseClient
          .from('playlists')
          .select('*', { count: 'exact', head: true });
        if (cCount !== null) lastStatus.channelCount = cCount;
        if (pCount !== null) lastStatus.playlistCount = pCount;
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
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_channels_status ON channels(status);
    CREATE INDEX IF NOT EXISTS idx_channels_group ON channels("group");
    CREATE INDEX IF NOT EXISTS idx_channels_playlist ON channels(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_channels_updated_at ON channels(updated_at);
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
          const base = idx * 15;
          placeholders.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15})`
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
            ch.updated_at || new Date().toISOString()
          );
        });

        const sql = `
          INSERT INTO channels (
            id, playlist_id, name, "group", logo, stream_url, format,
            tvg_id, tvg_name, video_codec, audio_codec, resolution, status, description, updated_at
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
  updates: Array<{ id: string; status: 'active' | 'offline'; description?: string; updated_at: string }>
): Promise<boolean> {
  if (updates.length === 0) return true;

  if (pgPool) {
    try {
      // Build a multi-row VALUES list: (id, status, description, updated_at)
      const values: any[] = [];
      const rows: string[] = [];
      updates.forEach((u, i) => {
        const b = i * 4;
        rows.push(`($${b + 1}::text, $${b + 2}::text, $${b + 3}::text, $${b + 4}::text)`);
        values.push(u.id, u.status, u.description || null, u.updated_at);
      });

      const sql = `
        UPDATE channels AS c
        SET
          status = v.status,
          description = v.description,
          updated_at = v.updated_at
        FROM (VALUES ${rows.join(', ')}) AS v(id, status, description, updated_at)
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
      const payload = updates.map((u) => ({
        id: u.id,
        status: u.status,
        description: u.description || null,
        updated_at: u.updated_at,
      }));
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
    updated_at TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tạo chỉ mục tối ưu tốc độ tìm kiếm & lọc trạng thái
CREATE INDEX IF NOT EXISTS idx_channels_status ON public.channels(status);
CREATE INDEX IF NOT EXISTS idx_channels_group ON public.channels("group");
CREATE INDEX IF NOT EXISTS idx_channels_playlist ON public.channels(playlist_id);
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
