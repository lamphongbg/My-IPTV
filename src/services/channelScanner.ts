import { Channel, StreamTestResult } from '../types/iptv.js';
import { getAllChannelsAdmin, updateChannel } from '../db/storage.js';

export interface ScanItemResult {
  channelId: string;
  name: string;
  group: string;
  streamUrl: string;
  status: 'online' | 'offline';
  httpStatus?: number;
  responseTimeMs: number;
  error?: string;
  checkedAt: string;
}

export interface BatchScanProgress {
  isRunning: boolean;
  total: number;
  scanned: number;
  onlineCount: number;
  offlineCount: number;
  currentChannelName?: string;
  startedAt?: string;
  finishedAt?: string;
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
    recentResults: [],
  },
};

/**
 * Thăm dò chuyên sâu tính khả dụng của một luồng stream IPTV (HLS / MPEG-TS / HTTP)
 * Kiểm tra 2 giai đoạn:
 * 1. HTTP Status & Network Latency (HEAD / GET Range)
 * 2. HLS Playlist Validation (Phát hiện trang lỗi 404/Cloudflare giả dạng HTTP 200)
 */
export async function probeChannelStream(streamUrl: string): Promise<{
  status: 'online' | 'offline';
  responseTimeMs: number;
  httpStatus?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    const parsed = new URL(streamUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        status: 'offline',
        responseTimeMs: 0,
        error: 'Giao thức URL không hợp lệ (cần http hoặc https)',
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500); // 4.5s probe timeout

    let res: Response;
    let bodyText = '';

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: '*/*',
      Range: 'bytes=0-2048',
    };

    try {
      res = await fetch(streamUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      // Đọc nhanh 1024 bytes đầu tiên để xác thực
      const reader = res.body?.getReader();
      if (reader) {
        const { value } = await reader.read();
        if (value) {
          bodyText = new TextDecoder().decode(value);
        }
        controller.abort(); // Đóng stream ngay sau khi nhận header/body đầu
      }
    } catch (err: any) {
      if (err.name === 'AbortError' && bodyText) {
        // Đã nhận được dữ liệu và chủ động ngắt
      } else {
        // Thử lại với HEAD nếu GET bị lỗi
        try {
          const headController = new AbortController();
          const headTimeout = setTimeout(() => headController.abort(), 3500);
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
            error:
              headErr.name === 'AbortError'
                ? 'Hết thời gian kết nối (>4.5s)'
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
          error: 'Trả về trang web HTML lỗi thay vì luồng video thực tế',
        };
      }
    }

    return {
      status: 'online',
      responseTimeMs: responseTime,
      httpStatus: res.status,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      responseTimeMs: Date.now() - startTime,
      error: err.name === 'AbortError' ? 'Hết thời gian kết nối (>4.5s)' : err.message || 'Lỗi mạng không xác định',
    };
  }
}

/**
 * Quét 1 kênh đơn lẻ và cập nhật trạng thái ngay
 */
export async function scanSingleChannel(channel: Channel): Promise<ScanItemResult> {
  const probe = await probeChannelStream(channel.stream_url);
  const newStatus = probe.status === 'online' ? 'active' : 'offline';

  await updateChannel(channel.id, {
    status: newStatus,
    description: probe.status === 'online'
      ? `Khả dụng (Ping ${probe.responseTimeMs}ms, ${new Date().toLocaleDateString('vi-VN')})`
      : `Không khả dụng: ${probe.error || 'Lỗi kết nối'} (${new Date().toLocaleDateString('vi-VN')})`,
    updated_at: new Date().toISOString(),
  });

  return {
    channelId: channel.id,
    name: channel.name,
    group: channel.group,
    streamUrl: channel.stream_url,
    status: probe.status,
    httpStatus: probe.httpStatus,
    responseTimeMs: probe.responseTimeMs,
    error: probe.error,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Chạy quét toàn bộ kênh theo cơ chế Worker Pool (Concurrency Queue)
 * Giới hạn đồng thời (mặc định 6 kênh) để tránh nghẽn CPU và không bị ISP chặn IP
 */
export async function startBatchScan(concurrency: number = 6): Promise<void> {
  if (activeScan.progress.isRunning) {
    return; // Đang chạy quét tiến trình trước đó
  }

  const allChannels = await getAllChannelsAdmin();
  activeScan.isCancelled = false;
  activeScan.progress = {
    isRunning: true,
    total: allChannels.length,
    scanned: 0,
    onlineCount: 0,
    offlineCount: 0,
    currentChannelName: '',
    startedAt: new Date().toISOString(),
    recentResults: [],
  };

  // Chạy ngầm trong background
  (async () => {
    let index = 0;

    async function worker() {
      while (index < allChannels.length && !activeScan.isCancelled) {
        const currentIndex = index++;
        const channel = allChannels[currentIndex];
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

          // Giữ 30 kết quả gần nhất cho bảng tiến trình
          activeScan.progress.recentResults.unshift(result);
          if (activeScan.progress.recentResults.length > 50) {
            activeScan.progress.recentResults.pop();
          }
        } catch (err) {
          activeScan.progress.scanned++;
          activeScan.progress.offlineCount++;
        }
      }
    }

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    activeScan.progress.isRunning = false;
    activeScan.progress.finishedAt = new Date().toISOString();
    activeScan.progress.currentChannelName = undefined;
  })();
}

export function stopBatchScan(): void {
  activeScan.isCancelled = true;
  activeScan.progress.isRunning = false;
  activeScan.progress.finishedAt = new Date().toISOString();
}

export function getScanProgress(): BatchScanProgress {
  return { ...activeScan.progress };
}
