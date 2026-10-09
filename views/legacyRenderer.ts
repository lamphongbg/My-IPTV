import type { Channel } from '../src/types/iptv.js';

function escapeHtml(text: string = ''): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LEGACY_CSS = `
  body {
    background-color: #12141a;
    color: #e5e7eb;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    margin: 0;
    padding: 6px;
  }
  a {
    color: #38bdf8;
    text-decoration: underline;
  }
  a:focus, a:hover, a:active {
    background-color: #ffd700 !important;
    color: #000000 !important;
    outline: 2px solid #ffffff;
  }
  .detect-banner {
    background-color: #14532d;
    color: #86efac;
    padding: 5px 8px;
    font-size: 11px;
    text-align: center;
    border: 1px solid #22c55e;
    margin-bottom: 6px;
    font-weight: bold;
    border-radius: 4px;
  }
  .opera-banner {
    background-color: #451a03;
    color: #fed7aa;
    padding: 6px 8px;
    font-size: 12px;
    border: 1px solid #f97316;
    margin-bottom: 8px;
    border-radius: 6px;
    line-height: 1.5;
  }
  .header {
    background-color: #0f2b48;
    color: #ffffff;
    padding: 8px 6px;
    text-align: center;
    border-bottom: 2px solid #f59e0b;
    margin-bottom: 8px;
  }
  .header h1 {
    font-size: 16px;
    margin: 0 0 4px 0;
    text-transform: uppercase;
    color: #f59e0b;
  }
  .search-panel {
    background-color: #1e2430;
    border: 1px solid #334155;
    padding: 8px 6px;
    margin-bottom: 8px;
    border-radius: 6px;
  }
  .form-group {
    margin-bottom: 6px;
  }
  .form-label {
    display: block;
    font-size: 12px;
    font-weight: bold;
    color: #f59e0b;
    margin-bottom: 2px;
  }
  .input-text, .select-box {
    width: 96%;
    padding: 5px;
    font-size: 13px;
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #999999;
    box-sizing: border-box;
    display: block;
    border-radius: 4px;
  }
  .btn-search {
    width: 96%;
    padding: 6px 10px;
    font-size: 13px;
    background-color: #f59e0b;
    color: #000000;
    font-weight: bold;
    border: 1px solid #000000;
    cursor: pointer;
    margin-top: 4px;
    display: block;
    text-align: center;
    border-radius: 4px;
  }
  .filter-status {
    background-color: #1e293b;
    border: 1px solid #334155;
    padding: 5px 8px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #93c5fd;
    border-radius: 4px;
  }
  .channel-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .channel-item {
    background-color: #1c2230;
    border-bottom: 1px solid #2d3748;
    padding: 8px 6px;
    margin-bottom: 5px;
    border-radius: 6px;
  }
  .channel-link {
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    text-decoration: none;
    display: block;
    margin-bottom: 3px;
  }
  .channel-group-tag {
    display: inline-block;
    background-color: #0f2b48;
    color: #f59e0b;
    font-size: 11px;
    padding: 1px 5px;
    margin-right: 4px;
    border-radius: 3px;
    border: 1px solid #1e3a8a;
  }
  .btn {
    display: inline-block;
    padding: 6px 8px;
    margin: 3px 2px;
    background-color: #1e293b;
    color: #ffffff !important;
    text-decoration: none;
    border: 1px solid #475569;
    font-weight: bold;
    font-size: 12px;
    text-align: center;
    border-radius: 4px;
  }
  .btn-coreplayer {
    background-color: #15803d !important;
    border: 1px solid #22c55e !important;
    color: #ffffff !important;
    font-size: 13px;
    font-weight: bold;
    padding: 7px 10px;
    display: block;
    text-align: center;
    margin: 4px 0;
    border-radius: 6px;
  }
  .btn-res {
    display: inline-block;
    padding: 4px 7px;
    margin: 2px;
    font-size: 11px;
    font-weight: bold;
    text-decoration: none;
    border-radius: 4px;
  }
  .btn-res-active {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: 1px solid #60a5fa;
  }
  .btn-res-inactive {
    background-color: #1f2937 !important;
    color: #93c5fd !important;
    border: 1px solid #374151;
  }
  .pagination {
    text-align: center;
    padding: 8px 0;
    margin-top: 8px;
    border-top: 1px dashed #475569;
  }
  .pagination a, .pagination span {
    padding: 4px 8px;
    margin: 0 2px;
    display: inline-block;
    background-color: #1e293b;
    border: 1px solid #475569;
    font-size: 12px;
    border-radius: 4px;
  }
  .pagination span.current {
    background-color: #f59e0b;
    color: #000;
    font-weight: bold;
  }
  .box {
    background-color: #1a202c;
    border: 1px solid #334155;
    padding: 8px;
    margin-bottom: 8px;
    border-radius: 6px;
  }
  .url-box {
    background-color: #000000;
    color: #00ff66;
    padding: 6px;
    font-family: Courier New, monospace;
    font-size: 11px;
    word-break: break-all;
    border: 1px solid #22c55e44;
    margin: 6px 0;
    border-radius: 4px;
  }
  .guide-step {
    margin-bottom: 5px;
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.5;
  }
  .footer {
    text-align: center;
    padding: 10px 4px;
    margin-top: 12px;
    border-top: 1px solid #334155;
    font-size: 11px;
    color: #94a3b8;
  }
  .footer a {
    color: #cbd5e1;
  }
`;

export function renderLegacyHome(options: {
  channels: Channel[];
  totalChannels: number;
  currentPage: number;
  totalPages: number;
  currentGroup: string;
  groups: string[];
  searchQuery?: string;
  host?: string;
  resChoice?: string;
  isOperaMini?: boolean;
}): string {
  const {
    channels,
    totalChannels,
    currentPage,
    totalPages,
    currentGroup,
    groups,
    searchQuery = '',
    host = '',
    resChoice = '240p',
    isOperaMini = false,
  } = options;

  const effectiveRes = (resChoice || '240p').toLowerCase();

  // Sort groups smartly: Put prominent standard groups first, then alphabetize the rest
  const priorityGroups = ['VTV', 'VTC', 'HTV', 'Tin tức', 'Thể thao', 'Giải trí', 'Khoa học', 'Quốc tế', 'Phim', 'Movies', 'News', 'Sports'];
  const sortedGroups = [...groups].sort((a, b) => {
    const pA = priorityGroups.indexOf(a);
    const pB = priorityGroups.indexOf(b);
    if (pA !== -1 && pB !== -1) return pA - pB;
    if (pA !== -1) return -1;
    if (pB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Build the dropdown options for groups
  let optionsHtml = `<option value="all"${currentGroup === 'all' ? ' selected="selected"' : ''}>-- Tất cả nhóm (${totalChannels} kênh) --</option>`;
  for (const g of sortedGroups) {
    const isSelected = currentGroup.toLowerCase() === g.toLowerCase();
    optionsHtml += `<option value="${escapeHtml(g)}"${isSelected ? ' selected="selected"' : ''}>${escapeHtml(g)}</option>`;
  }

  const hostQueryParam = host ? `&host=${encodeURIComponent(host)}` : '';
  const hostParamOnly = host ? `?host=${encodeURIComponent(host)}` : '';
  const resParam = `&res=${encodeURIComponent(effectiveRes)}`;
  const fullQueryParams = `?res=${encodeURIComponent(effectiveRes)}${hostQueryParam}`;
  const displayHost = host || '192.168.1.xxx:3000';

  // Channel items
  let channelItems = '';
  if (channels.length === 0) {
    channelItems = '<li class="channel-item" style="text-align:center;padding:16px;">Không tìm thấy kênh nào phù hợp với bộ lọc.</li>';
  } else {
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const indexNum = (currentPage - 1) * 12 + i + 1;
      const chCorePlayerM3u = `/c/${indexNum}.m3u?res=${effectiveRes}${hostQueryParam}`;
      const chCorePlayerPls = `/c/${indexNum}.pls?res=${effectiveRes}${hostQueryParam}`;
      const chDetailUrl = `/legacy/channel/${encodeURIComponent(ch.id)}?res=${effectiveRes}${hostQueryParam}`;
      const chDirectTsUrl = `/c/${indexNum}?res=${effectiveRes}${hostQueryParam}`;
      const shortUrl = `http://${displayHost}/c/${indexNum}`;

      channelItems += `
        <li class="channel-item">
          <div style="margin-bottom:3px;">
            <a class="channel-link" href="${chDetailUrl}">
              ${indexNum}. ${escapeHtml(ch.name)}
            </a>
          </div>
          <div style="margin-bottom:6px;">
            <span class="channel-group-tag">${escapeHtml(ch.group)}</span>
            <span style="font-size:11px;color:#94a3b8;">${escapeHtml(ch.resolution || 'HD')} &bull; ${effectiveRes.toUpperCase()}</span>
          </div>

          <!-- Nút kích hoạt CorePlayer trực tiếp qua Opera Mini (Tải M3U) -->
          <div>
            <a class="btn-coreplayer" href="${chCorePlayerM3u}">
              &#9654; Mở Bằng CorePlayer (Tải M3U)
            </a>
            <div style="font-size:10px;color:#86efac;text-align:center;margin-top:2px;">
              (Bấm "Mở" khi Opera Mini hỏi để xem ngay)
            </div>
          </div>

          <div style="margin-top:4px;">
            <a class="btn" style="background-color:#1e3a8a;border-color:#3b82f6;" href="${chCorePlayerPls}">&#128251; File .PLS</a>
            <a class="btn" style="background-color:#334155;border-color:#475569;" href="${chDirectTsUrl}">&#128246; Luồng .TS</a>
            <a class="btn" style="background-color:#0284c7;border-color:#38bdf8;" href="${chDetailUrl}">&#128250; Chi tiết</a>
          </div>

          <div style="font-size:10px;color:#94a3b8;margin-top:4px;">
            Link CorePlayer: <code style="color:#4ade80;">${shortUrl}</code>
          </div>
        </li>
      `;
    }
  }

  // Pagination
  let paginationHtml = '<div class="pagination">';
  if (currentPage > 1) {
    paginationHtml += `<a href="/legacy?page=${currentPage - 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}${resParam}${hostQueryParam}">&laquo; Trang trước</a>`;
  }
  paginationHtml += ` <span class="current">Trang ${currentPage}/${totalPages}</span> `;
  if (currentPage < totalPages) {
    paginationHtml += `<a href="/legacy?page=${currentPage + 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}${resParam}${hostQueryParam}">Trang sau &raquo;</a>`;
  }
  paginationHtml += '</div>';

  const isFiltering = currentGroup !== 'all' || Boolean(searchQuery.trim());

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>MY IPTV - Nokia E72 / Opera Mini &amp; CorePlayer</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <!-- BANNER NHẬN DIỆN OPERA MINI & NOKIA E72 -->
  <div class="detect-banner">
    &#10003; THIẾT BỊ: NOKIA E72 (SYMBIAN S60v3 FP2) - CHUẨN QVGA 320x240
  </div>

  ${isOperaMini ? `
  <div class="opera-banner">
    <strong style="color:#fdba74;font-size:13px;">📱 ĐÃ KẾT NỐI QUA TRÌNH DUYỆT OPERA MINI</strong><br />
    &bull; <strong>Cách phát kênh bằng CorePlayer:</strong> Nhấn nút xanh <b>[ ▶ Mở CorePlayer (M3U) ]</b> &rarr; Khi Opera Mini hỏi <em>"Tải về / Mở"</em>, hãy bấm <b>"Mở" (Open)</b>.<br />
    &bull; Ứng dụng <strong>CorePlayer 1.36</strong> sẽ tự động khởi động và giải mã luồng truyền hình mượt mà!
  </div>` : ''}

  <div class="header">
    <h1>MY IPTV CHO NOKIA E72</h1>
    <div style="font-size:11px;color:#cbd5e1;">Tương thích Opera Mini &amp; CorePlayer Mobile 1.36</div>
  </div>

  <!-- THANH CHỌN ĐỘ PHÂN GIẢI CHO COREPLAYER -->
  <div class="box" style="background:#172554;border-color:#2563eb;text-align:center;">
    <div style="font-weight:bold;color:#60a5fa;margin-bottom:4px;font-size:12px;">
      ⚡ CHỌN ĐỘ PHÂN GIẢI XEM CHO COREPLAYER:
    </div>
    <div style="margin:4px 0;">
      <a class="btn-res ${effectiveRes === '180p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=180p${hostQueryParam}">
        ⚡ 180p Siêu nhẹ (2G/3G)
      </a>
      <a class="btn-res ${effectiveRes === '240p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=240p${hostQueryParam}">
        📺 240p QVGA (Chuẩn E72)
      </a>
      <a class="btn-res ${effectiveRes === '360p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=360p${hostQueryParam}">
        📱 360p SD (Nét hơn)
      </a>
    </div>
    <div style="font-size:10px;color:#cbd5e1;margin-top:2px;">
      ${effectiveRes === '180p'
        ? '✓ Đang chọn 180p: Luồng siêu nhẹ (180kbps, 15fps), tải tức thì 1 giây trên mạng 2G/3G hoặc Wi-Fi xa.'
        : effectiveRes === '360p'
        ? '✓ Đang chọn 360p: Độ nét cao hơn (650kbps, 24fps) cho smartphone hoặc xem chi tiết.'
        : '✓ Đang chọn 240p: Chuẩn tỉ lệ 320x240 của màn hình Nokia E72, CPU ARM11 600MHz giải mã mượt nhất.'}
    </div>
  </div>

  <!-- HỘP THÔNG TIN MÁY CHỦ RENDER & CẦU NỐI E72-RELAY -->
  <div class="box" style="background:#1e1b4b;border:1px solid #6366f1;">
    <strong style="color:#a5b4fc;font-size:12px;">🌐 MÁY CHỦ CLOUD RENDER:</strong>
    <div style="font-size:11px;color:#c7d2fe;margin:3px 0 6px 0;line-height:1.4;">
      Địa chỉ Render: <code>https://my-iptv-uguq.onrender.com</code><br />
      <em>* Do Render dùng mã hóa HTTPS hiện đại, CorePlayer trên E72 sẽ bị lỗi SSL nếu kết nối trực tiếp.</em>
    </div>
    <div style="text-align:center;margin:4px 0;">
      <a class="btn" style="background:#4338ca;border:1px solid #818cf8;color:#fff;display:inline-block;padding:6px 12px;font-size:11px;font-weight:bold;" href="/e72-relay.py">
        📥 TẢI CẦU NỐI E72-RELAY.PY (CHO MÁY TÍNH CÙNG WI-FI)
      </a>
    </div>
    <div style="font-size:10px;color:#cbd5e1;margin-top:4px;">
      💡 <b>Cách xem tốt nhất:</b> Chạy <code>python e72-relay.py</code> trên máy tính &rarr; Điền IP máy tính vào ô bên dưới (VD: <code>192.168.1.15:8080</code>) &rarr; CorePlayer phát mượt mà không lỗi SSL!
    </div>
  </div>

  <!-- CẤU HÌNH IP MÁY CHỦ LAN (NẾU DÙNG WI-FI NHÀ) -->
  <div class="box" style="background:#0f172a;border-color:#334155;">
    <form action="/legacy" method="GET">
      <input type="hidden" name="group" value="${escapeHtml(currentGroup)}" />
      <input type="hidden" name="q" value="${escapeHtml(searchQuery)}" />
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />
      <div class="form-label" style="color:#38bdf8;">&#128246; Cấu hình IP máy tính chạy Relay (Wi-Fi):</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">
        Nhập IP máy tính (VD: <code>192.168.1.15:8080</code>) để tạo link HTTP trực tiếp cho CorePlayer:
      </div>
      <input class="input-text" type="text" name="host" value="${escapeHtml(host)}" placeholder="VD: 192.168.1.15:8080" />
      <input class="btn-search" style="background:#0284c7;color:#fff;border-color:#0369a1;margin-top:4px;" type="submit" value="Lưu IP Cho CorePlayer" />
    </form>
  </div>

  <!-- NÚT TẢI TOÀN BỘ DANH SÁCH KÊNH CHO COREPLAYER -->
  <div class="box" style="text-align:center;background:#0d2818;border-color:#1e7e34;">
    <strong style="color:#4ade80;font-size:13px;">&#128190; TẢI DANH SÁCH TẤT CẢ KÊNH CHO COREPLAYER:</strong>
    <p style="font-size:11px;margin:4px 0 8px 0;color:#c7f9cc;">
      Tải 1 file .m3u duy nhất lưu vào thẻ nhớ E:\\ của E72 để mở tất cả kênh trong CorePlayer (Đã lọc chuẩn QVGA 320x240, thuần HTTP không lỗi SSL):
    </p>
    <a class="btn" style="background:#15803d;border:1px solid #4ade80;color:#fff;display:inline-block;padding:8px 12px;font-weight:bold;text-decoration:none;margin:2px;" href="/api/channels/e72.m3u?res=${effectiveRes}${hostQueryParam}" accesskey="0">
      &#11015; TẢI FILE .M3U TOÀN BỘ KÊNH (Phím 0)
    </a>
    <a class="btn" style="background:#1e3a8a;border:1px solid #3b82f6;color:#fff;display:inline-block;padding:8px 12px;font-weight:bold;text-decoration:none;margin:2px;" href="/api/channels/e72.pls?res=${effectiveRes}${hostQueryParam}" accesskey="p">
      &#11015; TẢI FILE .PLS TOÀN BỘ KÊNH (Phím P)
    </a>
  </div>

  <!-- TÌM KIẾM & BỘ LỌC KÊNH -->
  <div class="search-panel">
    <form action="/legacy" method="GET">
      ${host ? `<input type="hidden" name="host" value="${escapeHtml(host)}" />` : ''}
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />

      <div class="form-group">
        <label class="form-label" for="search-input">1. Tìm kiếm tên kênh (Phím tắt 1):</label>
        <input class="input-text" type="text" id="search-input" name="q" value="${escapeHtml(searchQuery)}" placeholder="Nhập tên kênh (vd: VTV1, Bóng đá)..." accesskey="1" />
      </div>

      <div class="form-group">
        <label class="form-label" for="group-select">2. Chọn nhóm kênh (Danh sách):</label>
        <select class="select-box" id="group-select" name="group">
          ${optionsHtml}
        </select>
      </div>

      <div>
        <input class="btn-search" type="submit" value="&#128269; TÌM KIẾM &amp; LỌC KÊNH" />
      </div>

      ${isFiltering ? `
      <div style="text-align:center;margin-top:6px;">
        <a href="/legacy${fullQueryParams}" style="color:#f87171;font-size:12px;font-weight:bold;">[ Xóa tìm kiếm / Xem tất cả kênh ]</a>
      </div>` : ''}
    </form>
  </div>

  ${isFiltering ? `
  <div class="filter-status">
    Đang lọc:
    ${currentGroup !== 'all' ? `Nhóm: <b>${escapeHtml(currentGroup)}</b>` : ''}
    ${(currentGroup !== 'all' && searchQuery) ? ' &bull; ' : ''}
    ${searchQuery ? `Từ khóa: <b>"${escapeHtml(searchQuery)}"</b>` : ''}
    &mdash; Có <b>${totalChannels}</b> kênh phù hợp.
  </div>` : ''}

  <!-- DANH SÁCH KÊNH CHO OPERA MINI -->
  <ul class="channel-list">
    ${channelItems}
  </ul>

  ${totalPages > 1 ? paginationHtml : ''}

  <!-- HƯỚNG DẪN COREPLAYER 1.36 TRÊN OPERA MINI -->
  <div class="box" style="margin-top:10px;">
    <strong style="color:#f59e0b;font-size:13px;">📖 Hướng dẫn Opera Mini &amp; CorePlayer 1.36:</strong>
    <div class="guide-step">&#8226; <b>Cách 1 (Tốt nhất trên Opera Mini):</b> Nhấn nút xanh <b>[ Mở CorePlayer (M3U) ]</b> &rarr; Opera Mini hiện thông báo tải tệp &rarr; Chọn <b>Mở (Open)</b> &rarr; CorePlayer tự bật và phát ngay.</div>
    <div class="guide-step">&#8226; <b>Cách 2:</b> Nhấn nút <b>[ Chi tiết &amp; Link ]</b> &rarr; Sao chép đường link <code>http://.../e72.ts</code> &rarr; Mở CorePlayer &rarr; Bấm <b>Menu &gt; Open URL</b> &rarr; Dán link và bấm phát.</div>
    <div class="guide-step">&#8226; <b>Cách 3 (Lưu vào thẻ nhớ):</b> Tải file M3U toàn bộ kênh về thẻ nhớ <code>E:\\</code> &rarr; Mở CorePlayer &rarr; <b>Menu &gt; Open File</b> &rarr; Chọn file để có danh bạ chuyển kênh qua phím D-Pad.</div>
    <div style="margin-top:6px;text-align:center;">
      <a class="btn" style="background:#2563eb;color:#fff;border:1px solid #60a5fa;" href="/legacy/guide${fullQueryParams}" accesskey="h">
        📖 Xem Hướng Dẫn Cấu Hình CorePlayer Chi Tiết (Phím H) &raquo;
      </a>
    </div>
  </div>

  <div class="footer">
    <div>Chế độ: <b>Nokia E72 / Opera Mini &amp; CorePlayer</b></div>
    <div style="margin-top:6px;">
      <a href="/legacy/guide${fullQueryParams}">[ Cấu hình CorePlayer ]</a> |
      <a href="/api/channels/e72.m3u${fullQueryParams}">[ Tải Playlist M3U ]</a> |
      <a href="/?view=modern">[ Giao diện Hiện Đại ]</a>
    </div>
  </div>
</body>
</html>`;
}

export function renderLegacyChannel(channel: Channel, host: string = '', resChoice: string = '240p'): string {
  const effectiveRes = (resChoice || '240p').toLowerCase();
  const hostParamOnly = host ? `?host=${encodeURIComponent(host)}` : '';
  const queryParams = host ? `?host=${encodeURIComponent(host)}&res=${effectiveRes}` : `?res=${effectiveRes}`;
  const directOpenUrl = `/open/${encodeURIComponent(channel.id)}${queryParams}`;
  const corePlayerM3uUrl = `/c/${encodeURIComponent(channel.id)}.m3u${queryParams}`;
  const corePlayerPlsUrl = `/c/${encodeURIComponent(channel.id)}.pls${queryParams}`;
  const directStreamUrl = channel.stream_url;

  const displayHost = host || '192.168.1.xxx:3000';
  const shortE72Url = `http://${displayHost}/c/${encodeURIComponent(channel.id)}?res=${effectiveRes}`;
  const fullLiveTsUrl = `http://${displayHost}/api/channel/${encodeURIComponent(channel.id)}/live.ts`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${escapeHtml(channel.name)} - Nokia E72 / CorePlayer</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; KÊNH: ${escapeHtml(channel.name)} - NOKIA E72 (S60)
  </div>

  <div class="header">
    <h1>${escapeHtml(channel.name)}</h1>
    <div style="font-size:11px;color:#f59e0b;">Nhóm: ${escapeHtml(channel.group)} &bull; Định dạng: ${escapeHtml(channel.format.toUpperCase())}</div>
  </div>

  <!-- TÙY CHỌN ĐỘ PHÂN GIẢI -->
  <div class="box" style="background:#172554;border:1px solid #2563eb;text-align:center;">
    <div style="font-weight:bold;color:#60a5fa;margin-bottom:4px;font-size:12px;">
      ⚡ CHỌN ĐỘ PHÂN GIẢI (TĂNG TỐC TẢI &amp; MƯỢT HÌNH):
    </div>
    <div style="margin:4px 0;">
      <a class="btn-res ${effectiveRes === '180p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy/channel/${encodeURIComponent(channel.id)}?res=180p${host ? `&host=${encodeURIComponent(host)}` : ''}">
        ⚡ 180p Siêu nhẹ (2G/3G)
      </a>
      <a class="btn-res ${effectiveRes === '240p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy/channel/${encodeURIComponent(channel.id)}?res=240p${host ? `&host=${encodeURIComponent(host)}` : ''}">
        📺 240p QVGA (Chuẩn E72)
      </a>
      <a class="btn-res ${effectiveRes === '360p' ? 'btn-res-active' : 'btn-res-inactive'}" href="/legacy/channel/${encodeURIComponent(channel.id)}?res=360p${host ? `&host=${encodeURIComponent(host)}` : ''}">
        📱 360p SD (Nét hơn)
      </a>
    </div>
    <div style="font-size:10px;color:#cbd5e1;margin-top:2px;">
      ${effectiveRes === '180p'
        ? '✓ Đang chọn 180p: Siêu nhẹ, tải tức thì không gián đoạn.'
        : effectiveRes === '360p'
        ? '✓ Đang chọn 360p: Độ nét tốt hơn cho màn hình lớn.'
        : '✓ Đang chọn 240p: Chuẩn tỉ lệ màn hình ngang E72 320x240.'}
    </div>
  </div>

  <!-- CẢNH BÁO LỖI HTTPS CỦA COREPLAYER -->
  <div class="box" style="background:#3b1111;border:1px solid #ef4444;color:#fca5a5;font-size:12px;line-height:1.5;">
    <strong style="color:#f87171;font-size:13px;">⚠️ KHẮC PHỤC LỖI "HTTPS hỗ trợ các thỏa thuận không được":</strong><br />
    &bull; <strong>Nguyên nhân:</strong> CorePlayer v1.3.6 trên E72 chỉ hỗ trợ <strong>HTTP thường</strong>. Máy không hỗ trợ chuẩn TLS 1.2/1.3 của HTTPS hiện đại.<br />
    &bull; <strong>Giải pháp:</strong> Nhập IP máy tính LAN bên dưới để tạo link và file M3U thuần HTTP.
  </div>

  <!-- CẤU HÌNH IP LAN -->
  <div class="box" style="background:#0f172a;border:1px solid #334155;">
    <form action="/legacy/channel/${encodeURIComponent(channel.id)}" method="GET">
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />
      <div class="form-label" style="color:#38bdf8;">&#128246; Cấu hình IP máy tính chạy Relay (Wi-Fi):</div>
      <input class="input-text" type="text" name="host" value="${escapeHtml(host)}" placeholder="VD: 192.168.1.15:8080" />
      <input class="btn-search" style="background:#0284c7;color:#fff;border-color:#0369a1;margin-top:4px;" type="submit" value="Cập Nhật IP Cho Kênh" />
    </form>
  </div>

  <!-- NÚT PHÁT CHO OPERA MINI & COREPLAYER -->
  <div class="box" style="text-align:center;">
    <a class="btn-coreplayer" style="background:#15803d;border:1px solid #22c55e;color:#fff;display:block;margin:6px auto;width:90%;padding:10px 8px;text-decoration:none;font-weight:bold;font-size:14px;" href="${corePlayerM3uUrl}">
      &#9654; MỞ BẰNG COREPLAYER (${escapeHtml(effectiveRes.toUpperCase())} - TẢI M3U)
    </a>
    <div style="font-size:11px;color:#86efac;margin-bottom:6px;">
      (Nhấn vào nút trên &rarr; Khi Opera Mini hỏi: Chọn <b>"Mở" (Open)</b> để xem ngay)
    </div>

    <a class="btn" style="background:#1e3a8a;border:1px solid #3b82f6;color:#fff;display:block;margin:4px auto;width:90%;padding:7px 8px;text-decoration:none;font-weight:bold;" href="${corePlayerPlsUrl}">
      &#128251; TẢI FILE .PLS CHO COREPLAYER (${escapeHtml(effectiveRes.toUpperCase())})
    </a>

    <a class="btn" style="background:#0284c7;border:1px solid #38bdf8;color:#fff;display:block;margin:4px auto;width:90%;padding:7px 8px;text-decoration:none;font-weight:bold;" href="/c/${encodeURIComponent(channel.id)}?res=${effectiveRes}${host ? `&host=${encodeURIComponent(host)}` : ''}">
      &#128246; PHÁT TRỰC TIẾP LUỒNG .TS (${escapeHtml(effectiveRes.toUpperCase())})
    </a>

    <a class="btn" style="background:#334155;border:1px solid #475569;color:#fff;display:block;margin:4px auto;width:90%;padding:6px 8px;text-decoration:none;font-size:11px;" href="/api/channel/${encodeURIComponent(channel.id)}/live.ts${host ? `&host=${encodeURIComponent(host)}` : ''}">
      &#9654; Mở Luồng MPEG-TS Gốc (Không Nén)
    </a>

    <a class="btn" style="background:#ea580c;border:1px solid #f97316;color:#fff;display:block;margin:4px auto;width:90%;padding:7px 8px;text-decoration:none;font-weight:bold;" href="/open/${encodeURIComponent(channel.id)}?player=vlc">
      &#128241; XEM TRÊN VLC PLAYER (CHO SMARTPHONE)
    </a>

    <div style="margin: 8px 0;">
      <a class="btn" href="/legacy${hostParamOnly}">&laquo; QUAY LẠI DANH SÁCH</a>
    </div>
  </div>

  <!-- HỘP LINK HTTP COPY TRỰC TIẾP VÀO COREPLAYER -->
  <div class="box">
    <strong style="color:#4ade80;">1. LINK STREAM NGẮN ${escapeHtml(effectiveRes.toUpperCase())} CHO COREPLAYER:</strong>
    <p style="font-size:11px;margin:2px 0 4px 0;color:#bbb;">
      Nhập link ngắn này vào CorePlayer &gt; <strong>Menu &gt; Open URL</strong> (chuẩn <strong>http://</strong>):
    </p>
    <div class="url-box">${escapeHtml(shortE72Url)}</div>
    <textarea rows="2" style="width:96%;font-size:11px;background:#111;color:#0f6;border:1px solid #444;" readonly="readonly">${escapeHtml(shortE72Url)}</textarea>
  </div>

  <div class="box">
    <strong style="color:#f59e0b;">HƯỚNG DẪN XEM TRÊN OPERA MINI &amp; COREPLAYER:</strong>
    <div class="guide-step">&#8226; <b>Cách 1 (Nhanh nhất):</b> Nhấn nút xanh <b>[ MỞ BẰNG COREPLAYER (TẢI M3U) ]</b> &rarr; Opera Mini hiện thông báo &rarr; Chọn <b>"Mở" (Open)</b> &rarr; CorePlayer tự bật và phát ngay.</div>
    <div class="guide-step">&#8226; <b>Cách 2 (Nhập link ngắn):</b> Mở CorePlayer trên E72 &gt; <b>Menu &gt; Open URL</b> &gt; nhập link chuẩn HTTP: <b>${escapeHtml(shortE72Url)}</b>.</div>
    <div class="guide-step">&#8226; <b>Cách 3 (Lưu playlist):</b> Tải file .m3u hoặc .pls vào thẻ nhớ E: &gt; Trong CorePlayer chọn <b>Menu &gt; Open File</b> &gt; mở file vừa tải.</div>
  </div>

  <div class="footer">
    <a href="/legacy${hostParamOnly}">&laquo; Danh sách kênh</a> |
    <a href="/legacy/guide${queryParams}">Hướng dẫn CorePlayer</a> |
    <a href="/?view=modern">Bản hiện đại</a>
  </div>
</body>
</html>`;
}

export function renderCorePlayerGuide(host: string = '', resChoice: string = '240p'): string {
  const displayHost = host || '192.168.1.xxx:3000';
  const sampleUrl = `http://${displayHost}/c/1?res=240p`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Hướng Dẫn Cấu Hình CorePlayer 1.36 Cho Nokia E72</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; CẨM NANG TOÀN TẬP: OPERA MINI &amp; COREPLAYER CHO NOKIA E72
  </div>

  <div class="header">
    <h1>CẤU HÌNH COREPLAYER 1.36 / 3.36 CHO E72</h1>
    <div style="font-size:11px;color:#cbd5e1;">Tối ưu giải mã H.264 mượt mà &bull; Không giật hình &bull; Không tràn RAM</div>
  </div>

  <!-- PHẦN 1: CÁCH DÙNG OPERA MINI ĐỂ MỞ COREPLAYER -->
  <div class="box" style="background:#0f2b48;border-color:#38bdf8;">
    <strong style="color:#38bdf8;font-size:13px;">1. CÁCH XEM TRUYỀN HÌNH QUA TRÌNH DUYỆT OPERA MINI:</strong>
    <div class="guide-step" style="margin-top:6px;">
      <b>Bước 1:</b> Trong Opera Mini, vào danh sách kênh <code>/legacy</code>.<br />
      <b>Bước 2:</b> Bấm vào nút màu xanh <b>[ ▶ Mở CorePlayer (Tải M3U) ]</b> của kênh bạn muốn xem.<br />
      <b>Bước 3:</b> Trình duyệt Opera Mini sẽ hiện bảng hỏi: <em>"Tải về / Mở" ("Download / Open")</em>.<br />
      <b>Bước 4:</b> Bấm chọn <b>"Mở" (Open)</b>.<br />
      <b>Kết quả:</b> Symbian OS sẽ tự động kích hoạt ứng dụng <strong>CorePlayer</strong>, nạp luồng phát và hiển thị hình ảnh sau 1-2 giây!
    </div>
  </div>

  <!-- PHẦN 2: CÁCH DÙNG LINK RÚT GỌN SIÊU TIỆN LỢI CHO PHÍM E72 -->
  <div class="box" style="background:#052e16;border-color:#22c55e;">
    <strong style="color:#4ade80;font-size:13px;">2. CÁCH MỞ KÊNH NHANH BẰNG LINK RÚT GỌN (/c/1, /c/2...):</strong>
    <div class="guide-step" style="margin-top:6px;">
      Bàn phím QWERTY của Nokia E72 rất nhỏ, gõ link dài rất mất thời gian. Hệ thống đã tạo sẵn đường link cực ngắn theo số thứ tự kênh:<br />
      &bull; <b>Kênh 1 (VTV1):</b> <code>http://${displayHost}/c/1</code><br />
      &bull; <b>Kênh 2 (VTV2):</b> <code>http://${displayHost}/c/2</code><br />
      &bull; <b>Kênh 3 (VTV3):</b> <code>http://${displayHost}/c/3</code><br />
      <i>Cách dùng:</i> Mở CorePlayer &gt; <b>Menu &gt; Open URL</b> &gt; Chỉ cần gõ <code>/c/1</code> hoặc lưu vào Bookmark của CorePlayer để chuyển kênh chỉ với 1 thao tác!
    </div>
  </div>

  <!-- PHẦN 3: THIẾT LẬP CẤU HÌNH TRONG COREPLAYER -->
  <div class="box">
    <strong style="color:#f59e0b;font-size:13px;">3. CẤU HÌNH CHUẨN TRONG COREPLAYER (ĐỂ KHÔNG BỊ ĐƠ MÁY):</strong>
    <p style="font-size:11px;color:#94a3b8;margin:4px 0 8px 0;">Mở CorePlayer &gt; Chọn <b>Menu (phím chọn trái) &gt; Tools &gt; Preferences</b>:</p>

    <div class="guide-step">
      <strong style="color:#38bdf8;">A. Mục "Video" (Cực kỳ quan trọng):</strong><br />
      &bull; <b>Video Output:</b> Chọn <b>DirectDraw</b> hoặc <b>RAW FrameBuffer</b>.<br />
      <em>(Giúp giải mã bỏ qua lớp đồ họa GDI của Symbian, giảm tải CPU ARM11 từ 95% xuống 40%, hình ảnh đạt 60fps mượt mà).</em><br />
      &bull; <b>Zoom:</b> Chọn <b>Best Fit</b> (giữ đúng tỉ lệ) hoặc <b>Fit to Screen</b> (toàn màn hình 320x240).
    </div>

    <div class="guide-step" style="margin-top:8px;">
      <strong style="color:#38bdf8;">B. Mục "Network" (Bộ đệm luồng):</strong><br />
      &bull; <b>Buffer Size:</b> Đặt <b>256 KB</b> đến <b>512 KB</b>.<br />
      <em>(Lưu ý: Không đặt quá 1MB vì RAM E72 chỉ có 128MB, đặt quá lớn sẽ gây tràn RAM).</em><br />
      &bull; <b>Pre-buffer:</b> Đặt <b>15% - 20%</b> để luồng tải nhanh chỉ sau 1-2 giây.
    </div>

    <div class="guide-step" style="margin-top:8px;">
      <strong style="color:#38bdf8;">C. Mục "Audio":</strong><br />
      &bull; <b>Audio Output:</b> Chọn <b>Symbian Sound</b>.<br />
      &bull; <b>Equalizer:</b> Tắt (Off) hoặc Flat để tiết kiệm chu kỳ xử lý của chip.
    </div>
  </div>

  <!-- PHẦN 4: KHẮC PHỤC CÁC LỖI THƯỜNG GẶP -->
  <div class="box" style="background:#261818;border-color:#ef4444;">
    <strong style="color:#f87171;font-size:13px;">4. KHẮC PHỤC LỖI THƯỜNG GẶP TRÊN E72:</strong>
    <div class="guide-step" style="margin-top:6px;">
      &bull; <strong>Lỗi "HTTPS hỗ trợ các thỏa thuận không được":</strong><br />
      Do CorePlayer chỉ hỗ trợ <code>http://</code> thuần. Luôn dùng đường link HTTP do server cung cấp, không dùng link <code>https://</code>.<br /><br />
      &bull; <strong>Lỗi "Hết bộ nhớ / Out of memory":</strong><br />
      Vào danh sách kênh và chọn mức độ phân giải <b>⚡ 180p Siêu nhẹ</b> hoặc <b>📺 240p QVGA</b>.<br /><br />
      &bull; <strong>Lỗi hình ảnh bị giật / tiếng đi trước hình:</strong><br />
      Chỉnh lại Video Output thành <b>DirectDraw</b> trong CorePlayer Preferences.
    </div>
  </div>

  <!-- PHẦN 5: THỬ NGHIỆM LINK MẪU -->
  <div class="box">
    <strong style="color:#4ade80;font-size:13px;">5. LINK THỬ NGHIỆM TRỰC TIẾP:</strong>
    <p style="font-size:11px;color:#94a3b8;margin:2px 0 4px 0;">Copy link dưới dán vào CorePlayer &gt; Open URL:</p>
    <div class="url-box">${escapeHtml(sampleUrl)}</div>
  </div>

  <div style="text-align:center;margin:12px 0;">
    <a class="btn" style="background:#0284c7;color:#fff;border:1px solid #38bdf8;padding:8px 14px;font-size:13px;" href="/legacy${host ? `?host=${encodeURIComponent(host)}` : ''}">
      &laquo; QUAY LẠI DANH SÁCH KÊNH
    </a>
  </div>

  <div class="footer">
    <a href="/legacy${host ? `?host=${encodeURIComponent(host)}` : ''}">Danh sách kênh</a> |
    <a href="/api/channels/e72.m3u${host ? `?host=${encodeURIComponent(host)}` : ''}">Tải M3U E72</a> |
    <a href="/api/channels/e72.pls${host ? `?host=${encodeURIComponent(host)}` : ''}">Tải PLS E72</a> |
    <a href="/?view=modern">Bản hiện đại</a>
  </div>
</body>
</html>`;
}

export function renderLegacyNotFound(): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>404 - Không tìm thấy trang</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="header">
    <h1>KHÔNG TÌM THẤY TRANG</h1>
  </div>
  <div class="box" style="text-align:center;padding:16px;">
    <p>Kênh hoặc đường dẫn bạn truy cập không tồn tại hoặc đã thay đổi.</p>
    <a class="btn" href="/legacy">&#171; QUAY VỀ TRANG CHỦ</a>
  </div>
  <div class="footer">
    <a href="/legacy">MY IPTV S60</a>
  </div>
</body>
</html>`;
}

