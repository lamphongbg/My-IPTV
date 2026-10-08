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
    background-color: #1a1a1a;
    color: #e6e6e6;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    line-height: 1.4;
    margin: 0;
    padding: 6px;
  }
  a {
    color: #4da6ff;
    text-decoration: underline;
  }
  a:focus, a:hover, a:active {
    background-color: #ffd700;
    color: #000000;
    outline: 2px solid #ffffff;
  }
  .detect-banner {
    background-color: #143621;
    color: #86efac;
    padding: 4px 6px;
    font-size: 11px;
    text-align: center;
    border: 1px solid #22c55e;
    margin-bottom: 6px;
    font-weight: bold;
  }
  .header {
    background-color: #0d3b66;
    color: #ffffff;
    padding: 8px 6px;
    text-align: center;
    border-bottom: 2px solid #f4d35e;
    margin-bottom: 8px;
  }
  .header h1 {
    font-size: 16px;
    margin: 0 0 4px 0;
    text-transform: uppercase;
  }
  .search-panel {
    background-color: #242424;
    border: 1px solid #444;
    padding: 8px 6px;
    margin-bottom: 8px;
  }
  .form-group {
    margin-bottom: 6px;
  }
  .form-label {
    display: block;
    font-size: 12px;
    font-weight: bold;
    color: #f4d35e;
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
  }
  .btn-search {
    width: 96%;
    padding: 6px 10px;
    font-size: 13px;
    background-color: #f4d35e;
    color: #000000;
    font-weight: bold;
    border: 1px solid #000000;
    cursor: pointer;
    margin-top: 4px;
    display: block;
    text-align: center;
  }
  .filter-status {
    background-color: #1a2733;
    border: 1px solid #2e5170;
    padding: 5px 8px;
    margin-bottom: 8px;
    font-size: 12px;
    color: #b8daf8;
  }
  .channel-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .channel-item {
    background-color: #242424;
    border-bottom: 1px solid #383838;
    padding: 8px 6px;
    margin-bottom: 4px;
  }
  .channel-link {
    font-size: 14px;
    font-weight: bold;
    color: #ffffff;
    text-decoration: none;
    display: block;
    margin-bottom: 4px;
  }
  .channel-group-tag {
    display: inline-block;
    background-color: #0d3b66;
    color: #f4d35e;
    font-size: 11px;
    padding: 1px 4px;
    margin-right: 4px;
  }
  .btn {
    display: inline-block;
    padding: 6px 10px;
    margin: 4px 2px;
    background-color: #0d3b66;
    color: #ffffff !important;
    text-decoration: none;
    border: 1px solid #66b2ff;
    font-weight: bold;
    font-size: 12px;
    text-align: center;
  }
  .btn-coreplayer {
    background-color: #b33939;
    border-color: #ff5252;
    color: #ffffff !important;
    font-size: 13px;
    display: block;
    width: 90%;
    margin: 8px auto;
    padding: 8px;
  }
  .btn-stream {
    background-color: #218c74;
    border-color: #33d9b2;
    color: #ffffff !important;
    font-size: 13px;
    display: block;
    width: 90%;
    margin: 8px auto;
    padding: 8px;
  }
  .pagination {
    text-align: center;
    padding: 8px 0;
    margin-top: 8px;
    border-top: 1px dashed #555;
  }
  .pagination a, .pagination span {
    padding: 4px 8px;
    margin: 0 2px;
    display: inline-block;
    background-color: #333;
    border: 1px solid #555;
    font-size: 12px;
  }
  .pagination span.current {
    background-color: #f4d35e;
    color: #000;
    font-weight: bold;
  }
  .box {
    background-color: #262626;
    border: 1px solid #444;
    padding: 8px;
    margin-bottom: 8px;
  }
  .url-box {
    background-color: #000000;
    color: #00ff66;
    padding: 6px;
    font-family: Courier New, monospace;
    font-size: 11px;
    word-break: break-all;
    border: 1px solid #333;
    margin: 6px 0;
  }
  .guide-step {
    margin-bottom: 4px;
    font-size: 12px;
    color: #dcdde1;
  }
  .footer {
    text-align: center;
    padding: 10px 4px;
    margin-top: 12px;
    border-top: 1px solid #444;
    font-size: 11px;
    color: #888888;
  }
  .footer a {
    color: #aaa;
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
}): string {
  const { channels, totalChannels, currentPage, totalPages, currentGroup, groups, searchQuery = '' } = options;

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

  // Channel items
  let channelItems = '';
  if (channels.length === 0) {
    channelItems = '<li class="channel-item" style="text-align:center;padding:16px;">Không tìm thấy kênh nào phù hợp với bộ lọc.</li>';
  } else {
    for (let i = 0; i < channels.length; i++) {
      const ch = channels[i];
      const indexNum = (currentPage - 1) * 10 + i + 1;
      channelItems += `
        <li class="channel-item">
          <a class="channel-link" href="/legacy/channel/${encodeURIComponent(ch.id)}">
            ${indexNum}. ${escapeHtml(ch.name)}
          </a>
          <div>
            <span class="channel-group-tag">${escapeHtml(ch.group)}</span>
            <span style="font-size:11px;color:#aaa;">${escapeHtml(ch.resolution || 'HD')} / ${escapeHtml(ch.format.toUpperCase())}</span>
          </div>
          <div style="margin-top:4px;">
            <a class="btn" style="background-color:#b33939;padding:3px 6px;" href="/open/${encodeURIComponent(ch.id)}">[ Mở CorePlayer ]</a>
            <a class="btn" style="padding:3px 6px;" href="/legacy/channel/${encodeURIComponent(ch.id)}">[ Chi tiết ]</a>
          </div>
        </li>
      `;
    }
  }

  // Pagination
  let paginationHtml = '<div class="pagination">';
  if (currentPage > 1) {
    paginationHtml += `<a href="/legacy?page=${currentPage - 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}">&laquo; Trang trước</a>`;
  }
  paginationHtml += ` <span class="current">Trang ${currentPage}/${totalPages}</span> `;
  if (currentPage < totalPages) {
    paginationHtml += `<a href="/legacy?page=${currentPage + 1}&group=${encodeURIComponent(currentGroup)}&q=${encodeURIComponent(searchQuery)}">Trang sau &raquo;</a>`;
  }
  paginationHtml += '</div>';

  const isFiltering = currentGroup !== 'all' || Boolean(searchQuery.trim());

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>MY IPTV - Nokia E72 / Symbian S60</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; TỰ ĐỘNG NHẬN DIỆN THIẾT BỊ: NOKIA E72 / S60 (Giao diện siêu nhẹ)
  </div>

  <div class="header">
    <h1>MY IPTV - S60 / E72</h1>
    <div style="font-size:11px;color:#ddd;">Tương thích CorePlayer &amp; Symbian 3rd Ed</div>
  </div>

  <!-- DROPDOWN & TÌM KIẾM CHO NOKIA E72 -->
  <div class="search-panel">
    <form action="/legacy" method="GET">
      <div class="form-group">
        <label class="form-label" for="search-input">1. Tìm kiếm tên kênh:</label>
        <input class="input-text" type="text" id="search-input" name="q" value="${escapeHtml(searchQuery)}" placeholder="Nhập tên kênh (vd: VTV1, Bóng đá)..." />
      </div>

      <div class="form-group">
        <label class="form-label" for="group-select">2. Chọn nhóm kênh (Danh sách thả xuống):</label>
        <select class="select-box" id="group-select" name="group">
          ${optionsHtml}
        </select>
      </div>

      <div>
        <input class="btn-search" type="submit" value="&#128269; TÌM KIẾM &amp; LỌC KÊNH" />
      </div>

      ${isFiltering ? `
      <div style="text-align:center;margin-top:6px;">
        <a href="/legacy" style="color:#ff6b6b;font-size:12px;font-weight:bold;">[ Xóa tìm kiếm / Xem tất cả kênh ]</a>
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

  <ul class="channel-list">
    ${channelItems}
  </ul>

  ${totalPages > 1 ? paginationHtml : ''}

  <div class="box" style="margin-top:10px;">
    <strong>Hướng dẫn Nokia E72:</strong>
    <div class="guide-step">&#8226; Chọn kênh và bấm <b>[ Mở CorePlayer ]</b>.</div>
    <div class="guide-step">&#8226; Hoặc copy URL stream dán vào CorePlayer &gt; Open URL.</div>
  </div>

  <div class="footer">
    <div>Chế độ: <b>Nokia E72 / S60 (Giao diện thả xuống)</b></div>
    <div style="margin-top:6px;">
      <a href="/?view=modern">[ Chuyển sang Bản Hiện Đại ]</a> |
      <a href="/?view=reset">[ Khôi phục Tự Động ]</a> |
      <a href="/playlist.m3u">[ Tải M3U Playlist ]</a>
    </div>
  </div>
</body>
</html>`;
}

export function renderLegacyChannel(channel: Channel): string {
  const directOpenUrl = `/open/${encodeURIComponent(channel.id)}`;
  const directStreamUrl = channel.stream_url;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${escapeHtml(channel.name)} - MY IPTV</title>
  <style type="text/css">
${LEGACY_CSS}
  </style>
</head>
<body>
  <div class="detect-banner">
    &#10003; TỰ ĐỘNG NHẬN DIỆN: NOKIA E72 / S60
  </div>

  <div class="header">
    <h1>${escapeHtml(channel.name)}</h1>
    <div style="font-size:11px;color:#f4d35e;">Nhóm: ${escapeHtml(channel.group)}</div>
  </div>

  <div class="box" style="text-align:center;">
    <a class="btn-coreplayer" href="${directOpenUrl}">
      &#9654; MỞ BẰNG COREPLAYER
    </a>

    <a class="btn-stream" href="${escapeHtml(directStreamUrl)}">
      &#9654; MỞ STREAM TRỰC TIẾP (HTTP)
    </a>

    <div style="margin: 8px 0;">
      <a class="btn" href="/legacy">&laquo; QUAY LẠI DANH SÁCH</a>
    </div>
  </div>

  <div class="box">
    <strong>URL STREAM (Nhấn giữ để copy):</strong>
    <div class="url-box">${escapeHtml(directStreamUrl)}</div>
    <textarea rows="2" style="width:96%;font-size:11px;background:#111;color:#0f6;border:1px solid #444;" readonly="readonly">${escapeHtml(directStreamUrl)}</textarea>
  </div>

  <div class="box">
    <strong>HƯỚNG DẪN XEM TRÊN NOKIA E72:</strong>
    <div class="guide-step"><b>Cách 1:</b> Nhấn nút <b>[ MỞ BẰNG COREPLAYER ]</b> ở trên. Nếu điện thoại hỏi ứng dụng, chọn CorePlayer.</div>
    <div class="guide-step"><b>Cách 2 (Thủ công chuẩn nhất):</b></div>
    <div class="guide-step">1. Nhấn giữ hoặc bôi đen URL màu xanh lá cây ở trên rồi bấm <b>Copy (Sao chép)</b>.</div>
    <div class="guide-step">2. Khởi động ứng dụng <b>CorePlayer</b> trên Nokia E72.</div>
    <div class="guide-step">3. Chọn <b>Menu &gt; Open URL... (Mở URL)</b>.</div>
    <div class="guide-step">4. Dán (Paste) URL đã copy và bấm <b>OK / Play</b>.</div>
  </div>

  <div class="box">
    <strong>THÔNG SỐ KỸ THUẬT:</strong>
    <div style="font-size:11px;color:#bbb;">
      &#8226; Định dạng: <b>${escapeHtml(channel.format.toUpperCase())}</b><br />
      &#8226; Video Codec: <b>${escapeHtml(channel.video_codec || 'H.264')}</b><br />
      &#8226; Audio Codec: <b>${escapeHtml(channel.audio_codec || 'AAC')}</b><br />
      &#8226; Độ phân giải: <b>${escapeHtml(channel.resolution || 'HD')}</b><br />
      ${channel.description ? `&#8226; Mô tả: ${escapeHtml(channel.description)}` : ''}
    </div>
  </div>

  <div class="footer">
    <a href="/legacy">&laquo; Danh sách kênh</a> |
    <a href="/?view=modern">Bản hiện đại</a> |
    <a href="/?view=reset">Khôi phục Tự Động</a>
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
