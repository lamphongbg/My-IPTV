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

  // Nokia E72 / Mobile CorePlayer Flow
  // CorePlayer on Nokia E72 (Symbian S60) CANNOT negotiate modern TLS 1.2/1.3 handshakes!
  // If an https:// URL is loaded, CorePlayer throws: "HTTPS hỗ trợ các thỏa thuận không được".
  // Therefore, ALL stream endpoints for CorePlayer must use plain HTTP ('http://').
  const customHost = (req.query.host as string) || (req.query.ip as string) || '';
  const host = customHost || req.get('host') || '127.0.0.1:3000';
  const proto = 'http'; // CorePlayer requires plain HTTP without SSL/TLS
  const targetCorePlayerM3u = `/api/channel/${encodeURIComponent(channel.id)}/coreplayer.m3u${customHost ? `?host=${encodeURIComponent(customHost)}` : ''}`;
  const e72TsUrl = `/api/channel/${encodeURIComponent(channel.id)}/e72.ts`;
  const absoluteE72TsUrl = `${proto}://${host}${e72TsUrl}`;
  const liveTsUrl = `/api/channel/${encodeURIComponent(channel.id)}/live.ts`;
  const absoluteLiveTsUrl = `${proto}://${host}${liveTsUrl}`;
  const corePlayerSchemeUrl = `coreplayer://${absoluteE72TsUrl}`;
  const vlcLaunchUrl = `/open/${encodeURIComponent(channel.id)}?player=vlc`;

  // Serve XHTML strictly compatible with Nokia BrowserNG, Mobile Browsers and CorePlayer
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Mở ${escapeHtml(channel.name)} trên Nokia E72 / CorePlayer</title>
  <style type="text/css">
    body { background-color: #12141a; color: #f3f4f6; font-family: Arial, sans-serif; text-align: center; padding: 14px 10px; font-size: 13px; line-height: 1.5; }
    .card { max-width: 480px; margin: 0 auto; background: #1c202a; border: 1px solid #2e3547; border-radius: 12px; padding: 16px 12px; text-align: left; }
    h3 { margin: 2px 0 6px 0; color: #f4d35e; text-align: center; font-size: 16px; text-transform: uppercase; }
    .ch-name { font-weight: bold; text-align: center; font-size: 15px; color: #fff; margin-bottom: 12px; }
    .btn { display: block; padding: 10px 12px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 8px 0; text-align: center; font-size: 13px; box-sizing: border-box; }
    .btn-e72 { background-color: #0284c7; color: #fff !important; border: 1px solid #38bdf8; }
    .btn-green { background-color: #1e7e34; color: #fff !important; border: 1px solid #28a745; }
    .btn-vlc { background-color: #ea580c; color: #fff !important; border: 1px solid #f97316; }
    .btn-gray { background-color: #374151; color: #e5e7eb !important; border: 1px solid #4b5563; font-size: 12px; }
    .url { background: #0b0c10; color: #00ff66; padding: 8px 10px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 6px 0; border: 1px solid #22c55e44; border-radius: 6px; }
    .notice-box { background: #1a2233; border: 1px solid #2a4365; border-radius: 8px; padding: 10px; margin: 12px 0; font-size: 12px; color: #cbd5e1; }
    .notice-title { color: #f59e0b; font-weight: bold; margin-bottom: 4px; }
    .alert-box { background: #3b1111; border: 1px solid #ef4444; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 12px; color: #fca5a5; line-height: 1.5; }
    .footer-link { color: #9ca3af; text-decoration: none; font-size: 12px; display: block; text-align: center; margin-top: 12px; }
    .ip-box { background: #111827; border: 1px solid #374151; border-radius: 6px; padding: 8px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="card">
    <h3>KẾT NỐI PHÁT KÊNH TRÊN ĐIỆN THOẠI</h3>
    <div class="ch-name">${escapeHtml(channel.name)}</div>

    <!-- Hướng dẫn xử lý lỗi HTTPS của CorePlayer -->
    <div class="alert-box">
      <strong style="color:#f87171;font-size:13px;">⚠️ KHẮC PHỤC LỖI "HTTPS hỗ trợ các thỏa thuận không được":</strong><br />
      &bull; <strong>Nguyên nhân:</strong> CorePlayer v1.3.6 trên Nokia E72 (Symbian S60) chỉ hỗ trợ <strong>HTTP thường</strong>. Máy không hỗ trợ chuẩn TLS 1.2/1.3 và chứng chỉ bảo mật của HTTPS hiện đại. Khi mở link <code>https://</code>, máy sẽ báo lỗi trên.<br />
      &bull; <strong>Giải pháp:</strong> Luôn dùng link <strong>http://</strong> (chữ thường, không có 's') hoặc tải file M3U đã lọc sạch HTTPS bên dưới.
    </div>

    <!-- Cấu hình IP LAN nếu chạy cùng Wi-Fi -->
    <div class="ip-box">
      <form action="/open/${encodeURIComponent(channel.id)}" method="GET">
        <label style="font-size:11px;color:#cbd5e1;display:block;margin-bottom:4px;font-weight:bold;">
          &#128246; Cấu hình IP máy tính LAN (khi E72 kết nối Wi-Fi nhà):
        </label>
        <div style="display:flex;gap:4px;">
          <input type="text" name="host" value="${escapeHtml(host)}" style="flex:1;padding:6px;font-size:12px;background:#1f2937;color:#fff;border:1px solid #4b5563;border-radius:4px;" placeholder="VD: 192.168.1.15:3000" />
          <input type="submit" value="Cập nhật IP" style="padding:6px 10px;font-size:12px;background:#0284c7;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;" />
        </div>
      </form>
    </div>

    <!-- Nút phát cho E72 và CorePlayer -->
    <a class="btn btn-e72" href="${escapeHtml(e72TsUrl)}">&#9654; XEM TRÊN NOKIA E72 (QVGA 320x240 MƯỢT NHẸ)</a>
    <a class="btn btn-green" href="${escapeHtml(targetCorePlayerM3u)}">&#128190; TẢI FILE .M3U CHO COREPLAYER (CHUẨN HTTP - KHÔNG LỖI SSL)</a>

    <!-- Nút cho smartphone -->
    <a class="btn btn-vlc" href="${escapeHtml(vlcLaunchUrl)}">&#9654; XEM TRÊN VLC PLAYER (CHO ANDROID / IPHONE)</a>

    <div class="notice-box">
      <div class="notice-title">&#128225; HƯỚNG DẪN XEM TRÊN NOKIA E72:</div>
      <div>
        <strong>Cách 1 (Nhanh nhất - Nhập URL trực tiếp):</strong><br />
        1. Mở ứng dụng <strong>CorePlayer</strong> trên E72.<br />
        2. Bấm <strong>Menu (Phím chọn trái) &gt; Open URL (Mở URL)</strong>.<br />
        3. Điền đường link sau (chú ý là <strong>http://</strong>, không dùng https):
        <div class="url">${escapeHtml(absoluteE72TsUrl)}</div>
        <em>(Luồng này đã được chuyển mã xuống 320x240 H.264 Baseline L1.3 và AAC 64k, CPU E72 chạy mát và mượt mà 100%).</em><br /><br />
        <strong>Cách 2 (Mở bằng file .M3U):</strong><br />
        &bull; Bấm nút <strong>"Tải file .M3U cho CorePlayer"</strong> ở trên.<br />
        &bull; Mở trình quản lý file trên E72 &gt; Chọn file vừa tải &gt; Mở bằng <strong>CorePlayer</strong>.<br /><br />
        <strong>Mẹo chỉnh CorePlayer tối ưu cho E72:</strong><br />
        Vào <strong>Menu &gt; Tools &gt; Preferences &gt; Video</strong> &gt; Mục <strong>Video Output</strong> chọn <strong>DirectDraw</strong> hoặc <strong>Symbian Screen</strong> để hình ảnh không bị giật.
      </div>
    </div>

    <div style="font-size:11px;color:#9ca3af;margin-top:6px;">Link luồng MPEG-TS gốc (HTTP không nén lại):</div>
    <div class="url" style="color:#38bdf8;border-color:#0284c744;">${escapeHtml(absoluteLiveTsUrl)}</div>

    <a class="footer-link" href="/legacy/channel/${encodeURIComponent(channel.id)}">&laquo; Quay lại thông tin kênh</a>
    <a class="footer-link" href="/">&laquo; Quay lại giao diện chính</a>
  </div>
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
