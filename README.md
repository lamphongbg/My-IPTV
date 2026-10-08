# MY IPTV - Universal Personal IPTV Web Viewer & Playlist Manager

Ứng dụng web IPTV cá nhân đa nền tảng với kiến trúc **Dual-Target Responsive & Progressive Enhancement**, tích hợp **Quản lý Playlist M3U, Trang Quản Trị Bảo Mật (Admin Portal), và Kết Nối Cơ Sở Dữ Liệu Bền Vững (PostgreSQL / Local Persistent Storage)**.

Đặc biệt tối ưu hóa để hoạt động hoàn hảo trên **Nokia E72 (Symbian S60 3rd Edition / CorePlayer)**, đồng thời mang lại trải nghiệm xem hiện đại trên **Điện thoại thông minh (iOS/Android)** và **Máy tính (Desktop)**.

---

## 1. KIẾN TRÚC HỆ THỐNG

```
                          ┌────────────────────────┐
                          │   M3U IPTV Sources     │
                          │   (URLs, Files, Text)  │
                          └───────────┬────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │   PostgreSQL / SQLite  │
                          │   / Local JSON Storage │
                          │   (Playlists, Channels)│
                          └───────────┬────────────┘
                                      │
                                      ▼
                          ┌────────────────────────┐
                          │  Node.js / Express     │
                          │  Backend Service       │
                          │  - M3U Sync Engine     │
                          │  - Stream Probe        │
                          │  - Admin Auth (HMAC)   │
                          │  - Device Detector     │
                          └───────────┬────────────┘
                                      │
       ┌──────────────────────────────┼──────────────────────────────┐
       │                              │                              │
       ▼                              ▼                              ▼
[ Nokia E72 / Symbian S60 ]    [ Smartphone & Desktop ]       [ Trang Quản Trị ]
       │                              │                              │
       ▼                              ▼                              ▼
Server-Rendered HTML (<12KB)   React 19 Dashboard             /admin Portal
0 JavaScript bắt buộc          HLS.js / Native Video          Quản lý Playlist
Phím D-Pad thân thiện          Kênh Yêu thích & Gần đây       Quản lý Kênh (CRUD)
       │                              │                              │
       ▼                              ▼                              ▼
[ Mở CorePlayer / URL ]        [ Xem Trực Tiếp / HLS ]        [ Test Stream Probe ]
Chuyển tiếp 302 trực tiếp      VLC / PotPlayer Fallback       Đo HTTP, SSL, Latency
```

---

## 2. CÁC TÍNH NĂNG MỚI ĐÃ BỔ SUNG

### 1. Quản lý Playlist M3U Đa Nguồn:
* **Hỗ trợ nhiều playlist cùng lúc:** Thêm, sửa, xóa, bật/tắt (ON/OFF) từng playlist.
* **3 phương thức nạp playlist:**
  1. **Đường dẫn URL trực tuyến:** Tự động tải từ máy chủ IPTV từ xa qua HTTP/HTTPS.
  2. **Dán trực tiếp nội dung M3U:** Dán chuỗi thô `#EXTM3U` vào khung nhập.
  3. **Tải lên tệp `.m3u` / `.m3u8`:** Chọn file từ máy tính/điện thoại qua trình duyệt.
* **Parser M3U nâng cao:** Trích xuất đầy đủ `tvg-id`, `tvg-name`, `group-title`, `tvg-logo`, tên kênh, và **giữ nguyên 100% tham số URL, token, signature của stream**.
* **Xử lý lỗi cách ly (Fault-tolerant):** Nếu một playlist bị lỗi (link chết, server timeout), hệ thống chỉ đánh dấu trạng thái lỗi cho riêng playlist đó và **không làm gián đoạn các playlist khác hay làm crash website**.
* **Nút `[ Refresh All Playlists ]`:** Cập nhật đồng loạt tất cả playlist đang bật chỉ với 1 cú click.

### 2. Trang Quản Trị Bảo Mật (`/admin`):
* **Bảo vệ xác thực đa lớp:** Sử dụng token HMAC SHA-256 an toàn, thời hạn 24h, cơ chế chống tấn công dò thời gian (`timingSafeEqual`).
* **Không lưu mật khẩu plain-text** trong mã nguồn; mật khẩu được đọc từ biến môi trường `ADMIN_USERNAME` và `ADMIN_PASSWORD`.
* **Quản lý danh sách kênh (Channel CRUD):**
  * Tìm kiếm tức thì theo tên kênh, nhóm, `tvg-id`, hoặc URL stream.
  * Thêm kênh thủ công hoặc chỉnh sửa thông số kênh (Tên, Thể loại, Logo, URL, Codec, Trạng thái).
  * Xóa kênh không mong muốn.
* **Kiểm tra luồng phát (Test Stream Probe):**
  * Kiểm tra phản hồi trực tiếp của URL (HTTP status 200/206, Content-Type, SSL HTTPS, độ trễ ms) bằng phương thức thăm dò nhẹ (`HEAD` / HTTP Range request).
  * **Không proxy video qua Render:** Không tải luồng về server giúp tiết kiệm băng thông và tài nguyên.

### 3. Lưu trữ Dữ liệu Bền Vững (Hybrid Persistence):
* **Hỗ trợ PostgreSQL tự động:** Khi biến môi trường `DATABASE_URL` được cấu hình (ví dụ trên Render PostgreSQL), hệ thống tự động khởi tạo bảng (`playlists`, `channels`) và lưu trữ vĩnh viễn trên cơ sở dữ liệu.
* **Fallback cục bộ thông minh:** Nếu không có PostgreSQL, hệ thống tự động sử dụng bộ nhớ file JSON tại `/data/` với cơ chế tự động nạp dữ liệu ban đầu (auto-seed) để chạy ngay lập tức.

---

## 3. CẤU HÌNH BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

| Tên biến | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :---: | :--- |
| `PORT` | Không | `3000` | Cổng dịch vụ (Render tự động cung cấp) |
| `NODE_ENV` | Không | `development` | Đặt `production` khi triển khai |
| `ADMIN_USERNAME` | Khuyến nghị | `admin` | Tên đăng nhập trang quản trị `/admin` |
| `ADMIN_PASSWORD` | **Khuyến nghị** | `admin123` | Mật khẩu quản trị (cần đổi khi deploy) |
| `ADMIN_SECRET` | Tùy chọn | `random-salt` | Khóa ký phiên HMAC cho token Admin |
| `DATABASE_URL` | Tùy chọn | `""` | Chuỗi kết nối PostgreSQL (Render tự điền khi dùng Blueprint) |

---

## 4. HƯỚNG DẪN CHẠY LOCAL (DEVELOPMENT)

```bash
# 1. Cài đặt thư viện
npm install

# 2. Khởi chạy chế độ phát triển
npm run dev

# 3. Mở trình duyệt:
# - Giao diện chính: http://localhost:3000
# - Trang quản trị Admin: http://localhost:3000/admin (User: admin / Pass: admin123)
# - Giao diện Nokia E72: http://localhost:3000/legacy
# - Kiểm tra Health Check: http://localhost:3000/health
# - Tải Playlist M3U: http://localhost:3000/playlist.m3u
```

---

## 5. HƯỚNG DẪN ĐƯA DỰ ÁN LÊN GITHUB

```bash
# Khởi tạo git repository
git init

# Thêm tất cả file mã nguồn
git add .

# Tạo commit
git commit -m "feat: complete IPTV with M3U playlist manager, admin portal, and postgres support"

# Đổi nhánh sang main
git branch -M main

# Kết nối kho lưu trữ GitHub của bạn
git remote add origin https://github.com/YOUR_USERNAME/my-iptv.git

# Đẩy mã nguồn lên GitHub
git push -u origin main
```

---

## 6. HƯỚNG DẪN TRIỂN KHAI TRÊN RENDER

### Cách 1: Sử dụng Render Blueprint (Bao gồm Web Service + PostgreSQL Database)
1. Đăng nhập vào [Render.com](https://render.com).
2. Nhấn nút **New + &gt; Blueprint**.
3. Chọn kho lưu trữ GitHub `my-iptv` bạn vừa đẩy lên.
4. Render sẽ tự động đọc tệp `render.yaml` và tạo 2 dịch vụ:
   * **Database:** `my-iptv-db` (PostgreSQL miễn phí).
   * **Web Service:** `my-iptv` (Node.js).
5. Render tự động nối `DATABASE_URL` giữa Database và Web Service, đồng thời tạo mật khẩu ngẫu nhiên an toàn cho `ADMIN_PASSWORD`.
6. Nhấn **Apply**. Sau khoảng 2 phút, hệ thống sẽ sẵn sàng hoạt động tại `https://my-iptv.onrender.com`.

### Cách 2: Tạo Web Service Độc Lập (Không cần Database)
1. Nhấn **New + &gt; Web Service** trên Render.
2. Kết nối tới repository `my-iptv`.
3. Điền các cấu hình:
   * **Name:** `my-iptv`
   * **Region:** `Singapore`
   * **Build Command:** `npm install && npm run build`
   * **Start Command:** `npm start`
4. Trong phần **Environment Variables**, thêm:
   * `NODE_ENV`: `production`
   * `ADMIN_USERNAME`: `admin`
   * `ADMIN_PASSWORD`: `<mật_khẩu_bí_mật_của_bạn>`
5. Nhấn **Deploy Web Service**.

---

## 7. HƯỚNG DẪN VẬN HÀNH TRÊN NOKIA E72 & COREPLAYER

1. Mở trình duyệt web của Nokia E72 (hoặc Opera Mini).
2. Nhập URL trang web: `http://ten-app-cua-ban.onrender.com` (hệ thống tự động phát hiện E72 và chuyển tới giao diện siêu nhẹ).
3. **Mở qua CorePlayer:**
   * Chọn kênh trong danh sách.
   * Nhấn nút **`[ MỞ BẰNG COREPLAYER ]`** (đường dẫn `/open/:channelId` sẽ tự động chuyển tiếp tới URL stream).
   * **Phương án thủ công chuẩn xác:** Sao chép chuỗi URL stream màu xanh lá cây trên màn hình &gt; Mở **CorePlayer** &gt; **Menu &gt; Open URL...** &gt; Dán (Paste) và bấm **OK**.

---

## 8. DANH SÁCH NHỮNG VIỆC CẦN CẤU HÌNH THỦ CÔNG

Sau khi đẩy mã nguồn lên GitHub và triển khai trên Render, bạn cần thực hiện các bước sau:

1. **Trên GitHub:**
   * Tạo một repository mới ở chế độ **Public** hoặc **Private**.
   * Đảm bảo không commit file `.env` chứa mật khẩu thật (file `.gitignore` đã được cấu hình sẵn).

2. **Trên Render:**
   * **Kiểm tra Health Check:** Sau khi deploy, truy cập `https://<ten-app>.onrender.com/health` để xác nhận trạng thái `{"status": "ok"}`.
   * **Đăng nhập Admin:** Truy cập `https://<ten-app>.onrender.com/admin` bằng tài khoản bạn đã cấu hình trong Environment Variables để thêm các URL playlist IPTV yêu thích của mình.
   * **Cập nhật Playlist:** Bấm **"Refresh All Playlists"** để hệ thống tự động tải và đồng bộ hóa danh sách kênh.
