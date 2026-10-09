#!/usr/bin/env node
/**
 * Nokia E72 / CorePlayer Local HTTP Bridge (Node.js version)
 * Chạy trên máy tính để chuyển tiếp IPTV từ Render HTTPS sang HTTP cho Nokia E72
 */

import http from 'http';
import https from 'https';
import os from 'os';

const DEFAULT_PORT = 8080;
const DEFAULT_TARGET = 'https://my-iptv-uguq.onrender.com';

const args = process.argv.slice(2);
const TARGET = (args[0] && args[0].startsWith('http')) ? args[0] : DEFAULT_TARGET;
const PORT = (args[1] && !isNaN(Number(args[1]))) ? Number(args[1]) : (args[0] && !isNaN(Number(args[0])) ? Number(args[0]) : DEFAULT_PORT);

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const LOCAL_IP = getLocalIp();

const agent = new https.Agent({
  rejectUnauthorized: false
});

const server = http.createServer((req, res) => {
  const targetUrl = new URL(req.url || '/', TARGET);

  const proxyReq = https.request(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: targetUrl.host,
      'user-agent': req.headers['user-agent'] || 'CorePlayer/1.36.7383 (SymbianOS)'
    },
    agent
  }, (proxyRes) => {
    // Modify Location header in redirects
    const headers = { ...proxyRes.headers };
    if (headers.location && headers.location.startsWith(TARGET)) {
      headers.location = headers.location.replace(TARGET, `http://${req.headers.host || `${LOCAL_IP}:${PORT}`}`);
    }

    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[-] Lỗi kết nối: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Lỗi kết nối tới máy chủ IPTV: ${err.message}`);
    }
  });

  req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(70));
  console.log('     NOKIA E72 / COREPLAYER 3.36 LOCAL HTTP BRIDGE (NODE.JS)');
  console.log('='.repeat(70));
  console.log(`[+] Đang chuyển tiếp từ : ${TARGET}`);
  console.log(`[+] IP máy tính trong Wi-Fi: ${LOCAL_IP}`);
  console.log(`[+] Cổng lắng nghe      : ${PORT}`);
  console.log(`[+] Địa chỉ HTTP nội bộ : http://${LOCAL_IP}:${PORT}`);
  console.log('-'.repeat(70));
  console.log('HƯỚNG DẪN XEM TRÊN NOKIA E72 (CÙNG WI-FI):');
  console.log(` 1. Trên Opera Mini: Vào địa chỉ: http://${LOCAL_IP}:${PORT}/legacy`);
  console.log(` 2. Trên CorePlayer 3.36 (Menu > Open URL): Nhập:`);
  console.log(`    - VTV1 : http://${LOCAL_IP}:${PORT}/c/1`);
  console.log(`    - VTV2 : http://${LOCAL_IP}:${PORT}/c/2`);
  console.log(`    - VTV3 : http://${LOCAL_IP}:${PORT}/c/3`);
  console.log('='.repeat(70));
});
