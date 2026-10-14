import { Channel, SubtitleTrackInfo, StreamTestResult } from '../types/iptv.js';
import { getAllChannelsAdmin, updateChannel, saveFileState, flushCloudStatusUpdates } from '../db/storage.js';

export interface ScanItemResult {
  channelId: string;
  name: string;
  group: string;
  streamUrl: string;
  status: 'online' | 'offline';
  httpStatus?: number;
  responseTimeMs: number;
  hasSubtitles?: boolean;
  subtitleTracks?: SubtitleTrackInfo[];
  error?: string;
  checkedAt: string;
}

export interface BatchScanProgress {
  isRunning: boolean;
  total: number;
  scanned: number;
  onlineCount: number;
  offlineCount: number;
  subtitlesCount: number;
  currentChannelName?: string;
  startedAt?: string;
  finishedAt?: string;
  scopeDescription?: string;
  recentResults: ScanItemResult[];
}

let activeScan: {
  isCancelled: boolean;
  progress: BatchScanProgress;
} = {
  isCancelled: false,
  progress: {
    isRunning: false,
    total: 0,
    scanned: 0,
    onlineCount: 0,
    offlineCount: 0,
    subtitlesCount: 0,
    recentResults: [],
  },
};

/**
 * Bảng ánh xạ mã ngôn ngữ chuẩn ISO 639-1 / 639-2 sang tên Tiếng Việt thân thiện
 */
export const LANGUAGE_NAME_MAP: Record<string, string> = {
  vi: 'Tiếng Việt',
  vie: 'Tiếng Việt',
  en: 'English',
  eng: 'English',
  fr: 'Français',
  fra: 'Français',
  fre: 'Français',
  es: 'Español',
  spa: 'Español',
  de: 'Deutsch',
  deu: 'Deutsch',
  ger: 'Deutsch',
  zh: '中文',
  zho: '中文',
  chi: '中文',
  ja: '日本語',
  jpn: '日本語',
  ko: '한국어',
  kor: '한국어',
  ru: 'Русский',
  rus: 'Русский',
  th: 'ไทย',
  tha: 'ไทย',
  id: 'Bahasa Indonesia',
  ind: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  may: 'Bahasa Melayu',
  msa: 'Bahasa Melayu',
  pt: 'Português',
  por: 'Português',
  it: 'Italiano',
  ita: 'Italiano',
  ar: 'العربية',
  ara: 'العربية',
  hi: 'हिन्दी',
  hin: 'हिन्दी',
  km: 'Khmer',
  khm: 'Khmer',
  lo: 'Lao',
  lao: 'Lao',
  my: 'Burmese',
  mya: 'Burmese',
};

/**
 * Chuẩn hóa mã và tên ngôn ngữ phụ đề
 */
export function normalizeLanguage(codeOrName?: string): { code: string; label: string } {
  if (!codeOrName) return { code: 'unknown', label: 'Không xác định' };
  const clean = codeOrName.trim().toLowerCase();

  // Tra cứu trực tiếp
  if (LANGUAGE_NAME_MAP[clean]) {
    return { code: clean.slice(0, 2), label: LANGUAGE_NAME_MAP[clean] };
  }

  // Tra cứu theo chuỗi con
  for (const [key, val] of Object.entries(LANGUAGE_NAME_MAP)) {
    if (clean.includes(val.toLowerCase()) || clean === key || clean.startsWith(`${key}-`)) {
      return { code: key.slice(0, 2), label: val };
    }
  }

  return { code: clean.slice(0, 3), label: codeOrName.trim() };
}

/**
 * Phân tích danh sách thuộc tính HLS (key="val" hoặc key=val)
 */
export function parseHlsAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const regex = /([A-Z0-9\-_]+)\s*=\s*(?:"([^"]*)"|([^,\r\n]+))/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(attrString)) !== null) {
    const key = match[1].toUpperCase().trim();
    const val = (match[2] !== undefined ? match[2] : match[3] || '').trim();
    if (key) {
      attrs[key] = val;
    }
  }

  return attrs;
}

/**
 * Phân tích thẻ phụ đề và closed-caption từ nội dung Master Manifest HLS (.m3u8)
 * Nhận diện:
 * 1. #EXT-X-MEDIA:TYPE=SUBTITLES,...
 * 2. #EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,... (CEA-608 / CEA-708)
 * 3. #EXT-X-STREAM-INF: ... SUBTITLES="...", CLOSED-CAPTIONS="..."
 */
export function parseHlsSubtitles(manifestContent: string, baseUrl?: string): SubtitleTrackInfo[] {
  if (!manifestContent) return [];

  const rawTracks: SubtitleTrackInfo[] = [];
  const lines = manifestContent.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('#EXT-X-MEDIA:')) continue;

    const attrs = parseHlsAttributes(trimmed.substring('#EXT-X-MEDIA:'.length));
    const mediaType = (attrs['TYPE'] || '').toUpperCase();

    if (mediaType === 'SUBTITLES' || mediaType === 'CLOSED-CAPTIONS') {
      const rawLang = attrs['LANGUAGE'] || '';
      const rawName = attrs['NAME'] || '';
      const norm = normalizeLanguage(rawLang || rawName);

      let uri = attrs['URI'];
      if (uri && baseUrl) {
        try {
          uri = new URL(uri, baseUrl).href;
        } catch {
          // Giữ nguyên URI gốc nếu parse lỗi
        }
      }

      const isDefault = attrs['DEFAULT']?.toUpperCase() === 'YES';
      const autoSelect = attrs['AUTOSELECT']?.toUpperCase() === 'YES';
      const forced = attrs['FORCED']?.toUpperCase() === 'YES';
      const trackType: SubtitleTrackInfo['type'] = mediaType === 'CLOSED-CAPTIONS' ? 'cea608' : 'vtt';

      const displayName = rawName || norm.label || (rawLang ? rawLang.toUpperCase() : 'Phụ đề');

      rawTracks.push({
        id: attrs['GROUP-ID'] ? `${attrs['GROUP-ID']}-${norm.code || displayName}` : undefined,
        name: displayName,
        lang: norm.code || rawLang || 'unknown',
        isDefault,
        autoSelect,
        forced,
        type: trackType,
        uri,
      });
    }
  }

  // Khử trùng lặp theo loại + ngôn ngữ + tên
  const seen = new Set<string>();
  const deduplicated: SubtitleTrackInfo[] = [];

  for (const t of rawTracks) {
    const key = `${t.type}-${(t.lang || '').toLowerCase()}-${(t.name || '').toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(t);
    }
  }

  // Nếu không có EXT-X-MEDIA trực tiếp, kiểm tra khai báo CLOSED-CAPTIONS trên EXT-X-STREAM-INF
  if (deduplicated.length === 0) {
    for (const line of lines) {
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const attrs = parseHlsAttributes(line.substring('#EXT-X-STREAM-INF:'.length));
        const cc = attrs['CLOSED-CAPTIONS'];
        if (cc && cc.toUpperCase() !== 'NONE') {
          deduplicated.push({
            id: 'stream-cc',
            name: 'Closed Captions (In-stream)',
            lang: 'auto',
            type: 'cea608',
            isDefault: false,
          });
          break;
        }
      }
    }
  }

  return deduplicated;
}

/**
 * Thăm dò chuyên sâu tính khả dụng và phụ đề của một luồng stream IPTV (HLS / MPEG-TS / HTTP)
 * Kiểm tra 3 giai đoạn:
 * 1. HTTP Status & Network Latency (GET với Range 32KB và timeout 2.8s)
 * 2. Phân tích nội dung Master Manifest HLS: Tìm kiếm các track phụ đề SUBTITLES và CLOSED-CAPTIONS
 * 3. HLS Playlist Validation (Phát hiện trang lỗi 404/Cloudflare giả dạng HTTP 200)
 */
export async function probeChannelStream(streamUrl: string): Promise<{
  status: 'online' | 'offline';
  responseTimeMs: number;
  httpStatus?: number;
  hasSubtitles?: boolean;
  subtitleTracks?: SubtitleTrackInfo[];
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const parsed = new URL(streamUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        status: 'offline',
        responseTimeMs: 0,
        hasSubtitles: false,
        subtitleTracks: [],
        error: 'Giao thức URL không hợp lệ (cần http hoặc https)',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800); // 2.8s timeout siêu nhanh

    let res: Response;
    let bodyText = '';

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*',
      Range: 'bytes=0-32768',
    };

    try {
      res = await fetch(streamUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      // Đọc nhanh tối đa 32KB để nhận trọn vẹn HLS Master Manifest
      const reader = res.body?.getReader();
      if (reader) {
        let totalRead = 0;
        const chunks: Uint8Array[] = [];
        const maxBytes = 32768;

        while (totalRead < maxBytes) {
          const { done, value } = await reader.read();
          if (done || !value) break;
          chunks.push(value);
          totalRead += value.length;

          // Nếu là luồng MPEG-TS nhị phân (sync byte 0x47), 1KB đã đủ chứng minh luồng sống
          if (value[0] === 0x47 && totalRead >= 188 * 4) {
            break;
          }
        }
        controller.abort(); // Ngắt tải để tiết kiệm băng thông

        const total = new Uint8Array(totalRead);
        let offset = 0;
        for (const c of chunks) {
          total.set(c, offset);
          offset += c.length;
        }
        bodyText = new TextDecoder('utf-8', { fatal: false }).decode(total);
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && bodyText) {
        // Đã nhận được dữ liệu và chủ động ngắt
      } else {
        // Thử lại với HEAD nếu GET bị lỗi
        try {
          const headController = new AbortController();
          const headTimeout = setTimeout(() => headController.abort(), 2200);
          res = await fetch(streamUrl, {
            method: 'HEAD',
            headers: { 'User-Agent': headers['User-Agent'] },
            signal: headController.signal,
          });
          clearTimeout(headTimeout);
        } catch (headErr: any) {
          clearTimeout(timeout);
          const responseTime = Date.now() - startTime;
          return {
            status: 'offline',
            responseTimeMs: responseTime,
            hasSubtitles: false,
            subtitleTracks: [],
            error:
              headErr.name === 'AbortError'
                ? 'Hết thời gian kết nối (>2.8s)'
                : headErr.message || 'Không thể kết nối đến máy chủ stream',
          };
        }
      }
    } finally {
      clearTimeout(timeout);
    }

    const responseTime = Date.now() - startTime;

    if (!res!) {
      return {
        status: 'offline',
        responseTimeMs: responseTime,
        hasSubtitles: false,
        subtitleTracks: [],
        error: 'Máy chủ không phản hồi',
      };
    }

    // Kiểm tra HTTP Code
    if (res.status >= 400) {
      let errDesc = `HTTP ${res.status}`;
      if (res.status === 403) errDesc = 'HTTP 403 (Chặn quyền truy cập / Token hết hạn)';
      else if (res.status === 404) errDesc = 'HTTP 404 (Kênh không tồn tại / Link chết)';
      else if (res.status >= 500) errDesc = `HTTP ${res.status} (Máy chủ nguồn IPTV bị lỗi)`;

      return {
        status: 'offline',
        responseTimeMs: responseTime,
        httpStatus: res.status,
        hasSubtitles: false,
        subtitleTracks: [],
        error: errDesc,
      };
    }

    // Nếu là HLS .m3u8, kiểm tra xem nội dung có phải là HTML giả dạng 200 không
    if (bodyText) {
      const lower = bodyText.toLowerCase();
      if (lower.includes('<html') || lower.includes('<!doctype') || lower.includes('cloudflare')) {
        return {
          status: 'offline',
          responseTimeMs: responseTime,
          httpStatus: res.status,
          hasSubtitles: false,
          subtitleTracks: [],
          error: 'Trả về trang web HTML lỗi thay vì luồng video thực tế',
        };
      }
    }

    // Phân tích phụ đề từ HLS manifest
    let hasSubtitles = false;
    let subtitleTracks: SubtitleTrackInfo[] = [];

    if (bodyText && (bodyText.includes('#EXTM3U') || streamUrl.includes('.m3u8'))) {
      const finalUrl = res.url || streamUrl;
      subtitleTracks = parseHlsSubtitles(bodyText, finalUrl);
      if (subtitleTracks.length > 0) {
        hasSubtitles = true;
      }
    }

    return {
      status: 'online',
      responseTimeMs: responseTime,
      httpStatus: res.status,
      hasSubtitles,
      subtitleTracks,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      responseTimeMs: Date.now() - startTime,
      hasSubtitles: false,
      subtitleTracks: [],
      error: err.name === 'AbortError' ? 'Hết thời gian kết nối (>2.8s)' : err.message || 'Lỗi mạng không xác định',
    };
  }
}

/**
 * Quét 1 kênh đơn lẻ và cập nhật trạng thái cùng thông tin phụ đề ngay
 */
export async function scanSingleChannel(channel: Channel): Promise<ScanItemResult> {
  const probe = await probeChannelStream(channel.stream_url);
  const newStatus = probe.status === 'online' ? 'active' : 'offline';

  // Bảo lưu thông tin phụ đề đã phát hiện trước đó nếu kết quả mới không có
  const hasSubtitles = probe.hasSubtitles ?? channel.has_subtitles ?? false;
  const subtitleTracks = (probe.subtitleTracks && probe.subtitleTracks.length > 0)
    ? probe.subtitleTracks
    : (channel.subtitle_tracks || []);

  // Xây dựng mô tả trạng thái kèm ghi chú phụ đề
  let desc = '';
  if (probe.status === 'online') {
    let subTag = '';
    if (hasSubtitles && subtitleTracks.length > 0) {
      const trackLangs = Array.from(
        new Set(
          subtitleTracks.map((t) => (t.lang && t.lang !== 'unknown' ? t.lang.toUpperCase() : t.name || 'CC'))
        )
      ).slice(0, 3).join(', ');
      subTag = ` [CC: ${trackLangs}]`;
    }
    desc = `Khả dụng (Ping ${probe.responseTimeMs}ms${subTag}, ${new Date().toLocaleDateString('vi-VN')})`;
  } else {
    desc = `Không khả dụng: ${probe.error || 'Lỗi kết nối'} (${new Date().toLocaleDateString('vi-VN')})`;
  }

  const updatePayload: Partial<Channel> = {
    status: newStatus,
    description: desc,
    has_subtitles: hasSubtitles,
    subtitle_tracks: subtitleTracks,
    updated_at: new Date().toISOString(),
  };

  await updateChannel(channel.id, updatePayload);

  return {
    channelId: channel.id,
    name: channel.name,
    group: channel.group,
    streamUrl: channel.stream_url,
    status: probe.status,
    httpStatus: probe.httpStatus,
    responseTimeMs: probe.responseTimeMs,
    hasSubtitles,
    subtitleTracks,
    error: probe.error,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Chạy quét kênh theo cơ chế Worker Pool đa luồng
 * Hỗ trợ quét theo danh sách ID (trang hiện tại), theo nhóm, hoặc toàn bộ hệ thống
 */
export async function startBatchScan(options?: {
  concurrency?: number;
  channelIds?: string[];
  group?: string;
  scopeDescription?: string;
}): Promise<void> {
  if (activeScan.progress.isRunning) {
    return; // Đang có tiến trình quét đang chạy
  }

  const concurrency = options?.concurrency || 15;
  const allChannels = await getAllChannelsAdmin();

  let targetChannels: Channel[] = allChannels;

  if (options?.channelIds && options.channelIds.length > 0) {
    const idSet = new Set(options.channelIds);
    targetChannels = allChannels.filter((c) => idSet.has(c.id));
  } else if (options?.group && options.group !== 'all') {
    targetChannels = allChannels.filter(
      (c) => c.group.toLowerCase() === options.group!.toLowerCase()
    );
  }

  activeScan.isCancelled = false;
  activeScan.progress = {
    isRunning: true,
    total: targetChannels.length,
    scanned: 0,
    onlineCount: 0,
    offlineCount: 0,
    subtitlesCount: 0,
    currentChannelName: '',
    scopeDescription: options?.scopeDescription || `Quét ${targetChannels.length} kênh`,
    startedAt: new Date().toISOString(),
    recentResults: [],
  };

  // Chạy ngầm trong background
  (async () => {
    let index = 0;

    async function worker() {
      while (index < targetChannels.length && !activeScan.isCancelled) {
        const currentIndex = index++;
        const channel = targetChannels[currentIndex];
        if (!channel) continue;

        activeScan.progress.currentChannelName = channel.name;

        try {
          const result = await scanSingleChannel(channel);

          activeScan.progress.scanned++;
          if (result.status === 'online') {
            activeScan.progress.onlineCount++;
          } else {
            activeScan.progress.offlineCount++;
          }

          if (result.hasSubtitles) {
            activeScan.progress.subtitlesCount++;
          }

          // Giữ 50 kết quả gần nhất cho bảng tiến trình
          activeScan.progress.recentResults.unshift(result);
          if (activeScan.progress.recentResults.length > 50) {
            activeScan.progress.recentResults.pop();
          }
        } catch {
          activeScan.progress.scanned++;
          activeScan.progress.offlineCount++;
          try {
            await updateChannel(channel.id, {
              status: 'offline',
              description: `Không khả dụng (${new Date().toLocaleDateString('vi-VN')})`,
              updated_at: new Date().toISOString(),
            });
          } catch {}
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, targetChannels.length || 1) }, () => worker());
    await Promise.all(workers);

    // Flush buffered cloud updates and save to disk
    await flushCloudStatusUpdates();
    saveFileState(true);

    activeScan.progress.isRunning = false;
    activeScan.progress.finishedAt = new Date().toISOString();
    activeScan.progress.currentChannelName = undefined;
  })();
}

export function stopBatchScan(): void {
  activeScan.isCancelled = true;
  activeScan.progress.isRunning = false;
  activeScan.progress.finishedAt = new Date().toISOString();
  flushCloudStatusUpdates().catch(console.error);
}

export function getScanProgress(): BatchScanProgress {
  return { ...activeScan.progress };
}
