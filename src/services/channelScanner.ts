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

export interface ProbeStreamResult {
  status: 'online' | 'offline';
  responseTimeMs: number;
  httpStatus?: number;
  hasSubtitles?: boolean;
  subtitleTracks?: SubtitleTrackInfo[];
  codecNote?: string;
  format?: 'hls' | 'dash' | 'ts' | 'mp4' | 'http';
  requiresVlc?: boolean;
  webPlayable?: boolean;
  error?: string;
}

/**
 * Thăm dò chuyên sâu tính khả dụng, định dạng phát và phụ đề của một luồng stream IPTV
 * Kiểm tra 4 giai đoạn chuẩn chuyên gia streaming:
 * 1. HTTP Status & Network Latency (GET với Range 32KB và timeout 2.8s)
 * 2. Phân tích nội dung Master Manifest HLS: Tìm kiếm các track phụ đề SUBTITLES và CLOSED-CAPTIONS (CEA-608)
 * 3. HLS Playlist Validation (Phát hiện trang lỗi 404/Cloudflare giả dạng HTTP 200, phát hiện HTTP 204 No Content hoặc 0 byte)
 * 4. Phát hiện định dạng luồng & khả năng phát trên trình duyệt Web (Web HLS vs Raw MPEG-TS / DASH / AC-3 cần VLC)
 */
export async function probeChannelStream(streamUrl: string): Promise<ProbeStreamResult> {
  const startTime = Date.now();

  try {
    const parsed = new URL(streamUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        status: 'offline',
        responseTimeMs: 0,
        hasSubtitles: false,
        subtitleTracks: [],
        format: 'http',
        requiresVlc: false,
        webPlayable: false,
        error: 'Giao thức URL không hợp lệ (cần http hoặc https)',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2800); // 2.8s timeout siêu nhanh

    let res: Response;
    let bodyText = '';
    let isRawTsBinary = false;

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, video/mp2t, */*',
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

          // Nếu là luồng MPEG-TS nhị phân (sync byte 0x47)
          if (value[0] === 0x47 && totalRead >= 188 * 4) {
            isRawTsBinary = true;
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
      if (err.name === 'AbortError' && (bodyText || isRawTsBinary)) {
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

    // Kiểm tra phản hồi rỗng: HTTP 204 No Content hoặc phản hồi không có byte nào
    const isTsUrl = streamUrl.endsWith('.ts') || streamUrl.includes('/udp/') || streamUrl.includes(':4022/');
    if (res.status === 204 || (!bodyText && !isRawTsBinary && !isTsUrl)) {
      return {
        status: 'offline',
        responseTimeMs: responseTime,
        httpStatus: res.status,
        hasSubtitles: false,
        subtitleTracks: [],
        error: 'Luồng phát không trả về dữ liệu (HTTP 204 hoặc 0 byte)',
      };
    }

    // Nếu trả về HTML giả dạng 200 (Cloudflare, captcha hoặc trang thông báo lỗi)
    if (bodyText) {
      const lower = bodyText.toLowerCase();
      if (
        lower.includes('<html') ||
        lower.includes('<!doctype') ||
        lower.includes('cloudflare') ||
        lower.includes('access denied') ||
        lower.includes('attention required')
      ) {
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

    // Nhận diện định dạng luồng
    const isDash = streamUrl.includes('.mpd') || (bodyText && bodyText.includes('<MPD'));
    const isMpegTs = isRawTsBinary || isTsUrl || (bodyText && bodyText.charCodeAt(0) === 0x47);
    const isHls = !isDash && !isMpegTs && (bodyText.includes('#EXTM3U') || streamUrl.includes('.m3u8') || streamUrl.includes('chunklist'));
    const format: 'hls' | 'dash' | 'ts' | 'mp4' | 'http' = isDash
      ? 'dash'
      : isMpegTs
      ? 'ts'
      : isHls
      ? 'hls'
      : streamUrl.includes('.mp4')
      ? 'mp4'
      : 'http';

    // Phân tích phụ đề và định dạng từ HLS manifest
    let hasSubtitles = false;
    let subtitleTracks: SubtitleTrackInfo[] = [];
    let codecNote: string | undefined = undefined;

    if (bodyText && isHls) {
      const finalUrl = res.url || streamUrl;
      subtitleTracks = parseHlsSubtitles(bodyText, finalUrl);
      if (subtitleTracks.length > 0) {
        hasSubtitles = true;
      }

      // Thăm dò sâu (Deep Probe) vào luồng media con nếu là Master Playlist (#EXT-X-STREAM-INF)
      // Loại bỏ hoàn toàn lỗi báo ảo: Master 200 OK nhưng sub-playlist hoặc chunk video thực tế bị chết 404/403
      if (bodyText.includes('#EXT-X-STREAM-INF:')) {
        const lines = bodyText.split(/\r?\n/);
        let variantUri: string | null = null;
        let codecsAttr = '';

        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (l.startsWith('#EXT-X-STREAM-INF:')) {
            const attrs = parseHlsAttributes(l.substring('#EXT-X-STREAM-INF:'.length));
            if (attrs['CODECS']) codecsAttr = attrs['CODECS'];

            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j].trim();
              if (nextLine && !nextLine.startsWith('#')) {
                variantUri = nextLine;
                break;
              }
            }
            if (variantUri) break;
          }
        }

        // Nhận diện codec đặc biệt (AC-3 / EAC-3 / MPEG-2)
        if (codecsAttr) {
          const lowerCodecs = codecsAttr.toLowerCase();
          if (lowerCodecs.includes('ac-3') || lowerCodecs.includes('ec-3') || lowerCodecs.includes('mp4a.40.33')) {
            codecNote = 'Audio AC-3';
          } else if (lowerCodecs.includes('mp2v') || lowerCodecs.includes('mpeg2')) {
            codecNote = 'Video MPEG-2';
          }
        }

        if (variantUri) {
          try {
            const resolvedVariant = new URL(variantUri, finalUrl).href;
            const subController = new AbortController();
            const subTimeout = setTimeout(() => subController.abort(), 2400);

            const subRes = await fetch(resolvedVariant, {
              method: 'GET',
              headers: {
                'User-Agent': headers['User-Agent'],
                Accept: headers['Accept'],
                Range: 'bytes=0-16384',
              },
              signal: subController.signal,
            });
            clearTimeout(subTimeout);

            if (!subRes.ok && subRes.status >= 400) {
              return {
                status: 'offline',
                responseTimeMs: Date.now() - startTime,
                httpStatus: subRes.status,
                hasSubtitles: false,
                subtitleTracks: [],
                format,
                error: `Sub-playlist luồng video bị lỗi: HTTP ${subRes.status} (Link con chết/hết hạn)`,
              };
            }

            const subText = await subRes.text();
            if (subText && (subText.toLowerCase().includes('<html') || subText.toLowerCase().includes('cloudflare'))) {
              return {
                status: 'offline',
                responseTimeMs: Date.now() - startTime,
                httpStatus: subRes.status,
                hasSubtitles: false,
                subtitleTracks: [],
                format,
                error: 'Sub-playlist trả về trang web HTML lỗi',
              };
            }

            // Nếu sub-playlist không chứa phân đoạn hoặc tag HLS hợp lệ
            if (subText && !subText.includes('#EXTINF') && !subText.includes('#EXT-X-TARGETDURATION') && !subText.includes('#EXTM3U')) {
              return {
                status: 'offline',
                responseTimeMs: Date.now() - startTime,
                httpStatus: subRes.status,
                hasSubtitles: false,
                subtitleTracks: [],
                format,
                error: 'Sub-playlist không chứa phân đoạn video hợp lệ (.ts/.m4s)',
              };
            }
          } catch (subErr: any) {
            return {
              status: 'offline',
              responseTimeMs: Date.now() - startTime,
              hasSubtitles: false,
              subtitleTracks: [],
              format,
              error: `Lỗi kết nối sub-playlist: ${subErr.name === 'AbortError' ? 'Hết thời gian tải (>2.4s)' : subErr.message || 'Lỗi mạng'}`,
            };
          }
        }
      }
    }

    // Đánh giá tính tương thích của trình duyệt (Web Playable vs Cần VLC)
    const isAc3 = Boolean(codecNote && codecNote.includes('AC-3'));
    const isMpeg2 = Boolean(codecNote && codecNote.includes('MPEG-2'));
    const requiresVlc = Boolean(isDash || isMpegTs || isAc3 || isMpeg2);
    const webPlayable = !requiresVlc && isHls;

    return {
      status: 'online',
      responseTimeMs: responseTime,
      httpStatus: res.status,
      hasSubtitles,
      subtitleTracks,
      codecNote,
      format,
      requiresVlc,
      webPlayable,
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

  // Xây dựng mô tả trạng thái kèm ghi chú phụ đề, codec và tính tương thích Web/VLC
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

    let playerNote = ' • Web HLS';
    if (probe.requiresVlc) {
      if (probe.format === 'dash') playerNote = ' • Cần VLC (MPEG-DASH)';
      else if (probe.format === 'ts') playerNote = ' • Cần VLC (MPEG-TS)';
      else if (probe.codecNote) playerNote = ` • Cần VLC (${probe.codecNote})`;
      else playerNote = ' • Cần VLC Player';
    }

    desc = `Khả dụng (Ping ${probe.responseTimeMs}ms${playerNote}${subTag}, ${new Date().toLocaleDateString('vi-VN')})`;
  } else {
    desc = `Không khả dụng: ${probe.error || 'Lỗi kết nối'} (${new Date().toLocaleDateString('vi-VN')})`;
  }

  const updatePayload: Partial<Channel> = {
    status: newStatus,
    description: desc,
    has_subtitles: hasSubtitles,
    subtitle_tracks: subtitleTracks,
    format: probe.format || channel.format,
    requires_vlc: probe.requiresVlc ?? false,
    web_playable: probe.webPlayable ?? true,
    video_codec: probe.codecNote?.includes('Video') ? probe.codecNote : channel.video_codec,
    audio_codec: probe.codecNote?.includes('Audio') ? probe.codecNote : channel.audio_codec,
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
