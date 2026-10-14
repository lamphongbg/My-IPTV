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
  /* ==========================================================================
     NOKIA E72 (SYMBIAN S60v3 FP2) - TIÊU CHUẨN ĐỒ HỌA & CÔNG THÁI HỌC QVGA 320x240
     Thiết kế bởi Chuyên gia IPTV Gateway & Multimedia Streaming 10+ năm kinh nghiệm
     ========================================================================== */
  * {
    box-sizing: border-box;
    -webkit-text-size-adjust: none;
  }
  html, body {
    margin: 0;
    padding: 0;
    background-color: #070a10;
    color: #e2e8f0;
    font-family: "Nokia Sans", "Series 60 Sans", Arial, Helvetica, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    max-width: 320px;
    margin-left: auto;
    margin-right: auto;
    overflow-x: hidden;
  }
  a {
    color: #38bdf8;
    text-decoration: underline;
  }
  /* Bắt nét con trỏ chuột quang Optical Navi key Nokia E72 */
  a:focus, a:hover, a:active,
  button:focus, button:hover,
  input:focus, select:focus {
    background-color: #f59e0b !important;
    color: #000000 !important;
    outline: 2px solid #ffffff !important;
    text-decoration: none !important;
  }

  /* THANH TIÊU ĐỀ DOANH NHÂN E-SERIES */
  .top-header {
    background: #0f172a;
    border-bottom: 2px solid #f59e0b;
    padding: 5px 6px;
    text-align: center;
    margin-bottom: 4px;
  }
  .brand-title {
    font-size: 13px;
    font-weight: bold;
    color: #f59e0b;
    margin: 0 0 1px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .brand-sub {
    font-size: 9px;
    color: #94a3b8;
  }

  /* KHUNG THÔNG BÁO TRẠNG THÁI THIẾT BỊ */
  .status-pill {
    background-color: #064e3b;
    color: #a7f3d0;
    border: 1px solid #10b981;
    padding: 3px 6px;
    font-size: 9px;
    text-align: center;
    margin: 0 3px 5px 3px;
    border-radius: 3px;
    font-weight: bold;
  }
  .tip-banner {
    background-color: #1e1b4b;
    color: #c7d2fe;
    border: 1px solid #4338ca;
    padding: 4px 6px;
    font-size: 10px;
    margin: 0 3px 5px 3px;
    border-radius: 3px;
    line-height: 1.35;
  }

  /* CHUYỂN ĐỔI CHẾ ĐỘ PHÁT (PLAYER TABS) */
  .mode-tabs {
    background-color: #111827;
    border: 1px solid #1f293d;
    padding: 3px 2px;
    margin: 0 3px 5px 3px;
    border-radius: 4px;
    text-align: center;
  }
  .tab-item {
    display: inline-block;
    padding: 4px 5px;
    margin: 1px;
    font-size: 10px;
    font-weight: bold;
    text-decoration: none;
    border-radius: 3px;
  }
  .tab-all-active {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: 1px solid #60a5fa;
  }
  .tab-core-active {
    background-color: #15803d !important;
    color: #ffffff !important;
    border: 1px solid #4ade80;
  }
  .tab-real-active {
    background-color: #b91c1c !important;
    color: #ffffff !important;
    border: 1px solid #f87171;
  }
  .tab-idle {
    background-color: #0b1120 !important;
    color: #94a3b8 !important;
    border: 1px solid #334155;
  }

  /* THANH CHỌN ĐỘ PHÂN GIẢI (RESOLUTION STRIP) */
  .res-strip {
    background-color: #0c121e;
    border: 1px solid #1e293b;
    padding: 3px 4px;
    margin: 0 3px 5px 3px;
    text-align: center;
    border-radius: 4px;
  }
  .res-label {
    font-size: 9px;
    color: #94a3b8;
    margin-bottom: 2px;
    font-weight: bold;
  }
  .btn-res-pill {
    display: inline-block;
    padding: 2px 4px;
    margin: 1px;
    font-size: 9px;
    font-weight: bold;
    text-decoration: none;
    border-radius: 3px;
  }
  .res-on {
    background-color: #f59e0b !important;
    color: #000000 !important;
    border: 1px solid #d97706;
  }
  .res-off {
    background-color: #1e293b !important;
    color: #cbd5e1 !important;
    border: 1px solid #334155;
  }

  /* THẺ KÊNH TRUYỀN HÌNH (CHANNEL CARD) */
  .ch-list {
    margin: 0;
    padding: 0 3px;
    list-style: none;
  }
  .ch-card {
    background-color: #111827;
    border: 1px solid #1f2937;
    border-left: 3px solid #0284c7;
    padding: 5px;
    margin-bottom: 5px;
    border-radius: 4px;
  }
  .ch-header {
    margin-bottom: 3px;
  }
  .badge-cat {
    display: inline-block;
    background-color: #0f2b48;
    color: #f59e0b;
    font-size: 9px;
    font-weight: bold;
    padding: 1px 3px;
    border-radius: 2px;
    border: 1px solid #1e3a8a;
  }
  .badge-live {
    display: inline-block;
    background-color: #052e16;
    color: #4ade80;
    font-size: 9px;
    font-weight: bold;
    padding: 1px 3px;
    border-radius: 2px;
    border: 1px solid #15803d;
  }
  .ch-name-link {
    display: block;
    font-size: 12px;
    font-weight: bold;
    color: #ffffff;
    text-decoration: none;
    margin-top: 2px;
    line-height: 1.25;
  }

  /* NÚT GỌI ỨNG DỤNG TRỰC TIẾP TỪ TRÌNH DUYỆT */
  .launch-box {
    margin-top: 4px;
  }
  /* Chế độ kép: 2 nút song song ngang nhau */
  .dual-grid {
    width: 100%;
    margin-top: 3px;
  }
  .btn-call-core {
    display: inline-block;
    width: 48%;
    padding: 6px 2px;
    background-color: #15803d !important;
    color: #ffffff !important;
    border: 1px solid #22c55e !important;
    font-size: 10px;
    font-weight: bold;
    text-align: center;
    text-decoration: none;
    border-radius: 3px;
    margin-right: 2%;
  }
  .btn-call-real {
    display: inline-block;
    width: 48%;
    padding: 6px 2px;
    background-color: #b91c1c !important;
    color: #ffffff !important;
    border: 1px solid #ef4444 !important;
    font-size: 10px;
    font-weight: bold;
    text-align: center;
    text-decoration: none;
    border-radius: 3px;
  }
  /* Chế độ đơn: 1 nút cực đại toàn màn hình */
  .btn-single-core {
    display: block;
    width: 100%;
    padding: 7px 4px;
    background-color: #15803d !important;
    color: #ffffff !important;
    border: 1px solid #22c55e !important;
    font-size: 11px;
    font-weight: bold;
    text-align: center;
    text-decoration: none;
    border-radius: 3px;
    margin-bottom: 3px;
  }
  .btn-single-real {
    display: block;
    width: 100%;
    padding: 7px 4px;
    background-color: #b91c1c !important;
    color: #ffffff !important;
    border: 1px solid #ef4444 !important;
    font-size: 11px;
    font-weight: bold;
    text-align: center;
    text-decoration: none;
    border-radius: 3px;
    margin-bottom: 3px;
  }

  /* CÁC NÚT PHỤ VÀ ĐỊNH DẠNG KHÁC */
  .sub-row {
    margin-top: 3px;
    text-align: center;
  }
  .btn-mini {
    display: inline-block;
    padding: 2px 5px;
    margin: 1px;
    background-color: #1f2937;
    color: #cbd5e1 !important;
    border: 1px solid #374151;
    font-size: 9px;
    text-decoration: none;
    border-radius: 2px;
  }
  .code-link {
    background-color: #030712;
    color: #38bdf8;
    padding: 2px 4px;
    font-family: "Courier New", Courier, monospace;
    font-size: 8px;
    border-radius: 2px;
    margin-top: 3px;
    word-break: break-all;
    border: 1px solid #1f2937;
  }

  /* KHUNG BIỂU MẪU & TÌM KIẾM */
  .block-panel {
    background-color: #111827;
    border: 1px solid #1e293b;
    padding: 5px;
    margin: 0 3px 5px 3px;
    border-radius: 4px;
  }
  .panel-head {
    font-size: 10px;
    font-weight: bold;
    color: #f59e0b;
    display: block;
    margin-bottom: 2px;
  }
  .ctrl-input, .ctrl-select {
    width: 100%;
    padding: 4px;
    font-size: 11px;
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #94a3b8;
    display: block;
    border-radius: 2px;
    margin-bottom: 3px;
  }
  .btn-action {
    width: 100%;
    padding: 5px;
    background-color: #f59e0b;
    color: #000000;
    font-size: 11px;
    font-weight: bold;
    border: 1px solid #b45309;
    border-radius: 2px;
    cursor: pointer;
    text-align: center;
  }

  /* PHÂN TRANG */
  .pager-box {
    text-align: center;
    padding: 5px 0;
    margin: 6px 3px;
    border-top: 1px dashed #334155;
  }
  .pager-btn {
    padding: 3px 6px;
    margin: 0 1px;
    display: inline-block;
    background-color: #1e293b;
    border: 1px solid #475569;
    font-size: 10px;
    text-decoration: none;
    border-radius: 2px;
  }
  .pager-curr {
    padding: 3px 6px;
    margin: 0 1px;
    display: inline-block;
    background-color: #f59e0b;
    color: #000000;
    font-weight: bold;
    font-size: 10px;
    border-radius: 2px;
  }

  /* CHÂN TRANG */
  .bottom-footer {
    text-align: center;
    padding: 6px 4px;
    margin-top: 8px;
    border-top: 1px solid #1e293b;
    font-size: 9px;
    color: #94a3b8;
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
  playerChoice?: 'all' | 'coreplayer' | 'realplayer';
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
    playerChoice = 'all',
  } = options;

  const effectiveRes = (resChoice || '240p').toLowerCase();
  const effectivePlayer = playerChoice || 'all';

  // Nhóm ưu tiên kênh Việt Nam lên trước
  const priorityGroups = ['Việt Nam', 'VTV', 'VTC', 'HTV', 'Tin tức', 'Thể thao', 'Giải trí', 'Khoa học', 'Quốc tế', 'Phim'];
  const sortedGroups = [...groups].sort((a, b) => {
    const pA = priorityGroups.indexOf(a);
    const pB = priorityGroups.indexOf(b);
    if (pA !== -1 && pB !== -1) return pA - pB;
    if (pA !== -1) return -1;
    if (pB !== -1) return 1;
    return a.localeCompare(b);
  });

  let optionsHtml = `<option value="all"${currentGroup === 'all' ? ' selected="selected"' : ''}>-- Tất cả nhóm (${totalChannels} kênh) --</option>`;
  for (const g of sortedGroups) {
    const isSelected = currentGroup.toLowerCase() === g.toLowerCase();
    optionsHtml += `<option value="${escapeHtml(g)}"${isSelected ? ' selected="selected"' : ''}>${escapeHtml(g)}</option>`;
  }

  const hostQueryParam = host ? `&host=${encodeURIComponent(host)}` : '';
  const playerQueryParam = effectivePlayer !== 'all' ? `&player=${encodeURIComponent(effectivePlayer)}` : '';
  const resParam = `&res=${encodeURIComponent(effectiveRes)}`;
  const displayHost = host || (typeof process !== 'undefined' && process.env?.RENDER_EXTERNAL_HOSTNAME) || '192.168.1.xxx:3000';
  const limit = 12;

  // Render từng thẻ kênh
  let channelItems = '';
  if (channels.length === 0) {
    channelItems = '<li class="ch-card" style="text-align:center;padding:14px;">Không tìm thấy kênh phù hợp với tìm kiếm của bạn.</li>';
  } else {
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const indexNum = (currentPage - 1) * limit + i + 1;

      // Link gọi trực tiếp ứng dụng khi nhấn nút trên trình duyệt
      // Phục vụ MIME type chính xác và Content-Disposition: inline để Symbian kích hoạt ngay ứng dụng!
      const launchCorePlayerUrl = `/play/coreplayer/${encodeURIComponent(ch.id)}?res=${effectiveRes}${hostQueryParam}`;
      const launchRealPlayerUrl = `/play/realplayer/${encodeURIComponent(ch.id)}?res=${effectiveRes}${hostQueryParam}`;

      // File dự phòng và stream trực tiếp
      const chCorePls = `/c/${encodeURIComponent(ch.id)}.pls?res=${effectiveRes}${hostQueryParam}`;
      const chRealMp4 = `/c/${encodeURIComponent(ch.id)}.mp4?res=${effectiveRes}${hostQueryParam}`;
      const chDetailUrl = `/legacy/channel/${encodeURIComponent(ch.id)}?res=${effectiveRes}&player=${effectivePlayer}${hostQueryParam}`;
      const shortUrl = `http://${displayHost}/c/${encodeURIComponent(ch.id)}.ts`;

      channelItems += `
        <li class="ch-card">
          <div class="ch-header">
            <span class="badge-cat">${escapeHtml(ch.group)}</span>
            <span class="badge-live">&#10003; Online</span>
            ${Boolean(ch.has_subtitles || (ch.subtitle_tracks && ch.subtitle_tracks.length > 0)) ? '<span class="badge-sub" style="background:#083344;color:#67e8f9;border:1px solid #06b6d4;padding:1px 4px;font-size:9px;font-weight:bold;border-radius:3px;">[CC]</span>' : ''}
            <a class="ch-name-link" href="${chDetailUrl}">
              ${indexNum}. ${escapeHtml(ch.name)}
            </a>
          </div>

          <!-- NÚT GỌI ỨNG DỤNG TRỰC TIẾP KHI BẤM TRÊN TRÌNH DUYỆT -->
          <div class="launch-box">
            ${effectivePlayer === 'coreplayer' ? `
            <!-- CHẾ ĐỘ CHUYÊN COREPLAYER -->
            <a class="btn-single-core" href="${launchCorePlayerUrl}" title="Nhấn để mở CorePlayer">
              &#9654; MỞ COREPLAYER (TỰ ĐỘNG)
            </a>
            <div class="sub-row">
              <a class="btn-mini" href="${chCorePls}">&#128251; Tải .PLS</a>
              <a class="btn-mini" href="/c/${encodeURIComponent(ch.id)}.ts?res=${effectiveRes}${hostQueryParam}">&#128246; Luồng .TS</a>
              <a class="btn-mini" href="${chDetailUrl}">&#128250; Chi tiết</a>
            </div>
            ` : effectivePlayer === 'realplayer' ? `
            <!-- CHẾ ĐỘ CHUYÊN REALPLAYER -->
            <a class="btn-single-real" href="${launchRealPlayerUrl}" title="Nhấn để mở RealPlayer">
              &#9654; MỞ REALPLAYER (TỰ ĐỘNG)
            </a>
            <div class="sub-row">
              <a class="btn-mini" href="${chRealMp4}">&#127916; Luồng MP4</a>
              <a class="btn-mini" href="/api/channel/${encodeURIComponent(ch.id)}/realplayer.ram?res=${effectiveRes}${hostQueryParam}&dl=1">&#128190; Tải RAM</a>
              <a class="btn-mini" href="${chDetailUrl}">&#128250; Chi tiết</a>
            </div>
            ` : `
            <!-- CHẾ ĐỘ SONG SONG (TẤT CẢ) -->
            <div class="dual-grid">
              <a class="btn-call-core" href="${launchCorePlayerUrl}" title="Mở trực tiếp bằng CorePlayer">
                &#9654; COREPLAYER
              </a>
              <a class="btn-call-real" href="${launchRealPlayerUrl}" title="Mở trực tiếp bằng RealPlayer">
                &#9654; REALPLAYER
              </a>
            </div>
            <div class="sub-row">
              <a class="btn-mini" href="${chCorePls}">.PLS</a>
              <a class="btn-mini" href="${chRealMp4}">MP4/3GP</a>
              <a class="btn-mini" href="${chDetailUrl}">Chi tiết &amp; Link</a>
            </div>
            `}
          </div>

          <div class="code-link">
            URL: ${shortUrl}
          </div>
        </li>
      `;
    }
  }

  // Khối phân trang
  let paginationHtml = '<div class="pager-box">';
  if (currentPage > 1) {
    paginationHtml += `<a class="pager-btn" href="/legacy?page=${currentPage - 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}${resParam}${playerQueryParam}${hostQueryParam}" accesskey="7">&laquo; Trước (Phím 7)</a>`;
  }
  paginationHtml += ` <span class="pager-curr">${currentPage}/${totalPages}</span> `;
  if (currentPage < totalPages) {
    paginationHtml += `<a class="pager-btn" href="/legacy?page=${currentPage + 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}${resParam}${playerQueryParam}${hostQueryParam}" accesskey="9">Sau (Phím 9) &raquo;</a>`;
  }
  paginationHtml += '</div>';

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>IPTV Nokia E72 - CorePlayer &amp; RealPlayer</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <!-- HEADER NOKIA E72 -->
  <div class="top-header">
    <div class="brand-title">&#128250; MY IPTV - NOKIA E72</div>
    <div class="brand-sub">CorePlayer 1.36 &amp; RealPlayer S60 (QVGA 320x240)</div>
  </div>

  <div class="status-pill">
    &#10003; THIẾT BỊ: NOKIA E72 (ARM11 600MHz &bull; S60v3 FP2)
  </div>

  <!-- HƯỚNG DẪN GỌI ỨNG DỤNG TRỰC TIẾP -->
  <div class="tip-banner">
    <b style="color:#fef08a;">📱 CÁCH MỞ KÊNH 1-CHẠM TRÊN E72:</b><br />
    &bull; <b>CorePlayer:</b> Nhấn nút xanh <b>[ ▶ COREPLAYER ]</b> &rarr; Trình duyệt tự gọi CorePlayer giải mã luồng.<br />
    &bull; <b>RealPlayer:</b> Nhấn nút đỏ <b>[ ▶ REALPLAYER ]</b> &rarr; Máy tự bật RealPlayer có sẵn trong ROM!<br />
    <em>(Trên Opera Mini: Khi hiện thông báo, chọn <b>"Mở" / "Open"</b>)</em>
  </div>

  <!-- CHỌN CHẾ ĐỘ TRÌNH PHÁT (PLAYER TABS) -->
  <div class="mode-tabs">
    <div style="font-size:9px;font-weight:bold;color:#94a3b8;margin-bottom:2px;">
      CHỌN ỨNG DỤNG MỤC TIÊU:
    </div>
    <a class="tab-item ${effectivePlayer === 'all' ? 'tab-all-active' : 'tab-idle'}" href="/legacy?page=1&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&player=all${resParam}${hostQueryParam}" accesskey="4">
      ⚡ Cả 2 App (Phím 4)
    </a>
    <a class="tab-item ${effectivePlayer === 'coreplayer' ? 'tab-core-active' : 'tab-idle'}" href="/legacy?page=1&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&player=coreplayer${resParam}${hostQueryParam}" accesskey="2">
      🟢 CorePlayer (Phím 2)
    </a>
    <a class="tab-item ${effectivePlayer === 'realplayer' ? 'tab-real-active' : 'tab-idle'}" href="/legacy?page=1&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&player=realplayer${resParam}${hostQueryParam}" accesskey="3">
      🔴 RealPlayer (Phím 3)
    </a>
  </div>

  <!-- CHỌN ĐỘ PHÂN GIẢI (RESOLUTION STRIP) -->
  <div class="res-strip">
    <div class="res-label">ĐỘ PHÂN GIẢI LUỒNG VIDEO (GIẢI MÃ MƯỢT):</div>
    <a class="btn-res-pill ${effectiveRes === '180p' ? 'res-on' : 'res-off'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=180p${playerQueryParam}${hostQueryParam}">
      ⚡ 180p (2G/3G nhẹ)
    </a>
    <a class="btn-res-pill ${effectiveRes === '240p' ? 'res-on' : 'res-off'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=240p${playerQueryParam}${hostQueryParam}">
      📺 240p (Chuẩn E72)
    </a>
    <a class="btn-res-pill ${effectiveRes === '360p' ? 'res-on' : 'res-off'}" href="/legacy?page=${currentPage}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}&res=360p${playerQueryParam}${hostQueryParam}">
      📱 360p (Nét hơn)
    </a>
  </div>

  <!-- BỘ LỌC VÀ TÌM KIẾM BẰNG PHÍM QWERTY -->
  <div class="block-panel">
    <form action="/legacy" method="GET">
      ${host ? `<input type="hidden" name="host" value="${escapeHtml(host)}" />` : ''}
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />
      <input type="hidden" name="player" value="${escapeHtml(effectivePlayer)}" />

      <span class="panel-head">&#128269; Tìm kênh (Phím tắt 1):</span>
      <input class="ctrl-input" type="text" name="q" value="${escapeHtml(searchQuery)}" placeholder="Nhập tên kênh (vd: VTV1, HTV, Bong da)..." accesskey="1" />

      <span class="panel-head">Thể loại nhóm:</span>
      <select class="ctrl-select" name="group">
        ${optionsHtml}
      </select>

      <input class="btn-action" type="submit" value="LỌC KÊNH (ENTER)" />
    </form>
  </div>

  <!-- DANH SÁCH KÊNH (TỐI ƯU HIỂN THỊ QVGA 320x240) -->
  <ul class="ch-list">
    ${channelItems}
  </ul>

  <!-- PHÂN TRANG -->
  ${totalPages > 1 ? paginationHtml : ''}

  <!-- NHẢY TRANG NHANH CHO DANH SÁCH DÀI -->
  ${totalPages > 1 ? `
  <div class="block-panel" style="text-align:center;">
    <form action="/legacy" method="GET" style="display:inline-block;">
      ${host ? `<input type="hidden" name="host" value="${escapeHtml(host)}" />` : ''}
      <input type="hidden" name="group" value="${escapeHtml(currentGroup)}" />
      <input type="hidden" name="q" value="${escapeHtml(searchQuery)}" />
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />
      <input type="hidden" name="player" value="${escapeHtml(effectivePlayer)}" />
      <span style="font-size:10px;color:#cbd5e1;">Nhảy tới trang (1 - ${totalPages}): </span>
      <input style="width:40px;padding:2px;font-size:11px;text-align:center;" type="number" name="page" min="1" max="${totalPages}" value="${currentPage}" />
      <input class="pager-btn" style="padding:2px 8px;background:#f59e0b;color:#000;font-weight:bold;" type="submit" value="Đi" />
    </form>
  </div>
  ` : ''}

  <!-- CẤU HÌNH IP MÁY TÍNH LAN TRUNG GIAN (WI-FI) -->
  <div class="block-panel">
    <form action="/legacy" method="GET">
      <input type="hidden" name="group" value="${escapeHtml(currentGroup)}" />
      <input type="hidden" name="q" value="${escapeHtml(searchQuery)}" />
      <input type="hidden" name="player" value="${escapeHtml(effectivePlayer)}" />
      <input type="hidden" name="res" value="${escapeHtml(effectiveRes)}" />
      <span class="panel-head">&#128246; IP Máy Tính Relay LAN (Nếu xem qua Wi-Fi):</span>
      <input class="ctrl-input" type="text" name="host" value="${escapeHtml(host)}" placeholder="VD: 192.168.1.15:3000" accesskey="s" />
      <input class="btn-action" style="background:#0284c7;color:#fff;border-color:#0369a1;" type="submit" value="Lưu IP Cho Trình Phát (Phím S)" />
    </form>
  </div>

  <!-- TẢI TRỌN BỘ DANH SÁCH KÊNH CHO CẢ 2 ỨNG DỤNG -->
  <div class="block-panel" style="text-align:center;background:#052e16;border-color:#15803d;">
    <strong style="color:#86efac;font-size:10px;">&#128190; TẢI DANH BẠ KÊNH LƯU VÀO THẺ NHỚ E:\ :</strong>
    <div style="margin-top:4px;">
      <a class="btn-mini" style="background:#15803d;color:#fff !important;border-color:#4ade80;font-weight:bold;" href="/api/channels/coreplayer.m3u?res=${effectiveRes}${hostQueryParam}&dl=1">
        &#11015; M3U Cho CorePlayer
      </a>
      <a class="btn-mini" style="background:#b91c1c;color:#fff !important;border-color:#f87171;font-weight:bold;" href="/realplayer.ram?res=${effectiveRes}${hostQueryParam}&dl=1">
        &#11015; RAM Cho RealPlayer
      </a>
      <a class="btn-mini" style="background:#1e3a8a;color:#fff !important;border-color:#60a5fa;" href="/api/channels/coreplayer.pls?res=${effectiveRes}${hostQueryParam}&dl=1">
        &#11015; File .PLS
      </a>
    </div>
  </div>

  <!-- LIÊN KẾT CẨM NANG -->
  <div class="block-panel" style="text-align:center;">
    <a class="btn-mini" style="background:#2563eb;color:#fff !important;border-color:#60a5fa;display:block;padding:6px;font-size:11px;font-weight:bold;" href="/legacy/guide?res=${effectiveRes}&player=${effectivePlayer}${hostQueryParam}" accesskey="h">
      📖 Cẩm Nang Cấu Hình CorePlayer &amp; RealPlayer (Phím H) &raquo;
    </a>
  </div>

  <div class="bottom-footer">
    <div>Nokia E72 Multimedia Engine &bull; S60v3 FP2</div>
    <div style="margin-top:3px;">
      <a href="/legacy?player=coreplayer${hostQueryParam}">CorePlayer</a> |
      <a href="/legacy?player=realplayer${hostQueryParam}">RealPlayer</a> |
      <a href="/?view=modern">Bản Modern PC</a>
    </div>
  </div>
</body>
</html>`;
}

export function renderLegacyChannel(
  channel: Channel,
  host: string = '',
  resChoice: string = '240p',
  playerChoice: 'all' | 'coreplayer' | 'realplayer' = 'all'
): string {
  const effectiveRes = (resChoice || '240p').toLowerCase();
  const hostParam = host ? `&host=${encodeURIComponent(host)}` : '';
  const displayHost = host || (typeof process !== 'undefined' && process.env?.RENDER_EXTERNAL_HOSTNAME) || '192.168.1.xxx:3000';

  // Direct app launch URLs
  const launchCorePlayerUrl = `/play/coreplayer/${encodeURIComponent(channel.id)}?res=${effectiveRes}${hostParam}`;
  const launchRealPlayerUrl = `/play/realplayer/${encodeURIComponent(channel.id)}?res=${effectiveRes}${hostParam}`;

  const chCorePls = `/c/${encodeURIComponent(channel.id)}.pls?res=${effectiveRes}${hostParam}`;
  const chRealMp4 = `/c/${encodeURIComponent(channel.id)}.mp4?res=${effectiveRes}${hostParam}`;
  const chRealRamDl = `/c/${encodeURIComponent(channel.id)}.ram?res=${effectiveRes}${hostParam}&dl=1`;

  const shortTsUrl = `http://${displayHost}/c/${encodeURIComponent(channel.id)}.ts?res=${effectiveRes}`;
  const shortMp4Url = `http://${displayHost}/c/${encodeURIComponent(channel.id)}.mp4?res=${effectiveRes}`;
  const rtspUrl = `rtsp://${displayHost}/live/${encodeURIComponent(channel.id)}`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${escapeHtml(channel.name)} - Phát Trên Nokia E72</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="top-header">
    <div class="brand-title">${escapeHtml(channel.name)}</div>
    <div class="brand-sub">Nhóm: ${escapeHtml(channel.group)} &bull; ${effectiveRes.toUpperCase()}</div>
  </div>

  <div class="status-pill">
    &#10003; KÊNH ONLINE - SẴN SÀNG KHỞI CHẠY TRỰC TIẾP
  </div>

  <!-- MỤC 1: PHÁT VỚI COREPLAYER MOBILE -->
  <div class="block-panel" style="border-color:#22c55e;background:#052e16;">
    <strong style="color:#4ade80;font-size:12px;">🟢 1. PHÁT BẰNG COREPLAYER 1.36</strong>
    <p style="font-size:9px;color:#a7f3d0;margin:2px 0 5px 0;">
      Giải mã phần cứng DirectDraw mượt mà, âm thanh AAC sống động:
    </p>

    <!-- Nút gọi trực tiếp CorePlayer -->
    <a class="btn-single-core" href="${launchCorePlayerUrl}">
      &#9654; KÍCH HOẠT COREPLAYER (TỰ ĐỘNG)
    </a>
    <div style="font-size:9px;color:#86efac;text-align:center;margin-bottom:4px;">
      (Trình duyệt tự chuyển tiếp tới CorePlayer để phát ngay)
    </div>

    <div style="text-align:center;">
      <a class="btn-mini" href="${chCorePls}">&#128251; Tải File .PLS</a>
      <a class="btn-mini" href="/c/${encodeURIComponent(channel.id)}.ts?res=${effectiveRes}${hostParam}">&#128246; Luồng .TS Trực Tiếp</a>
      <a class="btn-mini" href="/c/${encodeURIComponent(channel.id)}.m3u?res=${effectiveRes}${hostParam}&dl=1">&#128190; Lưu .M3U Vào Thẻ</a>
    </div>

    <div style="margin-top:5px;font-size:9px;color:#cbd5e1;">
      Link gõ vào CorePlayer &gt; Open URL:<br />
      <div class="code-link">${escapeHtml(shortTsUrl)}</div>
    </div>
  </div>

  <!-- MỤC 2: PHÁT VỚI REALPLAYER (TÍCH HỢP ROM S60) -->
  <div class="block-panel" style="border-color:#ef4444;background:#2d0607;">
    <strong style="color:#f87171;font-size:12px;">🔴 2. PHÁT BẰNG REALPLAYER S60</strong>
    <p style="font-size:9px;color:#fecaca;margin:2px 0 5px 0;">
      Ứng dụng gốc tích hợp sẵn trên Nokia E72 (Không cần cài thêm app):
    </p>

    <!-- Nút gọi trực tiếp RealPlayer -->
    <a class="btn-single-real" href="${launchRealPlayerUrl}">
      &#9654; KÍCH HOẠT REALPLAYER (TỰ ĐỘNG)
    </a>
    <div style="font-size:9px;color:#fca5a5;text-align:center;margin-bottom:4px;">
      (Hệ thống Symbian S60 tự mở RealPlayer.exe)
    </div>

    <div style="text-align:center;">
      <a class="btn-mini" href="${chRealMp4}">&#127916; Luồng MP4 Trực Tiếp</a>
      <a class="btn-mini" href="${rtspUrl}">&#128246; Link RTSP Gốc</a>
      <a class="btn-mini" href="${chRealRamDl}">&#128190; Lưu .RAM Vào Thẻ</a>
    </div>

    <div style="margin-top:5px;font-size:9px;color:#cbd5e1;">
      Link gõ vào RealPlayer &gt; Open URL:<br />
      <div class="code-link">${escapeHtml(shortMp4Url)}</div>
    </div>
  </div>

  <!-- NÚT QUAY LẠI DANH SÁCH -->
  <div style="text-align:center;margin:8px 0;">
    <a class="btn-mini" style="background:#1e293b;padding:5px 12px;font-size:11px;font-weight:bold;" href="/legacy?res=${effectiveRes}&player=${playerChoice}${hostParam}">
      &laquo; QUAY LẠI DANH SÁCH KÊNH
    </a>
  </div>

  <div class="bottom-footer">
    <a href="/legacy${hostParam}">&laquo; Danh sách kênh</a> |
    <a href="/legacy/guide?res=${effectiveRes}&player=${playerChoice}${hostParam}">Hướng dẫn E72</a>
  </div>
</body>
</html>`;
}

export function renderCorePlayerGuide(host: string = '', resChoice: string = '240p'): string {
  const displayHost = host || (typeof process !== 'undefined' && process.env?.RENDER_EXTERNAL_HOSTNAME) || '192.168.1.xxx:3000';
  const sampleCore = `http://${displayHost}/c/1.ts?res=240p`;
  const sampleReal = `http://${displayHost}/c/1.mp4?res=240p`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Cẩm Nang IPTV Cho Nokia E72</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="top-header">
    <div class="brand-title">📖 CẨM NANG IPTV NOKIA E72</div>
    <div class="brand-sub">Kỹ Thuật Gọi Ứng Dụng CorePlayer &amp; RealPlayer Từ Web</div>
  </div>

  <!-- PHẦN 1: CƠ CHẾ GỌI ỨNG DỤNG TỰ ĐỘNG -->
  <div class="block-panel" style="background:#0f2b48;border-color:#38bdf8;">
    <strong style="color:#38bdf8;font-size:11px;">1. CƠ CHẾ GỌI ỨNG DỤNG TRỰC TIẾP TỪ TRÌNH DUYỆT:</strong>
    <p style="font-size:10px;margin:3px 0;line-height:1.4;">
      &bull; <b>Nút [ ▶ COREPLAYER ]:</b> Trả về file manifest <code>.m3u</code> với tiêu đề <code>Content-Disposition: inline</code> và MIME <code>audio/x-mpegurl</code>. Khi Opera Mini hoặc Nokia Browser nhận được, hệ thống Symbian S60 sẽ kích hoạt CorePlayer để mở luồng ngay!<br />
      &bull; <b>Nút [ ▶ REALPLAYER ]:</b> Trả về file <code>.ram</code> với MIME <code>audio/x-pn-realaudio</code>. Symbian OS lập tức chuyển tiếp đến <code>RealPlayer.exe</code> tích hợp sẵn trong máy.
    </p>
  </div>

  <!-- PHẦN 2: CÁCH BẬT MỞ TỰ ĐỘNG TRONG OPERA MINI -->
  <div class="block-panel" style="background:#052e16;border-color:#22c55e;">
    <strong style="color:#4ade80;font-size:11px;">2. THIẾT LẬP MỞ 1-CHẠM TRÊN OPERA MINI:</strong>
    <p style="font-size:10px;margin:3px 0;line-height:1.4;">
      Trong Opera Mini &gt; <b>Cài đặt &gt; Nâng cao &gt; Tải xuống:</b><br />
      &bull; Chọn <b>"Mở các tệp phương tiện tự động"</b>.<br />
      &bull; Sau khi bật, chỉ cần bấm nút trên web là máy tự động phát kênh mà không cần nhấn xác nhận thêm!
    </p>
  </div>

  <!-- PHẦN 3: TỐI ƯU CẤU HÌNH COREPLAYER CHO E72 -->
  <div class="block-panel">
    <strong style="color:#f59e0b;font-size:11px;">3. CẤU HÌNH COREPLAYER 1.36 (TRÁNH TRÀN 128MB RAM):</strong>
    <div style="font-size:10px;margin-top:3px;line-height:1.4;">
      Mở CorePlayer &gt; <b>Menu &gt; Tools &gt; Preferences:</b><br />
      &bull; <b>Video Output:</b> Chọn <b>DirectDraw</b> (tối ưu phần cứng, giảm tải CPU ARM11 600MHz).<br />
      &bull; <b>Buffer Size (Bộ đệm mạng):</b> Chọn <b>256 KB</b> đến <b>512 KB</b> (không đặt 1MB+ để tránh đầy RAM E72).<br />
      &bull; <b>Pre-buffer:</b> Đặt <b>15% - 20%</b> để bắt đầu phát nhanh chóng.
    </div>
  </div>

  <!-- PHẦN 4: CẤU HÌNH REALPLAYER -->
  <div class="block-panel">
    <strong style="color:#f87171;font-size:11px;">4. CẤU HÌNH REALPLAYER GỐC CỦA SYMBIAN S60:</strong>
    <div style="font-size:10px;margin-top:3px;line-height:1.4;">
      Mở RealPlayer &gt; <b>Tùy chọn &gt; Cài đặt &gt; Truyền phát (Streaming):</b><br />
      &bull; <b>Điểm truy cập mạng:</b> Chọn điểm Wi-Fi nhà bạn hoặc cấu hình 3G Viettel/Vinaphone.<br />
      &bull; <b>Thời gian trực tuyến:</b> Đặt <b>Không giới hạn</b>.<br />
      &bull; <b>Cổng proxy:</b> Tắt proxy (Không sử dụng).
    </div>
  </div>

  <!-- PHẦN 5: LINK MẪU GÕ TAY -->
  <div class="block-panel">
    <strong style="color:#cbd5e1;font-size:11px;">5. LINK MẪU NHẬP VÀO MENU OPEN URL:</strong>
    <div style="font-size:9px;margin:3px 0;">
      CorePlayer: <div class="code-link">${escapeHtml(sampleCore)}</div>
      RealPlayer: <div class="code-link">${escapeHtml(sampleReal)}</div>
    </div>
  </div>

  <div style="text-align:center;margin:8px 0;">
    <a class="btn-mini" style="background:#0284c7;color:#fff !important;padding:5px 12px;font-size:11px;font-weight:bold;" href="/legacy${host ? `?host=${encodeURIComponent(host)}` : ''}">
      &laquo; QUAY LẠI DANH SÁCH KÊNH
    </a>
  </div>

  <div class="bottom-footer">
    <a href="/legacy${host ? `?host=${encodeURIComponent(host)}` : ''}">Danh sách kênh</a> |
    <a href="/api/channels/coreplayer.m3u${host ? `?host=${encodeURIComponent(host)}` : ''}&dl=1">Tải M3U CorePlayer</a> |
    <a href="/realplayer.ram${host ? `?host=${encodeURIComponent(host)}` : ''}&dl=1">Tải RAM RealPlayer</a>
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
  <title>404 - Không tìm thấy kênh</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="top-header">
    <div class="brand-title">KHÔNG TÌM THẤY KÊNH</div>
  </div>
  <div class="block-panel" style="text-align:center;padding:14px;">
    <p>Kênh hoặc đường dẫn bạn yêu cầu không tồn tại hoặc đã được cập nhật.</p>
    <a class="btn-mini" style="background:#0284c7;color:#fff !important;padding:4px 8px;font-weight:bold;" href="/legacy">&#171; QUAY VỀ TRANG CHỦ</a>
  </div>
  <div class="bottom-footer">
    <a href="/legacy">MY IPTV S60</a>
  </div>
</body>
</html>`;
}
