#!/usr/bin/env python3
"""
Nokia E72 / CorePlayer Local HTTP Bridge
----------------------------------------
Giúp Nokia E72 xem IPTV từ máy chủ đám mây bằng cách chuyển tiếp qua HTTP nội bộ,
giải quyết triệt để lỗi "HTTPS hỗ trợ các thỏa thuận không được" của CorePlayer trên Symbian S60.

Cách dùng:
1. Chạy trên máy tính (cùng Wi-Fi với Nokia E72):
   python e72-relay.py
2. Trên CorePlayer hoặc trình duyệt Nokia E72, truy cập:
   http://[IP-Máy-Tính]:8080/legacy
"""

import sys
import http.server
import socketserver
import urllib.request
import ssl

PORT = 8080
CLOUD_TARGET = "https://ais-dev-c4xf2q52rkplywbg5rqr5q-1023530037977.asia-southeast1.run.app"

# Bo qua kiem tra SSL nghiem ngat cho CorePlayer
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class CorePlayerRelayHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        target_url = CLOUD_TARGET + self.path
        try:
            req = urllib.request.Request(
                target_url,
                headers={"User-Agent": "NokiaE72/CorePlayer-Relay"}
            )
            with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
                self.send_response(response.status)
                for header, value in response.getheaders():
                    if header.lower() not in ['transfer-encoding', 'content-encoding']:
                        self.send_header(header, value)
                self.end_headers()
                
                # Stream binary content (MPEG-TS chunks or M3U text)
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    self.wfile.flush()
        except Exception as e:
            self.send_response(502)
            self.end_headers()
            self.wfile.write(f"Relay Error: {e}".encode('utf-8'))

    def log_message(self, format, *args):
        print(f"[E72 Relay] {args[0]} - {args[1]} -> {args[2]}")

if __name__ == '__main__':
    print("=" * 60)
    print(f" NOKIA E72 COREPLAYER HTTP RELAY SERVER DANG CHAY")
    print(f" Cong ket noi HTTP: {PORT}")
    print(f" Dich den Cloud:    {CLOUD_TARGET}")
    print(f" Mo tren Nokia E72: http://[IP-MAY-TINH]:{PORT}/legacy")
    print("=" * 60)
    with socketserver.TCPServer(("", PORT), CorePlayerRelayHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nDa dung Relay.")
