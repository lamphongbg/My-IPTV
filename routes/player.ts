import { Router, Request, Response } from 'express';
import { getChannelById } from './channels.js';
import { detectDevice } from '../utils/deviceDetector.js';

const router = Router();

router.get('/open/:channelId', async (req: Request, res: Response) => {
  const channelId = req.params.channelId;
  const channel = await getChannelById(channelId);

  const userAgent = req.headers['user-agent'] || '';
  const deviceInfo = detectDevice(userAgent);
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  const timestamp = new Date().toISOString();
  console.log(`[Stream Access] ${timestamp} | IP: ${clientIp} | Device: ${deviceInfo.type} | Channel: ${channelId} | Agent: ${userAgent.substring(0, 80)}`);

  if (!channel) {
    res.status(404).send(`<!DOCTYPE html>
<html>
<head><title>Channel Not Found</title></head>
<body style="font-family:sans-serif;background:#222;color:#fff;padding:20px;text-align:center;">
  <h2>Kênh không tồn tại</h2>
  <p>Mã kênh: ${escapeHtml(channelId)}</p>
  <p><a href="/legacy" style="color:#4da6ff;">Quay lại danh sách</a></p>
</body>
</html>`);
    return;
  }

  const streamUrl = channel.stream_url;
  const isVlcRequest = req.query.player === 'vlc';
  const isNokiaLegacy = deviceInfo.isNokiaS60 || deviceInfo.recommendedView === 'legacy' || req.query.scheme === 'coreplayer';

  if (!isNokiaLegacy || isVlcRequest) {
    // Modern browser / VLC requested
    const vlcUrl = `vlc://${streamUrl}`;
    const m3uUrl = `/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u`;
    const m3u8Url = `/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u8`;
    const androidIntentUrl = `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;end`;
    const iosVlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mở kênh ${escapeHtml(channel.name)} trên VLC Player</title>
  <style type="text/css">
    body { background-color: #0f1117; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 24px 16px; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; box-sizing: border-box; }
    .card { max-width: 520px; width: 100%; background: #181b22; border: 1px solid #2d3340; border-radius: 18px; padding: 26px; box-shadow: 0 16px 36px rgba(0,0,0,0.6); text-align: left; }
    h2 { margin: 6px 0; color: #fb923c; font-size: 20px; text-align: center; }
    .channel-title { color: #f9fafb; font-size: 15px; font-weight: 600; text-align: center; margin-bottom: 12px; }
    .btn { display: block; padding: 12px 18px; border-radius: 10px; font-weight: bold; font-size: 14px; text-decoration: none; margin: 10px 0; transition: 0.2s; text-align: center; }
    .btn-vlc { background: linear-gradient(135deg, #ea580c, #f97316); color: #fff; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4); border: none; }
    .btn-vlc:hover { opacity: 0.95; transform: translateY(-1px); }
    .btn-row { display: flex; gap: 8px; margin: 10px 0; }
    .btn-m3u { flex: 1; background-color: #262b36; color: #e4e4e7; border: 1px solid #3d4554; padding: 10px 12px; font-size: 12px; }
    .btn-m3u:hover { background-color: #353b49; color: #fff; }
    .url-box { background: #0b0c10; color: #4ade80; padding: 10px 12px; border-radius: 8px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 8px 0; border: 1px solid #22c55e33; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .status-msg { font-size: 13px; color: #38bdf8; margin: 12px 0; font-weight: 500; text-align: center; background: #0c4a6e22; padding: 8px; border-radius: 8px; border: 1px solid #0284c744; }
    .guide-box { background: #12151c; border: 1px solid #2b3240; border-radius: 12px; padding: 14px; margin-top: 18px; font-size: 12px; line-height: 1.6; }
    .guide-title { color: #f59e0b; font-weight: 700; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; }
    .guide-step { margin-bottom: 6px; color: #d1d5db; }
    .guide-step strong { color: #fff; }
    .copy-btn { background: #16a34a; color: #fff; border: none; border-radius: 6px; padding: 4px 8px; font-size: 11px; cursor: pointer; white-space: nowrap; }
    .copy-btn:hover { background: #22c55e; }
    .back { color: #9ca3af; text-decoration: none; font-size: 13px; margin-top: 16px; display: block; text-align: center; }
    .back:hover { color: #f3f4f6; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size:38px;text-align:center;margin-bottom:6px;">🎬</div>
    <h2>Mở Kênh Trên VLC Player</h2>
    <div class="channel-title">${escapeHtml(channel.name)}</div>
    
    <div class="status-msg" id="auto-msg">⏳ Đang tự động kết nối ứng dụng VLC trên thiết bị...</div>
    
    <a class="btn btn-vlc" id="vlc-btn" href="${escapeHtml(vlcUrl)}">&#9654; Mở Trực Tiếp Trên Ứng Dụng VLC</a>

    <div class="btn-row">
      <a class="btn btn-m3u" href="${escapeHtml(m3u8Url)}" download>&#128190; Tải file .M3U8</a>
      <a class="btn btn-m3u" href="${escapeHtml(m3uUrl)}" download>&#128190; Tải file .M3U</a>
    </div>

    <div style="font-size:11px;color:#9ca3af;margin-top:10px;">Hoặc copy link luồng dán vào VLC (Media &gt; Open Network Stream hoặc Ctrl + N):</div>
    <div class="url-box">
      <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(streamUrl)}</span>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(streamUrl)}');this.innerText='Đã chép!';">Sao chép</button>
    </div>

    <!-- Hướng dẫn chi tiết khi gặp thông báo mở file tải về -->
    <div class="guide-box">
      <div class="guide-title">
        <span>💡</span> Hướng dẫn khi thấy thông báo lúc mở file:
      </div>
      <div class="guide-step">
        1. <strong>Thông báo "How do you want to open this file?" (Bạn muốn mở tệp bằng cách nào?):</strong>
        <br />&bull; Bấm chọn <strong>VLC Media Player</strong> trong danh sách ứng dụng.
        <br />&bull; Tích vào ô <strong>"Always use this app to open .m3u/.m3u8 files"</strong> (Luôn dùng ứng dụng này) &rarr; Bấm <strong>OK</strong>. Lần sau máy sẽ tự mở ngay!
      </div>
      <div class="guide-step" style="margin-top:8px;">
        2. <strong>Nếu Windows Media Player bật lên và báo lỗi:</strong>
        <br />&bull; Nhấp chuột phải vào file tải về &rarr; Chọn <strong>Open with (Mở bằng)</strong> &rarr; Chọn <strong>VLC media player</strong>.
      </div>
      <div class="guide-step" style="margin-top:8px;">
        3. <strong>Cách nhanh nhất không cần tải file:</strong>
        <br />&bull; Mở VLC &rarr; Bấm phím <strong>Ctrl + N</strong> &rarr; Dán link stream ở trên và bấm <strong>Play</strong>.
      </div>
    </div>

    <a class="back" href="/">&laquo; Quay lại ứng dụng IPTV</a>
  </div>

  <script>
    (function() {
      var ua = (navigator.userAgent || "").toLowerCase();
      var isAndroid = /android/i.test(ua);
      var isIos = /iphone|ipad|ipod/i.test(ua);
      var vlcBtn = document.getElementById("vlc-btn");
      var autoMsg = document.getElementById("auto-msg");

      if (isAndroid) {
        if (vlcBtn) vlcBtn.href = "${androidIntentUrl}";
        setTimeout(function() {
          window.location.href = "${androidIntentUrl}";
          if (autoMsg) autoMsg.innerHTML = "✓ Đã gửi lệnh mở VLC trên Android. Nếu chưa mở, hãy bấm nút ở trên.";
        }, 150);
      } else if (isIos) {
        if (vlcBtn) vlcBtn.href = "${iosVlcUrl}";
        setTimeout(function() {
          window.location.href = "${iosVlcUrl}";
          if (autoMsg) autoMsg.innerHTML = "✓ Đã gửi lệnh mở VLC trên iOS. Nếu chưa mở, hãy bấm nút ở trên.";
        }, 150);
      } else {
        // Desktop: Try hidden iframe
        setTimeout(function() {
          try {
            var ifr = document.createElement("iframe");
            ifr.style.display = "none";
            ifr.src = "${escapeHtml(vlcUrl)}";
            document.body.appendChild(ifr);
          } catch(e) {}
          if (autoMsg) {
            autoMsg.innerHTML = "✓ Hãy bấm nút mở VLC hoặc tải file .m3u/.m3u8 bên dưới.";
          }
        }, 150);
      }
    })();
  </script>
</body>
</html>`);
    return;
  }

  // Nokia E72 / Legacy CorePlayer Flow
  const targetCorePlayerM3u = `/api/channel/${encodeURIComponent(channel.id)}/coreplayer.m3u`;
  const corePlayerSchemeUrl = `coreplayer://${streamUrl}`;

  // Serve XHTML strictly compatible with Nokia BrowserNG and CorePlayer
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta http-equiv="refresh" content="0;url=${escapeHtml(targetCorePlayerM3u)}" />
  <title>Mở ${escapeHtml(channel.name)} trên CorePlayer</title>
  <style type="text/css">
    body { background-color: #1a1a1a; color: #fff; font-family: Arial, sans-serif; text-align: center; padding: 15px; font-size: 13px; }
    .btn { display: inline-block; padding: 10px 14px; background-color: #b33939; color: #fff; text-decoration: none; font-weight: bold; margin: 6px 0; border: 1px solid #ff5252; width: 85%; }
    .btn-green { background-color: #1e7e34; border-color: #28a745; }
    .url { background: #000; color: #00ff66; padding: 8px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 10px 0; }
    .note { color: #f4d35e; font-size: 11px; margin: 8px 0; }
  </style>
</head>
<body>
  <h3>ĐANG KẾT NỐI COREPLAYER S60...</h3>
  <p><strong>${escapeHtml(channel.name)}</strong></p>
  <div class="note">Nokia E72 đang tự động tải và khởi chạy CorePlayer...</div>

  <p><a class="btn btn-green" href="${escapeHtml(targetCorePlayerM3u)}">&#9654; TỰ ĐỘNG KHỞI CHẠY COREPLAYER</a></p>
  <p><a class="btn" href="${escapeHtml(corePlayerSchemeUrl)}">&#9654; MỞ QUA SCHEME COREPLAYER://</a></p>
  <p><a class="btn" style="background:#444;border-color:#666;" href="${escapeHtml(streamUrl)}">&#9654; MỞ STREAM HTTP TRỰC TIẾP</a></p>

  <p style="font-size:11px;">Hoặc copy URL sau dán vào CorePlayer &gt; Open URL:</p>
  <div class="url">${escapeHtml(streamUrl)}</div>
  <p><a href="/legacy/channel/${encodeURIComponent(channel.id)}" style="color:#4da6ff;">&laquo; Quay lại thông tin kênh</a></p>
</body>
</html>`);
});

function escapeHtml(text: string = ''): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default router;
