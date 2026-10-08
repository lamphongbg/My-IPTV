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
  const useScheme = req.query.scheme === 'coreplayer';
  const targetUrl = useScheme ? `coreplayer://${streamUrl}` : streamUrl;

  // Set headers
  res.setHeader('Location', targetUrl);
  res.status(302);

  // Fallback body if client does not follow 302 automatically
  res.send(`<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta http-equiv="refresh" content="1;url=${escapeHtml(targetUrl)}" />
  <title>Đang mở ${escapeHtml(channel.name)}...</title>
  <style type="text/css">
    body { background-color: #1a1a1a; color: #fff; font-family: Arial, sans-serif; text-align: center; padding: 20px; font-size: 13px; }
    .btn { display: inline-block; padding: 10px 16px; background-color: #b33939; color: #fff; text-decoration: none; font-weight: bold; margin: 10px 0; border: 1px solid #ff5252; }
    .url { background: #000; color: #00ff66; padding: 8px; font-family: monospace; font-size: 11px; word-break: break-all; margin: 10px 0; }
  </style>
</head>
<body>
  <h3>Đang chuyển hướng tới luồng phát...</h3>
  <p><strong>${escapeHtml(channel.name)}</strong></p>
  <p>Nếu CorePlayer hoặc trình duyệt không tự mở, hãy bấm nút bên dưới:</p>
  <p><a class="btn" href="${escapeHtml(targetUrl)}">&#9654; MỞ STREAM NGAY</a></p>
  <p>Hoặc copy URL sau vào CorePlayer &gt; Open URL:</p>
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
