import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { Channel, DeviceInfo } from './types/iptv';
import { VideoPlayer } from './components/VideoPlayer';
import { ChannelCard } from './components/ChannelCard';
import { ChannelDetailsModal } from './components/ChannelDetailsModal';
import { NokiaSimulatorModal } from './components/NokiaSimulatorModal';
import { M3uImporterModal } from './components/M3uImporterModal';
import { CategoryScrollNav } from './components/CategoryScrollNav';
import { AdminPortal } from './components/AdminPortal';
import { isNokiaLightweightBrowser } from './utils/deviceHelper';
import {
  Tv,
  Search,
  Smartphone,
  Upload,
  Download,
  Shield,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

const STORAGE_FAVORITES_KEY = 'my_iptv_favorites_v1';
const STORAGE_RECENT_KEY = 'my_iptv_recent_v1';
const STORAGE_PAGE_SIZE_KEY = 'my_iptv_page_size_v1';

export default function App() {
  const [viewMode, setViewMode] = useState<'app' | 'admin'>(() => {
    return typeof window !== 'undefined' && window.location.pathname === '/admin' ? 'admin' : 'app';
  });

  // Channel & Pagination state
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [playTrigger, setPlayTrigger] = useState<number>(0);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalMatching, setTotalMatching] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_PAGE_SIZE_KEY);
      if (saved === '100') return 100;
      if (saved === '50') return 50;
    }
    return 50; // Default fixed 50 channels per page
  });
  const [jumpInput, setJumpInput] = useState<string>('');

  const pageSizeRef = useRef<number>(pageSize);
  pageSizeRef.current = pageSize;

  // Global Categories & System stats from server
  const [categories, setCategories] = useState<string[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [totalSystemChannels, setTotalSystemChannels] = useState<number>(0);

  // Local user state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Keep stable refs so loadChannels never re-creates or re-fetches when user selects a channel
  const favoritesRef = useRef<string[]>(favorites);
  favoritesRef.current = favorites;
  const recentIdsRef = useRef<string[]>(recentIds);
  recentIdsRef.current = recentIds;

  // Determine whether current environment is the lightweight browser for Nokia E72
  const isNokiaLightweight = isNokiaLightweightBrowser(deviceInfo);

  // Modals
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);
  const [isNokiaSimOpen, setIsNokiaSimOpen] = useState<boolean>(false);
  const [isM3uModalOpen, setIsM3uModalOpen] = useState<boolean>(false);

  const channelListRef = useRef<HTMLDivElement>(null);
  const channelListScrollPosRef = useRef<number>(0);

  // Preserve scroll position synchronously whenever selectedChannel changes
  useLayoutEffect(() => {
    if (channelListRef.current && channelListScrollPosRef.current > 0) {
      channelListRef.current.scrollTop = channelListScrollPosRef.current;
    }
  }, [selectedChannel, playTrigger]);

  // Listen to popstate for back/forward
  useEffect(() => {
    const handlePopState = () => {
      setViewMode(window.location.pathname === '/admin' ? 'admin' : 'app');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load favorites & recent from localStorage
  useEffect(() => {
    try {
      const savedFavs = localStorage.getItem(STORAGE_FAVORITES_KEY);
      if (savedFavs) setFavorites(JSON.parse(savedFavs));

      const savedRecent = localStorage.getItem(STORAGE_RECENT_KEY);
      if (savedRecent) setRecentIds(JSON.parse(savedRecent));
    } catch (e) {
      console.warn('Could not read localStorage:', e);
    }
  }, []);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch device info & global categories list
  const fetchMetadata = useCallback(async () => {
    try {
      const [groupsRes, deviceRes] = await Promise.all([
        fetch('/api/groups').catch(() => null),
        fetch('/api/device-info').catch(() => null),
      ]);

      if (groupsRes && groupsRes.ok) {
        const ct = groupsRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const gData = await groupsRes.json();
          setCategories(gData.groups || []);
          setGroupCounts(gData.counts || {});
          setTotalSystemChannels(gData.totalChannels || 0);
        }
      }

      if (deviceRes && deviceRes.ok) {
        const ct = deviceRes.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const dData = await deviceRes.json();
          setDeviceInfo(dData);
        }
      }
    } catch (err) {
      console.error('Error fetching metadata:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  // Server-Side Channels Fetcher with Pagination & Filtering
  const loadChannels = useCallback(
    async (group: string, query: string, page: number = 1, currentLimit: number = pageSizeRef.current) => {
      setLoading(true);

      try {
        // Special local tabs: favorites and recent
        if (group === 'favorites' || group === 'recent') {
          const res = await fetch('/api/channels?limit=all');
          if (res.ok) {
            const data = await res.json();
            const allItems: Channel[] = data.channels || [];
            const targetIds = group === 'favorites' ? favoritesRef.current : recentIdsRef.current;
            let filtered = allItems.filter((c) => targetIds.includes(c.id));

            if (query.trim()) {
              const qLower = query.toLowerCase().trim();
              filtered = filtered.filter(
                (c) =>
                  c.name.toLowerCase().includes(qLower) ||
                  c.group.toLowerCase().includes(qLower) ||
                  (c.description && c.description.toLowerCase().includes(qLower))
              );
            }

            const total = filtered.length;
            const computedPages = Math.max(1, Math.ceil(total / currentLimit));
            const validPage = Math.min(Math.max(1, page), computedPages);
            const startIndex = (validPage - 1) * currentLimit;
            const paginated = filtered.slice(startIndex, startIndex + currentLimit);

            setChannels(paginated);
            setTotalMatching(total);
            setCurrentPage(validPage);
            setTotalPages(computedPages);

            setSelectedChannel((prev) => prev ? prev : (paginated.length > 0 ? paginated[0] : null));
          }
          return;
        }

        // Standard server-side filtering & search
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(currentLimit));
        if (group && group !== 'all') {
          params.set('group', group);
        }
        if (query.trim()) {
          params.set('q', query.trim());
        }

        const res = await fetch(`/api/channels?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newChannels: Channel[] = data.channels || [];

          setChannels(newChannels);
          setTotalMatching(data.total || 0);
          setCurrentPage(data.page || 1);
          setTotalPages(data.totalPages || 1);

          setSelectedChannel((prev) => prev ? prev : (newChannels.length > 0 ? newChannels[0] : null));
        }
      } catch (err) {
        console.error('Error loading channels:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Trigger load when group or debounced query changes
  useEffect(() => {
    loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current);
  }, [activeGroup, debouncedQuery, loadChannels]);

  // Change page size (fixed 50 or 100 channels per page)
  const handleChangePageSize = (newSize: number) => {
    setPageSize(newSize);
    pageSizeRef.current = newSize;
    try {
      localStorage.setItem(STORAGE_PAGE_SIZE_KEY, String(newSize));
    } catch (e) {
      // ignore
    }
    loadChannels(activeGroup, debouncedQuery, 1, newSize);
    if (channelListRef.current) {
      channelListRef.current.scrollTop = 0;
    }
  };

  // Jump to specific page
  const handleGoToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === currentPage || loading) {
      return;
    }
    loadChannels(activeGroup, debouncedQuery, targetPage, pageSizeRef.current);
    if (channelListRef.current) {
      channelListRef.current.scrollTop = 0;
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpInput.trim(), 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      handleGoToPage(p);
      setJumpInput('');
    }
  };

  // Helper to generate page number buttons with ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  // Handle select & play channel without resetting channel list scroll position
  const handleSelectChannel = (channel: Channel) => {
    // 1. Capture current scroll position of the channel list container & window
    const currentScrollTop = channelListRef.current ? channelListRef.current.scrollTop : channelListScrollPosRef.current;
    const currentWindowY = typeof window !== 'undefined' ? window.scrollY : 0;
    channelListScrollPosRef.current = currentScrollTop;

    // 2. Select channel & increment play trigger
    setSelectedChannel(channel);
    setPlayTrigger((prev) => prev + 1);

    // 3. Update recently watched list without resetting channel list
    setRecentIds((prev) => {
      const filtered = prev.filter((id) => id !== channel.id);
      const updated = [channel.id, ...filtered].slice(0, 12);
      try {
        localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return updated;
    });

    // 4. Strictly maintain channel list scroll position at the current selected channel
    if (channelListRef.current && currentScrollTop > 0) {
      channelListRef.current.scrollTop = currentScrollTop;
    }

    requestAnimationFrame(() => {
      if (channelListRef.current && currentScrollTop > 0) {
        channelListRef.current.scrollTop = currentScrollTop;
      }
      if (typeof window !== 'undefined' && currentWindowY > 0) {
        window.scrollTo({ top: currentWindowY, behavior: 'instant' as any });
      }
      const cardEl = document.getElementById(`channel-card-${channel.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' as any });
      }
    });
  };

  // Toggle favorite
  const handleToggleFavorite = (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      try {
        localStorage.setItem(STORAGE_FAVORITES_KEY, JSON.stringify(updated));
      } catch (err) {
        console.warn('LocalStorage error:', err);
      }
      return updated;
    });

    if (activeGroup === 'favorites') {
      const currentScrollTop = channelListRef.current ? channelListRef.current.scrollTop : null;
      setTimeout(() => {
        loadChannels('favorites', debouncedQuery, 1, pageSizeRef.current).then(() => {
          if (currentScrollTop !== null && channelListRef.current) {
            channelListRef.current.scrollTop = currentScrollTop;
          }
        });
      }, 50);
    }
  };

  // Open Channel Detail modal
  const handleOpenDetails = (channel: Channel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDetailChannel(channel);
  };

  // Import custom channels from M3U parser
  const handleImportChannels = (newChannels: Channel[]) => {
    setChannels(newChannels);
    setTotalMatching(newChannels.length);
    if (newChannels.length > 0) {
      setSelectedChannel(newChannels[0]);
      setActiveGroup('all');
    }
    fetchMetadata();
  };

  const navigateToAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setViewMode('admin');
  };

  const navigateToApp = () => {
    window.history.pushState({}, '', '/');
    setViewMode('app');
    fetchMetadata();
    loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current);
  };

  // ---------------------------------------------------------------------------
  // IF VIEW MODE IS ADMIN, RENDER ADMIN PORTAL
  // ---------------------------------------------------------------------------
  if (viewMode === 'admin') {
    return <AdminPortal onBackToApp={navigateToApp} />;
  }

  // ---------------------------------------------------------------------------
  // MAIN MODERN IPTV INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20 text-neutral-950 font-black">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white leading-tight">
                  MY IPTV
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Universal
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">
                {totalSystemChannels.toLocaleString()} kênh &bull; {isNokiaLightweight ? 'CorePlayer S60' : 'VLC Player'} &bull; Modern Web
              </p>
            </div>
          </div>

          {/* Quick Actions & Navigation Bridge */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Admin Portal Button */}
            <button
              onClick={navigateToAdmin}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-amber-400 hover:text-amber-300 border border-neutral-700/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
              title="Mở bảng điều khiển quản trị playlist và kênh"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Quản Trị</span>
            </button>

            {/* Nokia Simulator Button */}
            <button
              onClick={() => setIsNokiaSimOpen(true)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 hover:text-white border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
              title="Mô phỏng trình duyệt Nokia E72 S60"
            >
              <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Mô phỏng</span> E72
            </button>

            {/* Direct Switch to Legacy Page */}
            <a
              href="/legacy"
              className="px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Chuyển sang giao diện HTML thuần siêu nhẹ cho E72"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>S60 (Siêu nhẹ)</span>
            </a>

            {/* Import Custom M3U */}
            <button
              onClick={() => setIsM3uModalOpen(true)}
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Nhập playlist M3U tạm thời"
            >
              <Upload className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">Nhập M3U</span>
            </button>

            {/* Download M3U VLC */}
            <a
              href="/playlist.m3u"
              download="playlist.m3u"
              className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Tải về file playlist.m3u cho VLC"
            >
              <Download className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden md:inline">Tải M3U</span>
            </a>

            {/* Download Nokia E72 M3U */}
            <a
              href="/api/channels/e72.m3u"
              download="nokia_e72_playlist.m3u"
              className="px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              title="Tải file playlist .m3u đã nén chuẩn QVGA 320x240 và không lỗi BOM cho Nokia E72"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">M3U E72</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-4 flex flex-col gap-4">
        {/* Auto Device Detection Banner & View Selector */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-neutral-400">
              Tự động nhận diện thiết bị:{' '}
              <strong className="text-white">
                {deviceInfo?.type === 'NOKIA_S60'
                  ? 'Nokia E72 / Symbian S60'
                  : deviceInfo?.type === 'MOBILE_MODERN'
                  ? 'Điện thoại di động (Mobile)'
                  : deviceInfo?.type === 'TABLET'
                  ? 'Máy tính bảng (Tablet)'
                  : 'Máy tính để bàn (Desktop)'}
              </strong>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              {totalSystemChannels.toLocaleString()} kênh trực tuyến
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-500 text-[11px]">Chế độ xem:</span>
            <a
              href="/?view=reset"
              className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] font-medium transition"
              title="Khôi phục nhận diện tự động theo User-Agent"
            >
              Tự động
            </a>
            <a
              href="/?view=legacy"
              className="px-2.5 py-1 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 rounded text-[11px] font-medium transition"
              title="Chuyển sang giao diện HTML thuần cho Nokia E72"
            >
              Nokia E72 (S60)
            </a>
            <a
              href="/?view=modern"
              className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-medium transition"
              title="Giao diện hiện đại đầy đủ"
            >
              Hiện đại
            </a>
          </div>
        </div>

        {/* Layout Container */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column: Player & Stream Hub (Desktop: ~56% width) */}
          <div className="w-full lg:w-[56%] flex flex-col gap-4">
            {/* Main HLS Video Player */}
            <VideoPlayer
              channel={selectedChannel}
              playTrigger={playTrigger}
              onOpenDetails={(ch) => handleOpenDetails(ch)}
              isNokiaLightweight={isNokiaLightweight}
            />

            {/* Quick Hub: CorePlayer on Nokia E72 Banner */}
            <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/30 border border-neutral-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex-shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Đang dùng Nokia E72 hoặc Symbian S60?
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Mở trình duyệt mặc định trên máy để xem giao diện siêu nhẹ và mở CorePlayer:
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <a
                      href="/legacy"
                      className="text-xs text-amber-400 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      Xem giao diện Nokia E72 thuần HTML &raquo;
                    </a>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-full sm:w-auto flex sm:flex-col gap-2">
                <button
                  onClick={() => setIsNokiaSimOpen(true)}
                  className="w-full text-center px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium transition"
                >
                  Mở giả lập E72
                </button>
              </div>
            </div>

            {/* Server Stats & Health */}
            <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-xl flex items-center justify-between text-xs text-neutral-400">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Hệ thống: <strong className="text-neutral-200">{totalSystemChannels.toLocaleString()} kênh</strong>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={navigateToAdmin} className="text-amber-400 hover:underline font-medium">
                  Quản trị Playlists
                </button>
                <a href="/health" target="_blank" className="hover:text-amber-400 transition">
                  /health
                </a>
              </div>
            </div>
          </div>

          {/* Right Column: Channels Navigation & Grid (Desktop: ~44% width) */}
          <div className="w-full lg:w-[44%] flex flex-col gap-3">
            {/* Search Box - Searches across all 11,000+ channels */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm kiếm kênh trong toàn bộ hệ thống..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs px-1"
                >
                  Xóa
                </button>
              )}
            </div>

            {/* Category Tabs with Horizontal Scroll, Swipe, and Channel Counts */}
            <CategoryScrollNav
              categories={categories}
              groupCounts={groupCounts}
              activeGroup={activeGroup}
              onSelectGroup={(grp) => setActiveGroup(grp)}
              totalChannels={totalSystemChannels}
              favoritesCount={favorites.length}
              recentCount={recentIds.length}
            />

            {/* Active Filter & Page Size Header */}
            <div className="flex flex-wrap items-center justify-between text-xs px-1 text-neutral-400 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>
                  {activeGroup !== 'all' ? (
                    <>
                      Đang lọc: <strong className="text-amber-400">{activeGroup}</strong>
                    </>
                  ) : (
                    <span>Tất cả kênh</span>
                  )}
                  {debouncedQuery && (
                    <>
                      {' '}&bull; Từ khóa: <strong className="text-white">"{debouncedQuery}"</strong>
                    </>
                  )}
                  {' '}&bull; Tìm thấy: <strong className="text-emerald-400">{totalMatching.toLocaleString()} kênh</strong>
                </span>

                {(activeGroup !== 'all' || debouncedQuery) && (
                  <button
                    onClick={() => {
                      setActiveGroup('all');
                      setSearchQuery('');
                    }}
                    className="text-[11px] text-rose-400 hover:underline ml-1"
                  >
                    (Xóa lọc)
                  </button>
                )}
              </div>

              {/* Page Size Setting (50 or 100 channels fixed per page) */}
              <div className="flex items-center gap-1.5 text-[11px] bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 shadow-sm">
                <span className="text-neutral-500">Mỗi trang:</span>
                <button
                  type="button"
                  onClick={() => handleChangePageSize(50)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    pageSize === 50
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Hiển thị cố định 50 kênh mỗi trang"
                >
                  50 kênh
                </button>
                <span className="text-neutral-700">|</span>
                <button
                  type="button"
                  onClick={() => handleChangePageSize(100)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    pageSize === 100
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Hiển thị cố định 100 kênh mỗi trang"
                >
                  100 kênh
                </button>
              </div>
            </div>

            {/* Channels Grid / List with Custom Smooth Scrollbar */}
            <div
              ref={channelListRef}
              onScroll={(e) => {
                channelListScrollPosRef.current = e.currentTarget.scrollTop;
              }}
              className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[580px] pr-1.5 custom-scrollbar"
            >
              {loading ? (
                <div className="text-center py-16 text-neutral-500 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                  <span>Đang tải trang {currentPage} ({pageSize} kênh)...</span>
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-12 bg-neutral-900/40 rounded-xl border border-neutral-800 p-6">
                  <Tv className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400">Không tìm thấy kênh phù hợp.</p>
                  {(activeGroup !== 'all' || debouncedQuery) && (
                    <button
                      onClick={() => {
                        setActiveGroup('all');
                        setSearchQuery('');
                      }}
                      className="mt-2 text-xs text-amber-400 hover:underline"
                    >
                      Đặt lại bộ lọc để xem tất cả kênh
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
                    {channels.map((channel) => (
                      <ChannelCard
                        key={channel.id}
                        channel={channel}
                        isActive={selectedChannel?.id === channel.id}
                        isFavorite={favorites.includes(channel.id)}
                        onSelect={handleSelectChannel}
                        onPlay={handleSelectChannel}
                        onToggleFavorite={handleToggleFavorite}
                        onOpenDetails={(ch, e) => handleOpenDetails(ch, e)}
                        isNokiaLightweight={isNokiaLightweight}
                      />
                    ))}
                  </div>

                  {/* Pagination Bar */}
                  {totalPages > 1 && (
                    <div className="pt-3 pb-2 flex flex-col gap-2.5 border-t border-neutral-800/80 mt-2">
                      {/* Range details & Page Size Selector */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-400">
                        <div>
                          <span>
                            Trang <strong className="text-amber-400 font-bold">{currentPage}</strong> / <strong className="text-neutral-200">{totalPages.toLocaleString()}</strong>
                          </span>
                          <span className="text-[11px] text-neutral-500 ml-2">
                            (Hiển thị {Math.min((currentPage - 1) * pageSize + 1, totalMatching)} &ndash; {Math.min((currentPage - 1) * pageSize + channels.length, totalMatching)} trong {totalMatching.toLocaleString()} kênh)
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-neutral-500">Hiển thị:</span>
                          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
                            <button
                              type="button"
                              onClick={() => handleChangePageSize(50)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                pageSize === 50
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              50 / trang
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChangePageSize(100)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                pageSize === 100
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              100 / trang
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Pagination Action Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* Page Buttons */}
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleGoToPage(1)}
                            disabled={currentPage === 1 || loading}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition flex items-center gap-0.5"
                            title="Trang đầu tiên"
                          >
                            <ChevronsLeft className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Đầu</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGoToPage(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition flex items-center gap-0.5"
                            title="Trang trước"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Trước</span>
                          </button>

                          {/* Page numbers window */}
                          {getPageNumbers().map((p, idx) =>
                            p === '...' ? (
                              <span key={`dots-${idx}`} className="px-1 text-neutral-600 text-xs select-none">
                                ...
                              </span>
                            ) : (
                              <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => handleGoToPage(Number(p))}
                                disabled={loading}
                                className={`min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-semibold transition border ${
                                  currentPage === p
                                    ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-sm font-bold'
                                    : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                                }`}
                              >
                                {p}
                              </button>
                            )
                          )}

                          <button
                            type="button"
                            onClick={() => handleGoToPage(currentPage + 1)}
                            disabled={currentPage === totalPages || loading}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition flex items-center gap-0.5"
                            title="Trang kế tiếp"
                          >
                            <span>Tiếp</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGoToPage(totalPages)}
                            disabled={currentPage === totalPages || loading}
                            className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 text-neutral-300 border border-neutral-800 rounded-lg text-xs font-medium transition flex items-center gap-0.5"
                            title="Trang cuối cùng"
                          >
                            <span className="hidden sm:inline">Cuối</span>
                            <ChevronsRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Jump to Page Form */}
                        <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 text-xs">
                          <span className="text-neutral-500 text-[11px]">Đến trang:</span>
                          <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={jumpInput}
                            onChange={(e) => setJumpInput(e.target.value)}
                            placeholder={String(currentPage)}
                            className="w-14 px-1.5 py-1 bg-neutral-900 border border-neutral-800 rounded-lg text-center text-xs text-white focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="submit"
                            disabled={loading || !jumpInput}
                            className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200 border border-neutral-700 rounded-lg text-xs font-medium transition"
                          >
                            Đi
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-neutral-800/80 bg-neutral-950 py-4 text-center text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            MY IPTV &copy; 2026 &bull; {totalSystemChannels.toLocaleString()} kênh trực tuyến &bull; Tương thích Nokia E72
          </div>
          <div className="flex items-center gap-3">
            <button onClick={navigateToAdmin} className="hover:text-amber-400 transition font-medium">
              Quản trị Admin
            </button>
            <span>&bull;</span>
            <a href="/legacy" className="hover:text-amber-400 transition">Bản Nokia E72</a>
            <span>&bull;</span>
            <a href="/playlist.m3u" className="hover:text-amber-400 transition">M3U Playlist</a>
            <span>&bull;</span>
            <a href="/health" className="hover:text-amber-400 transition">Health Status</a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ChannelDetailsModal
        channel={detailChannel}
        onClose={() => setDetailChannel(null)}
        onPlayChannel={(ch) => handleSelectChannel(ch)}
        isNokiaLightweight={isNokiaLightweight}
      />

      <NokiaSimulatorModal
        isOpen={isNokiaSimOpen}
        onClose={() => setIsNokiaSimOpen(false)}
      />

      <M3uImporterModal
        isOpen={isM3uModalOpen}
        onClose={() => setIsM3uModalOpen(false)}
        onImportChannels={handleImportChannels}
      />
    </div>
  );
}
