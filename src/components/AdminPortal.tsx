import React, { useState, useEffect } from 'react';
import { Playlist, Channel, StreamTestResult, AdminStats } from '../types/iptv';
import { VideoPlayer } from './VideoPlayer';
import {
  Shield,
  Layers,
  Tv,
  Activity,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Lock,
  LogOut,
  ArrowLeft,
  Search,
  Upload,
  Globe,
  FileText,
  Play,
  Database,
  Check,
  X
} from 'lucide-react';

const ADMIN_TOKEN_KEY = 'my_iptv_admin_token';

interface AdminPortalProps {
  onBackToApp: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ onBackToApp }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(ADMIN_TOKEN_KEY));
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'playlists' | 'channels' | 'tester'>('playlists');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Forms
  const [isAddPlaylistOpen, setIsAddPlaylistOpen] = useState<boolean>(false);
  const [playlistForm, setPlaylistForm] = useState({
    name: '',
    type: 'url' as 'url' | 'content',
    url: '',
    content: '',
    enabled: true,
  });

  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);

  const [isChannelModalOpen, setIsChannelModalOpen] = useState<boolean>(false);
  const [channelForm, setChannelForm] = useState<Partial<Channel>>({
    name: '',
    group: 'VTV',
    logo: '',
    stream_url: '',
    format: 'hls',
    tvg_id: '',
    tvg_name: '',
    status: 'active',
  });
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [previewChannel, setPreviewChannel] = useState<Channel | null>(null);

  // Filter & Search in Channels tab
  const [channelSearch, setChannelSearch] = useState<string>('');
  const [filterPlaylist, setFilterPlaylist] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Stream probe state
  const [testUrlInput, setTestUrlInput] = useState<string>('');
  const [testResult, setTestResult] = useState<StreamTestResult | null>(null);
  const [isTestingStream, setIsTestingStream] = useState<boolean>(false);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);

  // Check login status on mount
  useEffect(() => {
    if (token) {
      fetchAdminData();
    }
  }, [token]);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Đăng nhập không thành công');
      }

      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      setToken(data.token);
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Lỗi đăng nhập');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken(null);
  };

  const fetchAdminData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [statsRes, playlistsRes, channelsRes] = await Promise.all([
        fetch('/api/admin/stats', { headers: authHeaders() }),
        fetch('/api/admin/playlists', { headers: authHeaders() }),
        fetch('/api/admin/channels', { headers: authHeaders() }),
      ]);

      if (statsRes.status === 401 || playlistsRes.status === 401) {
        handleLogout();
        return;
      }

      if (statsRes.ok) setStats(await statsRes.json());
      if (playlistsRes.ok) setPlaylists(await playlistsRes.json());
      if (channelsRes.ok) setChannels(await channelsRes.json());
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // PLAYLIST ACTIONS
  // ---------------------------------------------------------------------------

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistForm.name.trim()) {
      showNotification('Vui lòng nhập tên playlist', 'error');
      return;
    }

    try {
      const res = await fetch('/api/admin/playlists', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(playlistForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo playlist thất bại');

      showNotification(`Đã tạo playlist "${data.name}" và đồng bộ ${data.channel_count} kênh!`);
      setIsAddPlaylistOpen(false);
      setPlaylistForm({ name: '', type: 'url', url: '', content: '', enabled: true });
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleTogglePlaylist = async (playlist: Playlist) => {
    try {
      const res = await fetch(`/api/admin/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !playlist.enabled }),
      });
      if (!res.ok) throw new Error('Không thể thay đổi trạng thái');
      showNotification(`Đã ${!playlist.enabled ? 'bật' : 'tắt'} playlist "${playlist.name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleRefreshPlaylist = async (id: string, name: string) => {
    showNotification(`Đang làm mới playlist "${name}"...`);
    try {
      const res = await fetch(`/api/admin/playlists/${id}/refresh`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cập nhật playlist thất bại');
      showNotification(`Playlist "${name}" cập nhật thành công (${data.count} kênh)!`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleRefreshAll = async () => {
    showNotification('Đang làm mới tất cả playlist...');
    try {
      const res = await fetch('/api/admin/playlists/refresh-all', {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi làm mới');
      showNotification(data.message);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeletePlaylist = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa playlist "${name}" và toàn bộ kênh của nó?`)) return;
    try {
      const res = await fetch(`/api/admin/playlists/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Xóa playlist thất bại');
      showNotification(`Đã xóa playlist "${name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPlaylistForm((prev) => ({
        ...prev,
        type: 'content',
        content,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
      }));
    };
    reader.readAsText(file);
  };

  // ---------------------------------------------------------------------------
  // CHANNEL ACTIONS
  // ---------------------------------------------------------------------------

  const handleSaveChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelForm.name || !channelForm.stream_url) {
      showNotification('Tên kênh và URL stream là bắt buộc', 'error');
      return;
    }

    try {
      if (editingChannelId) {
        // Update
        const res = await fetch(`/api/admin/channels/${editingChannelId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(channelForm),
        });
        if (!res.ok) throw new Error('Cập nhật kênh thất bại');
        showNotification(`Đã lưu thay đổi cho kênh "${channelForm.name}"`);
      } else {
        // Create
        const res = await fetch('/api/admin/channels', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(channelForm),
        });
        if (!res.ok) throw new Error('Thêm kênh mới thất bại');
        showNotification(`Đã thêm kênh mới "${channelForm.name}"`);
      }

      setIsChannelModalOpen(false);
      setEditingChannelId(null);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleDeleteChannel = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa kênh "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/channels/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Xóa kênh thất bại');
      showNotification(`Đã xóa kênh "${name}"`);
      fetchAdminData();
    } catch (err: any) {
      showNotification(err.message, 'error');
    }
  };

  const handleTestChannelStream = async (url: string, channelId?: string) => {
    if (channelId) setTestingChannelId(channelId);
    else setIsTestingStream(true);

    try {
      const res = await fetch('/api/admin/test-stream', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ url }),
      });
      const data: StreamTestResult = await res.json();
      setTestResult(data);
      if (channelId) {
        showNotification(`${data.status === 'online' ? '✅' : '⚠️'} ${data.message}`);
      }
    } catch (err: any) {
      showNotification('Không thể kiểm tra luồng phát', 'error');
    } finally {
      setTestingChannelId(null);
      setIsTestingStream(false);
    }
  };

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    if (filterPlaylist !== 'all' && c.playlist_id !== filterPlaylist) return false;
    if (filterGroup !== 'all' && c.group.toLowerCase() !== filterGroup.toLowerCase()) return false;
    if (channelSearch.trim()) {
      const q = channelSearch.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q) ||
        (c.tvg_id && c.tvg_id.toLowerCase().includes(q)) ||
        c.stream_url.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ---------------------------------------------------------------------------
  // RENDER LOGIN SCREEN IF NOT AUTHENTICATED
  // ---------------------------------------------------------------------------
  if (!token) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={onBackToApp}
              className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Về trang chủ IPTV</span>
            </button>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
          </div>

          <h2 className="text-xl font-bold text-white tracking-tight">Đăng Nhập Quản Trị IPTV</h2>
          <p className="text-xs text-neutral-400 mt-1 mb-6">
            Quản lý playlist M3U, danh mục kênh, và kiểm tra luồng phát trực tiếp.
          </p>

          {loginError && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Tên đăng nhập (ADMIN_USERNAME)
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                Mật khẩu (ADMIN_PASSWORD)
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10 mt-2"
            >
              {isLoggingIn ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              <span>Đăng nhập trang quản trị</span>
            </button>
          </form>

          <div className="mt-6 p-3 bg-neutral-950 border border-neutral-800/80 rounded-xl text-[11px] text-neutral-400 leading-relaxed">
            <strong className="text-amber-400">Gợi ý bảo mật:</strong> Mặc định cấu hình <code className="text-neutral-200">admin</code> / <code className="text-neutral-200">admin123</code>. Trên Render, bạn có thể thay đổi bằng biến môi trường <code className="text-neutral-200">ADMIN_USERNAME</code> và <code className="text-neutral-200">ADMIN_PASSWORD</code>.
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN ADMIN DASHBOARD
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-neutral-950 font-black shadow-md">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-sm sm:text-base text-white">Quản Trị MY IPTV</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Online
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">Hệ thống quản lý Playlist &amp; Luồng phát</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshAll}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Đồng bộ lại toàn bộ playlist đang bật"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Refresh All Playlists</span>
            </button>

            <button
              onClick={onBackToApp}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
            >
              <Tv className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Xem IPTV</span>
            </button>

            <button
              onClick={handleLogout}
              className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Notifications Toast */}
      {actionMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl border shadow-2xl flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-5 duration-200 ${
            actionMessage.type === 'success'
              ? 'bg-neutral-900 border-emerald-500/50 text-emerald-300'
              : 'bg-neutral-900 border-rose-500/50 text-rose-300'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-5 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Playlists</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.totalPlaylists ?? playlists.length}</span>
              <span className="text-xs text-emerald-400 font-medium">({stats?.activePlaylists ?? 0} bật)</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Tổng số kênh</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.totalChannels ?? channels.length}</span>
              <span className="text-xs text-neutral-400">kênh</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Danh mục</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold text-white">{stats?.groups.length ?? 0}</span>
              <span className="text-xs text-neutral-400">nhóm</span>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">Lưu trữ</span>
            <div className="flex items-center gap-1.5 mt-1 text-xs font-medium text-amber-400">
              <Database className="w-3.5 h-3.5" />
              <span>PostgreSQL / Persistent</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-2 text-xs">
          <button
            onClick={() => setActiveTab('playlists')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'playlists'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Quản Lý Playlist ({playlists.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('channels')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'channels'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Quản Lý Kênh ({channels.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center gap-1.5 transition ${
              activeTab === 'tester'
                ? 'bg-amber-500 text-neutral-950 shadow'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Kiểm Tra Luồng (Probe)</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------- */}
        {/* TAB 1: PLAYLISTS MANAGEMENT */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'playlists' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Danh sách Playlist IPTV</h3>
                <p className="text-xs text-neutral-400">
                  Hỗ trợ thêm URL online, dán trực tiếp, hoặc tải lên file .m3u
                </p>
              </div>

              <button
                onClick={() => setIsAddPlaylistOpen(true)}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition shadow"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Playlist M3U</span>
              </button>
            </div>

            {/* Playlists Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Tên Playlist</th>
                      <th className="py-3 px-4">Loại &amp; Nguồn</th>
                      <th className="py-3 px-4">Số Kênh</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4">Cập Nhật</th>
                      <th className="py-3 px-4 text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {playlists.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          Chưa có playlist nào. Hãy bấm "+ Thêm Playlist M3U" để bắt đầu.
                        </td>
                      </tr>
                    ) : (
                      playlists.map((pl) => (
                        <tr key={pl.id} className="hover:bg-neutral-850/50 transition">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{pl.name}</span>
                              {pl.status === 'error' && (
                                <span
                                  className="text-rose-400 hover:text-rose-300"
                                  title={pl.error_message || 'Lỗi cập nhật playlist'}
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </span>
                              )}
                            </div>
                            {pl.error_message && (
                              <p className="text-[10px] text-rose-400 mt-0.5 line-clamp-1">{pl.error_message}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-neutral-300">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-neutral-800 text-neutral-300 border border-neutral-700">
                              {pl.type === 'url' ? 'URL M3U' : 'Raw Content'}
                            </span>
                            {pl.url && (
                              <p className="text-[10px] text-neutral-400 mt-1 truncate max-w-xs">{pl.url}</p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold text-neutral-200">
                            {pl.channel_count} kênh
                          </td>
                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => handleTogglePlaylist(pl)}
                              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition ${
                                pl.enabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                              }`}
                            >
                              {pl.enabled ? 'ON' : 'OFF'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-neutral-400 text-[11px]">
                            {new Date(pl.last_updated).toLocaleString('vi-VN')}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleRefreshPlaylist(pl.id, pl.name)}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Đồng bộ lại"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeletePlaylist(pl.id, pl.name)}
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                                title="Xóa playlist"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 2: CHANNELS MANAGEMENT */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'channels' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Danh sách Kênh Truyền Hình</h3>
                <p className="text-xs text-neutral-400">
                  Xem, tìm kiếm, chỉnh sửa codec, thông số, và kiểm tra URL stream
                </p>
              </div>

              <button
                onClick={() => {
                  setEditingChannelId(null);
                  setChannelForm({
                    name: '',
                    group: 'VTV',
                    logo: '',
                    stream_url: '',
                    format: 'hls',
                    status: 'active',
                  });
                  setIsChannelModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Thêm Kênh Thủ Công</span>
              </button>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Tìm kiếm kênh theo tên, nhóm, tvg-id, URL..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <select
                value={filterPlaylist}
                onChange={(e) => setFilterPlaylist(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
              >
                <option value="all">Tất cả Playlist ({playlists.length})</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
              >
                <option value="all">Tất cả Nhóm/Thể loại</option>
                {stats?.groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Channels Table */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow">
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] tracking-wider border-b border-neutral-800 sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4">Kênh</th>
                      <th className="py-3 px-4">Nhóm</th>
                      <th className="py-3 px-4">Định Dạng</th>
                      <th className="py-3 px-4">URL Luồng Phát</th>
                      <th className="py-3 px-4">Trạng Thái</th>
                      <th className="py-3 px-4 text-right">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60">
                    {filteredChannels.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-neutral-500">
                          Không tìm thấy kênh nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredChannels.map((ch) => (
                        <tr key={ch.id} className="hover:bg-neutral-850/50 transition">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              {ch.logo ? (
                                <img
                                  src={ch.logo}
                                  alt={ch.name}
                                  className="w-7 h-7 object-contain bg-neutral-950 rounded p-0.5 border border-neutral-800 flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-neutral-800 flex items-center justify-center text-[10px] text-amber-400 font-bold flex-shrink-0">
                                  TV
                                </div>
                              )}
                              <div className="truncate max-w-xs">
                                <div>{ch.name}</div>
                                {ch.tvg_id && (
                                  <span className="text-[10px] text-neutral-500 font-mono">id: {ch.tvg_id}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {ch.group}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] uppercase text-neutral-300">
                            {ch.format}
                          </td>
                          <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                            <div className="truncate max-w-xs" title={ch.stream_url}>
                              {ch.stream_url}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                ch.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-neutral-800 text-neutral-400'
                              }`}
                            >
                              {ch.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Play Preview in Modal */}
                              <button
                                onClick={() => setPreviewChannel(ch)}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Xem phát thử kênh này (Play Stream)"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>

                              {/* Ping / Stream Test */}
                              <button
                                onClick={() => handleTestChannelStream(ch.stream_url, ch.id)}
                                disabled={testingChannelId === ch.id}
                                className="p-1.5 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-800 rounded transition"
                                title="Kiểm tra ping phản hồi luồng (Test Ping)"
                              >
                                {testingChannelId === ch.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                                ) : (
                                  <Activity className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingChannelId(ch.id);
                                  setChannelForm(ch);
                                  setIsChannelModalOpen(true);
                                }}
                                className="p-1.5 text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 rounded transition"
                                title="Chỉnh sửa thông tin kênh"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                onClick={() => handleDeleteChannel(ch.id, ch.name)}
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition"
                                title="Xóa kênh"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------- */}
        {/* TAB 3: STREAM PROBE & DIAGNOSTICS */}
        {/* ------------------------------------------------------------------- */}
        {activeTab === 'tester' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div>
              <h3 className="text-base font-semibold text-white">Kiểm Tra Luồng Phát (Stream Probe)</h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Kiểm tra HTTP Status, Content-Type, SSL, và độ trễ phản hồi mà không tải toàn bộ video về server.
              </p>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
              <label className="text-xs font-semibold text-neutral-300 block">URL Stream cần kiểm tra:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testUrlInput}
                  onChange={(e) => setTestUrlInput(e.target.value)}
                  placeholder="https://example.com/live/channel.m3u8"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  disabled={isTestingStream || !testUrlInput.trim()}
                  onClick={() => handleTestChannelStream(testUrlInput)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition flex-shrink-0"
                >
                  {isTestingStream ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                  <span>Kiểm tra</span>
                </button>
              </div>
            </div>

            {testResult && (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">KẾT QUẢ ĐO KIỂM:</span>
                  <span
                    className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                      testResult.status === 'online'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : testResult.status === 'warning'
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {testResult.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-950 p-3 rounded-lg border border-neutral-800">
                  <div>
                    Mã phản hồi: <strong className="text-white">{testResult.http_status || 'N/A'}</strong>
                  </div>
                  <div>
                    Độ trễ: <strong className="text-white">{testResult.response_time_ms} ms</strong>
                  </div>
                  <div>
                    Content-Type: <strong className="text-white truncate block">{testResult.content_type || 'N/A'}</strong>
                  </div>
                  <div>
                    Bảo mật SSL: <strong className={testResult.is_https ? 'text-emerald-400' : 'text-amber-400'}>{testResult.is_https ? 'HTTPS (Có)' : 'HTTP'}</strong>
                  </div>
                </div>

                <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-2.5 rounded border border-neutral-800/80">
                  {testResult.message}
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ADD PLAYLIST */}
      {/* --------------------------------------------------------------------- */}
      {isAddPlaylistOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white">Thêm Playlist IPTV Mới</h3>
              <button
                onClick={() => setIsAddPlaylistOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlaylist} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">Tên Playlist:</label>
                <input
                  type="text"
                  required
                  value={playlistForm.name}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, name: e.target.value })}
                  placeholder="Ví dụ: VTV & Kênh Việt Nam"
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1">Nguồn Playlist:</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, type: 'url' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      playlistForm.type === 'url'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>URL Trực Tuyến</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPlaylistForm({ ...playlistForm, type: 'content' })}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition ${
                      playlistForm.type === 'content'
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-400 font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Dán / File M3U</span>
                  </button>
                </div>
              </div>

              {playlistForm.type === 'url' ? (
                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">
                    Đường dẫn URL Playlist (.m3u / .m3u8):
                  </label>
                  <input
                    type="url"
                    required
                    value={playlistForm.url}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, url: e.target.value })}
                    placeholder="https://example.com/playlist.m3u"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-neutral-300">Nội dung M3U hoặc Tải file:</label>
                    <label className="text-[11px] text-amber-400 hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Chọn file .m3u</span>
                      <input type="file" accept=".m3u,.m3u8,.txt" onChange={handleFileUpload} className="hidden" />
                    </label>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={playlistForm.content}
                    onChange={(e) => setPlaylistForm({ ...playlistForm, content: e.target.value })}
                    placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-id=&quot;VTV1&quot; group-title=&quot;VTV&quot;,VTV1&#10;https://..."
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={playlistForm.enabled}
                  onChange={(e) => setPlaylistForm({ ...playlistForm, enabled: e.target.checked })}
                  className="rounded bg-neutral-950 border-neutral-800 text-amber-500 focus:ring-0"
                />
                <label htmlFor="enabledCheck" className="text-xs text-neutral-300">
                  Bật playlist này ngay sau khi thêm
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsAddPlaylistOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs"
                >
                  Tạo &amp; Đồng Bộ Kênh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: EDIT / CREATE CHANNEL */}
      {/* --------------------------------------------------------------------- */}
      {isChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-semibold text-white">
                {editingChannelId ? 'Chỉnh Sửa Thông Tin Kênh' : 'Thêm Kênh Mới Thủ Công'}
              </h3>
              <button
                onClick={() => setIsChannelModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveChannel} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Tên kênh:</label>
                  <input
                    type="text"
                    required
                    value={channelForm.name || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Nhóm / Thể loại:</label>
                  <input
                    type="text"
                    required
                    value={channelForm.group || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, group: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Định dạng:</label>
                  <select
                    value={channelForm.format || 'hls'}
                    onChange={(e) => setChannelForm({ ...channelForm, format: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="hls">HLS (M3U8)</option>
                    <option value="mp4">MP4</option>
                    <option value="http">HTTP Direct</option>
                    <option value="unknown">Khác</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">URL Luồng Phát:</label>
                  <input
                    type="url"
                    required
                    value={channelForm.stream_url || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, stream_url: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">tvg-id:</label>
                  <input
                    type="text"
                    value={channelForm.tvg_id || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, tvg_id: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">tvg-name:</label>
                  <input
                    type="text"
                    value={channelForm.tvg_name || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, tvg_name: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">URL Logo kênh:</label>
                  <input
                    type="url"
                    value={channelForm.logo || ''}
                    onChange={(e) => setChannelForm({ ...channelForm, logo: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Trạng thái:</label>
                  <select
                    value={channelForm.status || 'active'}
                    onChange={(e) => setChannelForm({ ...channelForm, status: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="active">Active (Hoạt động)</option>
                    <option value="offline">Offline (Tắt)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-neutral-300 block mb-1">Độ phân giải:</label>
                  <input
                    type="text"
                    value={channelForm.resolution || 'HD'}
                    onChange={(e) => setChannelForm({ ...channelForm, resolution: e.target.value })}
                    placeholder="1080p / 720p"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsChannelModalOpen(false)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl text-xs"
                >
                  Lưu Thông Tin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Stream Preview Modal */}
      {previewChannel && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-white">Xem thử luồng: {previewChannel.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewChannel(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <VideoPlayer channel={previewChannel} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
