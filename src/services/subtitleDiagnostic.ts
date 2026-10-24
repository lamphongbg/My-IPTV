/**
 * Subtitle Diagnostic Engine for HLS Streams (.m3u8)
 * Performs deep, multi-stage inspection of HLS Master Manifests,
 * validates #EXT-X-MEDIA:TYPE=SUBTITLES and #EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS,
 * probes sub-playlist URIs, and inspects actual WebVTT segments.
 */

export interface SubtitleTrackDiagnostic {
  id: string;
  groupId: string;
  name: string;
  language: string;
  type: 'SUBTITLES' | 'CLOSED-CAPTIONS';
  isDefault: boolean;
  autoSelect: boolean;
  forced: boolean;
  instreamId?: string; // CC1, CC2, etc.
  uri?: string;
  resolvedUri?: string;
  // Verification probe results
  httpStatus?: number;
  responseTimeMs?: number;
  accessible: boolean;
  format?: 'webvtt' | 'fmp4' | 'raw' | 'unknown';
  segmentCount?: number;
  sampleSegmentUri?: string;
  sampleSegmentAccessible?: boolean;
  sampleSegmentHasWebVttHeader?: boolean;
  error?: string;
}

export interface VariantStreamDiagnostic {
  bandwidth?: number;
  resolution?: string;
  codecs?: string;
  subtitlesGroup?: string;
  closedCaptionsGroup?: string;
  hasClosedCaptionsNone: boolean;
  uri: string;
}

export interface SubtitleDiagnosticReport {
  streamUrl: string;
  channelId?: string;
  channelName?: string;
  isHls: boolean;
  masterHttpStatus: number;
  masterLatencyMs: number;
  rawMasterSnippet: string;
  // Tags analysis
  hasSubtitleTags: boolean; // Has EXT-X-MEDIA:TYPE=SUBTITLES
  hasClosedCaptionsTags: boolean; // Has EXT-X-MEDIA:TYPE=CLOSED-CAPTIONS
  hasInStreamCaptionsDeclared: boolean; // CLOSED-CAPTIONS="CC..." in EXT-X-STREAM-INF
  hasClosedCaptionsNone: boolean; // CLOSED-CAPTIONS=NONE
  subtitleTracks: SubtitleTrackDiagnostic[];
  closedCaptionsTracks: SubtitleTrackDiagnostic[];
  variantStreams: VariantStreamDiagnostic[];
  // Overall assessment
  verdict: 'verified' | 'warning' | 'missing_tags' | 'not_hls' | 'offline';
  verdictTitle: string;
  verdictMessage: string;
  recommendations: string[];
  checkedAt: string;
}

/**
 * Helper to parse comma-separated key=value or key="quoted value" in HLS attributes
 */
function parseHlsAttributes(attrStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^",\s]+))/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(attrStr)) !== null) {
    const key = match[1];
    const val = match[2] !== undefined ? match[2] : match[3];
    result[key] = val;
  }
  return result;
}

/**
 * Perform a deep diagnostic probe on an HLS stream URL (.m3u8)
 */
export async function runSubtitleDeepDiagnostic(
  streamUrl: string,
  options?: { channelId?: string; channelName?: string; timeoutMs?: number }
): Promise<SubtitleDiagnosticReport> {
  const timeoutMs = options?.timeoutMs || 4500;
  const startTime = Date.now();
  const checkedAt = new Date().toISOString();

  let masterHttpStatus = 0;
  let masterLatencyMs = 0;
  let rawBodyText = '';
  let finalMasterUrl = streamUrl;

  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 IPTV-Diagnostic/2.0',
    Accept: 'application/x-mpegURL, application/vnd.apple.mpegurl, text/plain, */*',
  };

  // Step 1: Fetch Master Manifest
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(streamUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    masterHttpStatus = res.status;
    masterLatencyMs = Date.now() - startTime;
    finalMasterUrl = res.url || streamUrl;

    if (!res.ok) {
      return {
        streamUrl,
        channelId: options?.channelId,
        channelName: options?.channelName,
        isHls: false,
        masterHttpStatus,
        masterLatencyMs,
        rawMasterSnippet: '',
        hasSubtitleTags: false,
        hasClosedCaptionsTags: false,
        hasInStreamCaptionsDeclared: false,
        hasClosedCaptionsNone: false,
        subtitleTracks: [],
        closedCaptionsTracks: [],
        variantStreams: [],
        verdict: 'offline',
        verdictTitle: `Máy chủ phản hồi lỗi HTTP ${masterHttpStatus}`,
        verdictMessage: `Không thể tải manifest HLS từ nguồn phát: HTTP ${masterHttpStatus}. Nguồn phát có thể đang tạm ngừng hoặc đường dẫn đã thay đổi.`,
        recommendations: [
          'Kiểm tra lại link stream trực tiếp trên trình duyệt hoặc trình phát VLC.',
          'Nguồn phát có thể áp dụng cơ chế xác thực IP hoặc token bảo mật theo phiên.',
          'Thử lại với các nguồn phát thay thế trong cùng danh mục.',
        ],
        checkedAt,
      };
    }

    rawBodyText = await res.text();
  } catch (err: any) {
    masterLatencyMs = Date.now() - startTime;
    return {
      streamUrl,
      channelId: options?.channelId,
      channelName: options?.channelName,
      isHls: false,
      masterHttpStatus: 0,
      masterLatencyMs,
      rawMasterSnippet: '',
      hasSubtitleTags: false,
      hasClosedCaptionsTags: false,
      hasInStreamCaptionsDeclared: false,
      hasClosedCaptionsNone: false,
      subtitleTracks: [],
      closedCaptionsTracks: [],
      variantStreams: [],
      verdict: 'offline',
      verdictTitle: 'Không thể kết nối đến máy chủ IPTV',
      verdictMessage: `Lỗi kết nối: ${err?.name === 'AbortError' ? `Hết thời gian chờ (>${timeoutMs}ms)` : err?.message || 'Lỗi mạng không xác định'}`,
      recommendations: [
        'Máy chủ nguồn phát IPTV có thể bị sập, quá tải hoặc chặn kết nối từ bên ngoài.',
        'Kiểm tra kết nối mạng hoặc thử chạy lại sau vài phút.',
      ],
      checkedAt,
    };
  }

  // Step 2: Check if payload is valid HLS
  const isHls = rawBodyText.includes('#EXTM3U') || streamUrl.includes('.m3u8');
  const rawMasterSnippet = rawBodyText
    .split(/\r?\n/)
    .slice(0, 45)
    .join('\n');

  if (!isHls) {
    const isDash = streamUrl.includes('.mpd') || rawBodyText.includes('<MPD');
    const isTs = streamUrl.endsWith('.ts') || streamUrl.includes('/udp/') || rawBodyText.charCodeAt(0) === 0x47;

    return {
      streamUrl,
      channelId: options?.channelId,
      channelName: options?.channelName,
      isHls: false,
      masterHttpStatus,
      masterLatencyMs,
      rawMasterSnippet: rawMasterSnippet.substring(0, 500),
      hasSubtitleTags: false,
      hasClosedCaptionsTags: false,
      hasInStreamCaptionsDeclared: false,
      hasClosedCaptionsNone: false,
      subtitleTracks: [],
      closedCaptionsTracks: [],
      variantStreams: [],
      verdict: 'not_hls',
      verdictTitle: isDash ? 'Định dạng MPEG-DASH (.mpd)' : isTs ? 'Định dạng Raw MPEG-TS (.ts)' : 'Không phải định dạng HLS chuẩn (.m3u8)',
      verdictMessage: isDash
        ? 'Luồng phát là định dạng MPEG-DASH XML, không áp dụng chuẩn thẻ HLS (#EXT-X-MEDIA).'
        : isTs
        ? 'Luồng phát là luồng nhị phân trực tiếp MPEG-TS, không chứa file manifest .m3u8 để khai báo track phụ đề.'
        : 'Nguồn phát không trả về header HLS (#EXTM3U). Có thể nguồn phát đang trả về trang HTML thông báo lỗi.',
      recommendations: [
        'Mở luồng bằng phần mềm chuyên dụng như VLC Media Player hoặc CorePlayer để giải mã các track âm thanh/phụ đề nhúng trong luồng TS/DASH.',
        'Sử dụng công cụ chuyển đổi relay hoặc tìm nguồn HLS (.m3u8) thay thế.',
      ],
      checkedAt,
    };
  }

  // Step 3: Parse EXT-X-MEDIA and EXT-X-STREAM-INF tags
  const lines = rawBodyText.split(/\r?\n/);
  const subtitleTracks: SubtitleTrackDiagnostic[] = [];
  const closedCaptionsTracks: SubtitleTrackDiagnostic[] = [];
  const variantStreams: VariantStreamDiagnostic[] = [];

  let hasInStreamCaptionsDeclared = false;
  let hasClosedCaptionsNone = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check #EXT-X-MEDIA:
    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseHlsAttributes(line.substring('#EXT-X-MEDIA:'.length));
      const type = (attrs['TYPE'] || '').toUpperCase();

      if (type === 'SUBTITLES') {
        const rawUri = attrs['URI'];
        let resolvedUri: string | undefined = undefined;
        if (rawUri) {
          try {
            resolvedUri = new URL(rawUri, finalMasterUrl).href;
          } catch {
            resolvedUri = rawUri;
          }
        }

        subtitleTracks.push({
          id: `sub_${subtitleTracks.length + 1}`,
          groupId: attrs['GROUP-ID'] || 'default',
          name: attrs['NAME'] || `Phụ đề ${subtitleTracks.length + 1}`,
          language: attrs['LANGUAGE'] || 'unknown',
          type: 'SUBTITLES',
          isDefault: attrs['DEFAULT']?.toUpperCase() === 'YES',
          autoSelect: attrs['AUTOSELECT']?.toUpperCase() === 'YES',
          forced: attrs['FORCED']?.toUpperCase() === 'YES',
          uri: rawUri,
          resolvedUri,
          accessible: false,
        });
      } else if (type === 'CLOSED-CAPTIONS') {
        closedCaptionsTracks.push({
          id: `cc_${closedCaptionsTracks.length + 1}`,
          groupId: attrs['GROUP-ID'] || 'default',
          name: attrs['NAME'] || `Closed Captions ${closedCaptionsTracks.length + 1}`,
          language: attrs['LANGUAGE'] || 'unknown',
          type: 'CLOSED-CAPTIONS',
          isDefault: attrs['DEFAULT']?.toUpperCase() === 'YES',
          autoSelect: attrs['AUTOSELECT']?.toUpperCase() === 'YES',
          forced: attrs['FORCED']?.toUpperCase() === 'YES',
          instreamId: attrs['INSTREAM-ID'] || 'CC1',
          accessible: true, // in-stream carries inside video packets
        });
      }
    }

    // Check #EXT-X-STREAM-INF:
    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseHlsAttributes(line.substring('#EXT-X-STREAM-INF:'.length));
      const ccVal = attrs['CLOSED-CAPTIONS'];
      const subVal = attrs['SUBTITLES'];

      if (ccVal) {
        if (ccVal.toUpperCase() === 'NONE') {
          hasClosedCaptionsNone = true;
        } else {
          hasInStreamCaptionsDeclared = true;
        }
      }

      // Next line is variant URI
      let variantUri = '';
      for (let j = i + 1; j < lines.length; j++) {
        const nextLine = lines[j].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          variantUri = nextLine;
          break;
        }
      }

      variantStreams.push({
        bandwidth: attrs['BANDWIDTH'] ? parseInt(attrs['BANDWIDTH'], 10) : undefined,
        resolution: attrs['RESOLUTION'],
        codecs: attrs['CODECS'],
        subtitlesGroup: subVal,
        closedCaptionsGroup: ccVal,
        hasClosedCaptionsNone: ccVal?.toUpperCase() === 'NONE',
        uri: variantUri,
      });
    }
  }

  // Step 4: Deep Probe Subtitle Sub-playlists and WebVTT segments
  for (const track of subtitleTracks) {
    if (!track.resolvedUri) {
      track.accessible = false;
      track.error = 'Thẻ EXT-X-MEDIA:TYPE=SUBTITLES thiếu thuộc tính URI';
      continue;
    }

    const subStartTime = Date.now();
    try {
      const subController = new AbortController();
      const subTimeout = setTimeout(() => subController.abort(), 2800);

      const subRes = await fetch(track.resolvedUri, {
        method: 'GET',
        headers,
        signal: subController.signal,
      });
      clearTimeout(subTimeout);

      track.httpStatus = subRes.status;
      track.responseTimeMs = Date.now() - subStartTime;

      if (!subRes.ok) {
        track.accessible = false;
        track.error = `Máy chủ danh sách phụ đề trả về HTTP ${subRes.status}`;
        continue;
      }

      const subText = await subRes.text();
      track.accessible = true;

      // Check if it has segments
      const subLines = subText.split(/\r?\n/);
      let segmentCount = 0;
      let firstSegmentUri: string | null = null;

      for (let k = 0; k < subLines.length; k++) {
        const l = subLines[k].trim();
        if (l.startsWith('#EXTINF:')) {
          segmentCount++;
          if (!firstSegmentUri) {
            for (let m = k + 1; m < subLines.length; m++) {
              const segLine = subLines[m].trim();
              if (segLine && !segLine.startsWith('#')) {
                firstSegmentUri = segLine;
                break;
              }
            }
          }
        }
      }

      track.segmentCount = segmentCount;

      // Probe first segment if available
      if (firstSegmentUri) {
        try {
          const resolvedSeg = new URL(firstSegmentUri, track.resolvedUri).href;
          track.sampleSegmentUri = resolvedSeg;

          const segController = new AbortController();
          const segTimeout = setTimeout(() => segController.abort(), 2000);

          const segRes = await fetch(resolvedSeg, {
            method: 'GET',
            headers: {
              ...headers,
              Range: 'bytes=0-2048',
            },
            signal: segController.signal,
          });
          clearTimeout(segTimeout);

          if (segRes.ok) {
            track.sampleSegmentAccessible = true;
            const segChunk = await segRes.text();
            const upper = segChunk.toUpperCase();
            if (upper.includes('WEBVTT') || upper.includes('X-TIMESTAMP-MAP')) {
              track.format = 'webvtt';
              track.sampleSegmentHasWebVttHeader = true;
            } else if (segChunk.charCodeAt(0) === 0x47) {
              track.format = 'raw';
            } else {
              track.format = 'unknown';
            }
          }
        } catch (segErr: any) {
          track.sampleSegmentAccessible = false;
        }
      }
    } catch (subErr: any) {
      track.accessible = false;
      track.responseTimeMs = Date.now() - subStartTime;
      track.error =
        subErr.name === 'AbortError'
          ? 'Hết thời gian tải sub-playlist (>2.8s)'
          : subErr.message || 'Lỗi kết nối sub-playlist';
    }
  }

  // Step 5: Formulate Final Diagnosis & Verdict
  const hasSubtitleTags = subtitleTracks.length > 0;
  const hasClosedCaptionsTags = closedCaptionsTracks.length > 0;
  const recommendations: string[] = [];

  let verdict: SubtitleDiagnosticReport['verdict'] = 'missing_tags';
  let verdictTitle = '';
  let verdictMessage = '';

  if (hasSubtitleTags) {
    const accessibleTracks = subtitleTracks.filter((t) => t.accessible);
    if (accessibleTracks.length === subtitleTracks.length) {
      verdict = 'verified';
      verdictTitle = 'Đã xác minh: Phụ đề HLS WebVTT hợp lệ và truy cập tốt';
      verdictMessage = `Phát hiện ${subtitleTracks.length} track phụ đề WebVTT độc lập được khai báo chuẩn xác trong manifest (#EXT-X-MEDIA:TYPE=SUBTITLES) và tất cả sub-playlists đều phản hồi HTTP 200 nhanh chóng.`;
      recommendations.push(
        'Phụ đề WebVTT đã sẵn sàng. Người dùng có thể bấm phím "C" hoặc bật nút CC trên thanh điều khiển để thưởng thức.',
        'Kết hợp bật "Dịch AI Song ngữ" để tự động phiên dịch phụ đề gốc sang Tiếng Việt mượt mà.'
      );
    } else if (accessibleTracks.length > 0) {
      verdict = 'warning';
      verdictTitle = 'Cảnh báo: Một số track phụ đề bị lỗi kết nối hoặc 404';
      verdictMessage = `Phát hiện ${subtitleTracks.length} track phụ đề nhưng chỉ có ${accessibleTracks.length} track truy cập được. Một số file sub-playlist .m3u8 trả về lỗi hoặc hết hạn.`;
      recommendations.push(
        'Chọn các track phụ đề đã kiểm tra có dấu tích xanh để xem.',
        'Đối với các track báo lỗi 404, máy chủ IPTV của đài có thể đã đổi đường dẫn lưu trữ WebVTT.'
      );
    } else {
      verdict = 'warning';
      verdictTitle = 'Cảnh báo: Có thẻ phụ đề nhưng không thể tải được nội dung';
      verdictMessage = `Nguồn phát có khai báo thẻ phụ đề nhưng toàn bộ các URL danh sách phụ đề con (.m3u8) đều không thể kết nối hoặc trả về lỗi HTTP 4xx/5xx.`;
      recommendations.push(
        'Sử dụng tính năng "Dịch AI Trực tiếp" (Gemini / Google) tích hợp sẵn trong ứng dụng để tạo phụ đề tự động từ âm thanh.',
        'Mở luồng bằng VLC Media Player để kiểm tra xem có luồng phụ đề dự phòng nào khác không.'
      );
    }
  } else if (hasClosedCaptionsTags || hasInStreamCaptionsDeclared) {
    verdict = 'warning';
    verdictTitle = 'Chỉ có phụ đề nhúng CEA-608 (In-Stream Closed Captions)';
    const ccDetails = closedCaptionsTracks.map((c) => `${c.name} (${c.instreamId || 'CC1'})`).join(', ');
    verdictMessage = `Manifest không có thẻ #EXT-X-MEDIA:TYPE=SUBTITLES (WebVTT) độc lập, nhưng có khai báo phụ đề ẩn CEA-608 nhúng trong dòng video: ${ccDetails || 'CC1/CC2'}. Phụ đề này chỉ xuất hiện khi đài truyền hình thực sự phát gói SEI NAL trong chương trình hiện tại.`;
    recommendations.push(
      'Phụ đề CEA-608 sẽ tự động hiển thị trên ứng dụng ngay khi chương trình phát có đoạn thoại (không xuất hiện lúc quảng cáo).',
      'Ứng dụng đã được tích hợp bộ lọc CEA-608 debounce 250ms để tự động gom câu và dịch sang Tiếng Việt.'
    );
  } else {
    verdict = 'missing_tags';
    verdictTitle = 'Nguồn phát thiếu hoàn toàn thẻ khai báo phụ đề (EXT-X-MEDIA:TYPE=SUBTITLES)';
    verdictMessage = `Trong Master Manifest (.m3u8) của kênh này hoàn toàn không có bất kỳ thẻ khai báo phụ đề nào (#EXT-X-MEDIA:TYPE=SUBTITLES hoặc CLOSED-CAPTIONS). ${
      hasClosedCaptionsNone
        ? 'Manifest thậm chí khai báo rõ CLOSED-CAPTIONS=NONE (Không cung cấp phụ đề).'
        : 'Đài truyền hình hoặc máy chủ IPTV phát luồng gốc không nhúng bất kỳ track phụ đề nào trong danh sách phát này.'
    }`;
    recommendations.push(
      'Nguồn phát gốc không cung cấp phụ đề từ đài. Đây là đặc điểm của nguồn phát, không phải lỗi của ứng dụng.',
      'Giải pháp: Sử dụng tính năng "Chạy thử câu phụ đề mẫu (Demo)" hoặc "Dịch AI Trực tiếp" có sẵn trong menu phụ đề để trải nghiệm phụ đề dịch.',
      'Nếu bạn là quản trị viên đài phát hoặc chủ nguồn IPTV, hãy bổ sung thẻ #EXT-X-MEDIA:TYPE=SUBTITLES vào file master playlist.'
    );
  }

  return {
    streamUrl,
    channelId: options?.channelId,
    channelName: options?.channelName,
    isHls,
    masterHttpStatus,
    masterLatencyMs,
    rawMasterSnippet,
    hasSubtitleTags,
    hasClosedCaptionsTags,
    hasInStreamCaptionsDeclared,
    hasClosedCaptionsNone,
    subtitleTracks,
    closedCaptionsTracks,
    variantStreams,
    verdict,
    verdictTitle,
    verdictMessage,
    recommendations,
    checkedAt,
  };
}
