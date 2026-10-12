import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  getAdminCredentials,
  generateToken,
  verifyToken,
  requireAdminAuth,
} from '../src/auth/adminAuth.js';
import {
  getPlaylists,
  getPlaylistById,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  syncPlaylist,
  syncAllPlaylists,
  getAllChannelsAdmin,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  testStreamUrl,
  purgeOfflineChannels,
  getStorageInfo,
} from '../src/db/storage.js';
import { generateM3U } from '../utils/m3uParser.js';

const router = Router();

// -----------------------------------------------------------------------------
// AUTH ENDPOINTS
// -----------------------------------------------------------------------------

router.post('/api/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body;
  const creds = getAdminCredentials();

  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  }

  // Constant time comparison to prevent timing attacks
  const userBuf = Buffer.from(username.trim());
  const expectedUserBuf = Buffer.from(creds.username);
  const passBuf = Buffer.from(password.trim());
  const expectedPassBuf = Buffer.from(creds.password);

  const userMatch = userBuf.length === expectedUserBuf.length && crypto.timingSafeEqual(userBuf, expectedUserBuf);
  const passMatch = passBuf.length === expectedPassBuf.length && crypto.timingSafeEqual(passBuf, expectedPassBuf);

  if (!userMatch || !passMatch) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
  }

  const token = generateToken(creds.username);
  res.json({
    success: true,
    token,
    username: creds.username,
  });
});

router.get('/api/admin/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ authenticated: false });
  }
  const token = authHeader.substring(7);
  const result = verifyToken(token);
  res.json({ authenticated: result.valid, username: result.username });
});

// All following routes require admin auth
router.use('/api/admin', requireAdminAuth);

// -----------------------------------------------------------------------------
// PLAYLISTS MANAGEMENT
// -----------------------------------------------------------------------------

router.get('/api/admin/playlists', async (_req: Request, res: Response) => {
  try {
    const playlists = await getPlaylists();
    // Sort playlists with most channels first
    const sorted = [...playlists].sort((a, b) => {
      const diff = (b.channel_count || 0) - (a.channel_count || 0);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
    res.json(sorted);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists', async (req: Request, res: Response) => {
  try {
    const { name, type, url, content, enabled } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tên playlist không được để trống.' });
    }
    if (type === 'url' && !url) {
      return res.status(400).json({ error: 'Vui lòng nhập URL của playlist M3U.' });
    }
    if (type === 'content' && !content) {
      return res.status(400).json({ error: 'Vui lòng dán nội dung playlist M3U.' });
    }

    const playlist = await createPlaylist({
      name: name.trim(),
      type: type || 'url',
      url,
      content,
      enabled: enabled !== undefined ? enabled : true,
    });

    res.status(201).json(playlist);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/admin/playlists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, url, content, enabled } = req.body;

    const updated = await updatePlaylist(id, {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(url !== undefined ? { url: url.trim() } : {}),
      ...(content !== undefined ? { content } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
    });

    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy playlist.' });
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/admin/playlists/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await deletePlaylist(id);
    if (!success) {
      return res.status(404).json({ error: 'Không tìm thấy playlist để xóa.' });
    }
    res.json({ success: true, message: 'Đã xóa playlist và các kênh liên quan.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists/:id/refresh', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await syncPlaylist(id);
    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Cập nhật playlist thất bại.' });
    }
    const updated = await getPlaylistById(id);
    res.json({ success: true, count: result.count, playlist: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/playlists/refresh-all', async (_req: Request, res: Response) => {
  try {
    const result = await syncAllPlaylists();
    res.json({
      success: true,
      message: `Đã làm mới xong tất cả playlist (${result.totalSuccess} thành công, ${result.totalFailed} lỗi).`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// CHANNELS MANAGEMENT
// -----------------------------------------------------------------------------

router.get('/api/admin/channels', async (req: Request, res: Response) => {
  try {
    const { q, playlist_id, group } = req.query;
    let channels = await getAllChannelsAdmin();

    if (playlist_id && typeof playlist_id === 'string' && playlist_id !== 'all') {
      channels = channels.filter((c) => c.playlist_id === playlist_id);
    }

    if (group && typeof group === 'string' && group !== 'all') {
      channels = channels.filter((c) => c.group.toLowerCase() === group.toLowerCase());
    }

    if (q && typeof q === 'string' && q.trim()) {
      const query = q.toLowerCase().trim();
      channels = channels.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.group.toLowerCase().includes(query) ||
          (c.tvg_id && c.tvg_id.toLowerCase().includes(query)) ||
          c.stream_url.toLowerCase().includes(query)
      );
    }

    res.json(channels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/channels', async (req: Request, res: Response) => {
  try {
    const channelData = req.body;
    if (!channelData.name || !channelData.stream_url) {
      return res.status(400).json({ error: 'Tên kênh và URL stream là bắt buộc.' });
    }
    const created = await createChannel(channelData);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/admin/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channelData = req.body;
    const updated = await updateChannel(id, channelData);
    if (!updated) {
      return res.status(404).json({ error: 'Không tìm thấy kênh.' });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/api/admin/channels/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await deleteChannel(id);
    if (!success) {
      return res.status(404).json({ error: 'Không tìm thấy kênh để xóa.' });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

import {
  startBatchScan,
  stopBatchScan,
  getScanProgress,
  scanSingleChannel,
} from '../src/services/channelScanner.js';

// -----------------------------------------------------------------------------
// STREAM TEST & BATCH CHANNEL SCANNER
// -----------------------------------------------------------------------------

router.post('/api/admin/channels/scan-all', async (req: Request, res: Response) => {
  try {
    const concurrency = parseInt(req.body.concurrency as string, 10) || 15;
    const channelIds = Array.isArray(req.body.channelIds) ? req.body.channelIds : undefined;
    const group = typeof req.body.group === 'string' ? req.body.group : undefined;
    const scopeDescription = typeof req.body.scopeDescription === 'string' ? req.body.scopeDescription : undefined;
    const autoPurgeOffline = Boolean(req.body.autoPurgeOffline);

    await startBatchScan({
      concurrency,
      channelIds,
      group,
      scopeDescription,
      autoPurgeOffline,
    });
    res.json({ success: true, message: 'Đã bắt đầu tiến trình quét kênh', progress: getScanProgress() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/api/admin/channels/scan-status', (_req: Request, res: Response) => {
  res.json(getScanProgress());
});

router.post('/api/admin/channels/scan-stop', (_req: Request, res: Response) => {
  stopBatchScan();
  res.json({ success: true, message: 'Đã dừng tiến trình quét', progress: getScanProgress() });
});

router.post('/api/admin/channels/:id/scan', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const channel = await getChannelById(id);
    if (!channel) {
      return res.status(404).json({ error: 'Không tìm thấy kênh để quét.' });
    }
    const result = await scanSingleChannel(channel);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/api/admin/channels/reset-status', async (_req: Request, res: Response) => {
  try {
    const channels = await getAllChannelsAdmin();
    for (const ch of channels) {
      await updateChannel(ch.id, { status: 'active' });
    }
    res.json({ success: true, message: `Đã khôi phục trạng thái hoạt động cho ${channels.length} kênh.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa vĩnh viễn tất cả các kênh đang offline (kênh chết)
router.post('/api/admin/channels/purge-offline', async (_req: Request, res: Response) => {
  try {
    const result = await purgeOfflineChannels();
    res.json({
      success: true,
      message: `Đã dọn dẹp và xóa vĩnh viễn ${result.deletedCount} kênh bị lỗi! Còn lại ${result.remainingCount} kênh hoạt động tốt.`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tải về file channels.json đã lọc sạch kênh chết
router.get('/api/admin/channels/export-clean-json', async (_req: Request, res: Response) => {
  try {
    const allChannels = await getAllChannelsAdmin();
    const cleanChannels = allChannels.filter((c) => c.status !== 'offline');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="channels.json"');
    res.send(JSON.stringify(cleanChannels, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tải về toàn bộ dữ liệu kênh đã rà soát (bao gồm trạng thái online / offline)
router.get('/api/admin/channels/export-full-json', async (_req: Request, res: Response) => {
  try {
    const allChannels = await getAllChannelsAdmin();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="channels_scanned_full.json"');
    res.send(JSON.stringify(allChannels, null, 2));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Tải về file playlist M3U sạch chỉ chứa kênh online
router.get('/api/admin/channels/export-clean-m3u', async (_req: Request, res: Response) => {
  try {
    const allChannels = await getAllChannelsAdmin();
    const cleanChannels = allChannels.filter((c) => c.status !== 'offline');
    const m3uContent = generateM3U(cleanChannels);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="channels_clean.m3u"');
    res.send(m3uContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Thông tin lưu trữ và cơ sở dữ liệu hiện tại (Postgres hay Local JSON)
router.get('/api/admin/storage-status', async (_req: Request, res: Response) => {
  try {
    const info = await getStorageInfo();
    res.json(info);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper đẩy file lên GitHub qua GitHub Contents API
async function pushFileToGitHub(options: {
  token: string;
  repo: string;
  branch: string;
  path: string;
  content: string;
  message: string;
}) {
  const url = `https://api.github.com/repos/${options.repo}/contents/${options.path}`;

  // 1. Kiểm tra SHA nếu file đã tồn tại trên repo
  let sha: string | undefined;
  try {
    const checkRes = await fetch(`${url}?ref=${encodeURIComponent(options.branch)}`, {
      headers: {
        Authorization: `Bearer ${options.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'IPTV-Stream-App',
      },
    });
    if (checkRes.ok) {
      const checkData: any = await checkRes.json();
      sha = checkData.sha;
    }
  } catch {}

  // 2. Commit file mới lên GitHub (Base64)
  const base64Content = Buffer.from(options.content, 'utf-8').toString('base64');
  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${options.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'IPTV-Stream-App',
    },
    body: JSON.stringify({
      message: options.message,
      content: base64Content,
      sha,
      branch: options.branch,
    }),
  });

  if (!putRes.ok) {
    const errData: any = await putRes.json().catch(() => ({}));
    throw new Error(errData.message || `Lỗi GitHub API: HTTP ${putRes.status}`);
  }

  return await putRes.json();
}

// Đồng bộ đẩy dữ liệu đã quét thẳng lên GitHub
router.post('/api/admin/github-sync', async (req: Request, res: Response) => {
  try {
    const { githubToken, repo, branch = 'main', mode = 'clean_only' } = req.body;
    const token = githubToken?.trim() || process.env.GITHUB_TOKEN;

    if (!token) {
      return res.status(400).json({
        error: 'Vui lòng nhập GitHub Personal Access Token (PAT). Bạn có thể tạo tại GitHub Settings -> Developer Settings -> Personal access tokens (classic hoặc fine-grained với quyền Contents: Read and write).',
      });
    }
    if (!repo || !repo.includes('/')) {
      return res.status(400).json({
        error: 'Vui lòng nhập repository hợp lệ dạng: username/repo-name (ví dụ: lamphongstbg/my-iptv).',
      });
    }

    const cleanRepo = repo.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '');
    const cleanBranch = (branch && branch.trim()) || 'main';

    // Chuẩn bị dữ liệu kênh
    const allChannels = await getAllChannelsAdmin();
    let targetChannels = allChannels;
    if (mode === 'clean_only') {
      targetChannels = allChannels.filter((c) => c.status !== 'offline');
    }

    const channelsJsonStr = JSON.stringify(targetChannels, null, 2);

    // 1. Đẩy file data/channels.json
    const syncChannelsResult = await pushFileToGitHub({
      token,
      repo: cleanRepo,
      branch: cleanBranch,
      path: 'data/channels.json',
      content: channelsJsonStr,
      message: `chore: đồng bộ danh sách kênh IPTV đã rà soát (${targetChannels.length} kênh) [skip ci]`,
    });

    // 2. Đẩy file data/playlists.json
    const playlists = await getPlaylists();
    await pushFileToGitHub({
      token,
      repo: cleanRepo,
      branch: cleanBranch,
      path: 'data/playlists.json',
      content: JSON.stringify(playlists, null, 2),
      message: `chore: đồng bộ danh sách playlists IPTV [skip ci]`,
    }).catch((err) => console.warn('[GitHub Sync] Warning syncing playlists:', err));

    res.json({
      success: true,
      message: `Đã đồng bộ thành công ${targetChannels.length.toLocaleString('vi-VN')} kênh lên GitHub (${cleanRepo} / branch ${cleanBranch})! Render sẽ tự động kích hoạt deploy và áp dụng dữ liệu này.`,
      commitUrl: syncChannelsResult.commit?.html_url || `https://github.com/${cleanRepo}/tree/${cleanBranch}/data`,
      syncedChannelsCount: targetChannels.length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Lỗi trong quá trình đồng bộ lên GitHub.' });
  }
});

router.post('/api/admin/test-stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Thiếu tham số url để kiểm tra.' });
    }
    const result = await testStreamUrl(url.trim());
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN STATS
// -----------------------------------------------------------------------------

router.get('/api/admin/stats', async (_req: Request, res: Response) => {
  try {
    const playlists = await getPlaylists();
    const channels = await getAllChannelsAdmin();

    const groupsSet = new Set<string>();
    const groupCounts: Record<string, number> = {};
    let activeChannels = 0;
    let offlineChannels = 0;
    for (const c of channels) {
      if (c.group && c.group.trim()) {
        const g = c.group.trim();
        groupsSet.add(g);
        groupCounts[g] = (groupCounts[g] || 0) + 1;
      }
      if (c.status === 'offline') {
        offlineChannels++;
      } else {
        activeChannels++;
      }
    }

    const sortedGroups = Array.from(groupsSet).sort((a, b) => {
      const diff = (groupCounts[b] || 0) - (groupCounts[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });

    res.json({
      totalPlaylists: playlists.length,
      activePlaylists: playlists.filter((p) => p.enabled).length,
      totalChannels: channels.length,
      activeChannels,
      offlineChannels,
      groups: sortedGroups,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
