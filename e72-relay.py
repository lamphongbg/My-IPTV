#!/usr/bin/env python3
"""
Nokia E72 / CorePlayer Local HTTP Bridge
----------------------------------------
Giúp Nokia E72 xem IPTV từ máy chủ đám mây bằng cách chuyển tiếp qua HTTP nội bộ,
giải quyết triệt để lỗi "HTTPS hỗ trợ các thỏa thuận không được" của CorePlayer trên Symbian S60.

Cách dùng:
1. Chạy trên máy tính (cùng Wi-Fi với Nokia E72):
   python e72-relay.py
2. Trên Opera Mini của Nokia E72, truy cập:
   http://[IP-Máy-Tính]:8080/legacy
3. Trên CorePlayer (Menu > Open URL), nhập trực tiếp:
   http://[IP-Máy-Tính]:8080/c/1
"""

import sys
import socket
import http.server
import socketserver
import urllib.request
import ssl

DEFAULT_PORT = 8080
DEFAULT_TARGET = "https://my-iptv-uguq.onrender.com"

# Lấy cổng và máy chủ đích từ dòng lệnh nếu có: python e72-relay.py [target_url] [port]
TARGET = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].startswith("http") else DEFAULT_TARGET
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else (int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else DEFAULT_PORT)

# Tự động tìm IP máy tính trong mạng Wi-Fi LAN
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

LOCAL_IP = get_local_ip()

# Bỏ qua kiểm tra chứng chỉ SSL nghiêm ngặt cho CorePlayer
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

class CorePlayerRelayHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_HEAD(self):
        self.handle_proxy(is_head=True)

    def do_GET(self):
        self.handle_proxy(is_head=False)

    def handle_proxy(self, is_head=False):
        target_url = TARGET.rstrip('/') + self.path
        try:
            req_headers = {
                "User-Agent": "NokiaE72/CorePlayer-Relay (Symbian S60)",
                "X-Custom-Host": f"{LOCAL_IP}:{PORT}",
                "Accept": "*/*",
            }
            if "Range" in self.headers:
                req_headers["Range"] = self.headers["Range"]

            req = urllib.request.Request(target_url, headers=req_headers)
            with urllib.request.urlopen(req, context=ctx, timeout=30) as response:
                self.send_response(response.status)
                for header, value in response.getheaders():
                    if header.lower() not in ['transfer-encoding', 'content-encoding', 'connection']:
                        self.send_header(header, value)
                self.send_header("Connection", "close")
                self.end_headers()

                if is_head:
                    return

                # Stream binary content (MPEG-TS chunks or M3U/PLS text)
                while True:
                    chunk = response.read(65536)
                    if not chunk:
                        break
                    try:
                        self.wfile.write(chunk)
                        self.wfile.flush()
                    except (BrokenPipeError, ConnectionResetError):
                        break
        except Exception as e:
            try:
                self.send_response(502)
                self.end_headers()
                self.wfile.write(f"Relay Error: {e}".encode('utf-8'))
            except Exception:
                pass

    def log_message(self, format, *args):
        # In nhật ký truy cập ngắn gọn
        print(f"[E72 Relay] {self.client_address[0]} -> {self.command} {self.path} ({args[1] if len(args) > 1 else ''})")

if __name__ == '__main__':
    print("=" * 65)
    print(" 📡 NOKIA E72 & COREPLAYER HTTP BRIDGE (RELAY GATEWAY)")
    print("=" * 65)
    print(f" * IP MÁY TÍNH (LAN WI-FI):   {LOCAL_IP}")
    print(f" * CỔNG HTTP:                  {PORT}")
    print(f" * MÁY CHỦ IPTV ĐÍCH:         {TARGET}")
    print("-" * 65)
    print(" 👉 TRÊN OPERA MINI CỦA NOKIA E72, TRUY CẬP:")
    print(f"    http://{LOCAL_IP}:{PORT}/legacy")
    print("-" * 65)
    print(" 👉 TRÊN COREPLAYER (MENU > OPEN URL), NHẬP LINK NGẮN:")
    print(f"    Kênh 1 (VTV1): http://{LOCAL_IP}:{PORT}/c/1")
    print(f"    Kênh 2 (VTV2): http://{LOCAL_IP}:{PORT}/c/2")
    print(f"    Kênh 3 (VTV3): http://{LOCAL_IP}:{PORT}/c/3")
    print("-" * 65)
    print(" 👉 TẢI PLAYLIST M3U/PLS TOÀN BỘ KÊNH CHO COREPLAYER:")
    print(f"    http://{LOCAL_IP}:{PORT}/api/channels/e72.m3u")
    print(f"    http://{LOCAL_IP}:{PORT}/api/channels/e72.pls")
    print("=" * 65)
    print(" Đang chờ kết nối từ Nokia E72... (Bấm Ctrl+C để dừng)")

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), CorePlayerRelayHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nĐã dừng Relay Server.")
