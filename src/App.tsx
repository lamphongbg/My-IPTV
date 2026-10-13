import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
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
  ChevronsRight,
  Activity,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Sliders,
  X
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
      if (saved) {
        const parsed = parseInt(saved, 10);
        if ([24, 48, 50, 96, 100].includes(parsed)) return parsed;
      }
    }
    return 24; // Default fast 24 channels per page
  });
  const [jumpInput, setJumpInput] = useState<string>('');

  const pageSizeRef = useRef<number>(pageSize);
  pageSizeRef.current = pageSize;

  // Status filter & availability counts
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'offline'>('all');
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [offlineCount, setOfflineCount] = useState<number>(0);

  // List-specific breakdowns & scope counts
  const [groupActiveCounts, setGroupActiveCounts] = useState<Record<string, number>>({});
  const [groupOfflineCounts, setGroupOfflineCounts] = useState<Record<string, number>>({});
  const [currentScopeCounts, setCurrentScopeCounts] = useState<{ total: number; online: number; offline: number } | null>(null);
  const [favoritesActiveCount, setFavoritesActiveCount] = useState<number>(0);
  const [favoritesOfflineCount, setFavoritesOfflineCount] = useState<number>(0);
  const [recentActiveCount, setRecentActiveCount] = useState<number>(0);
  const [recentOfflineCount, setRecentOfflineCount] = useState<number>(0);

  // Background Batch Channel Scanner state
  const [scanProgress, setScanProgress] = useState<{
    isRunning: boolean;
    total: number;
    scanned: number;
    onlineCount: number;
    offlineCount: number;
    currentChannelName?: string;
  } | null>(null);
  const [isStartingScan, setIsStartingScan] = useState<boolean>(false);
  const [scanningChannelId, setScanningChannelId] = useState<string | null>(null);

  // Global Categories & System stats from server
  const [categories, setCategories] = useState<string[]>([]);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});
  const [totalSystemChannels, setTotalSystemChannels] = useState<number>(0);

  // Local user state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Accurately compute channel counts for the currently selected list / group
  const displayedListTotal = useMemo(() => {
    if (activeGroup === 'all') return totalSystemChannels;
    if (activeGroup === 'favorites') return favorites.length;
    if (activeGroup === 'recent') return recentIds.length;
    if (currentScopeCounts && activeGroup !== 'all') return currentScopeCounts.total;
    return groupCounts[activeGroup] ?? 0;
  }, [activeGroup, totalSystemChannels, favorites.length, recentIds.length, currentScopeCounts, groupCounts]);

  const displayedListOnline = useMemo(() => {
    if (activeGroup === 'all') return onlineCount;
    if (activeGroup === 'favorites') return favoritesActiveCount;
    if (activeGroup === 'recent') return recentActiveCount;
    if (currentScopeCounts && activeGroup !== 'all') return currentScopeCounts.online;
    return groupActiveCounts[activeGroup] ?? 0;
  }, [activeGroup, onlineCount, favoritesActiveCount, recentActiveCount, currentScopeCounts, groupActiveCounts]);

  const displayedListOffline = useMemo(() => {
    if (activeGroup === 'all') return offlineCount;
    if (activeGroup === 'favorites') return favoritesOfflineCount;
    if (activeGroup === 'recent') return recentOfflineCount;
    if (currentScopeCounts && activeGroup !== 'all') return currentScopeCounts.offline;
    return groupOfflineCounts[activeGroup] ?? 0;
  }, [activeGroup, offlineCount, favoritesOfflineCount, recentOfflineCount, currentScopeCounts, groupOfflineCounts]);

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

  // Fetch device info & global categories list with online/offline stats
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
          const grps: string[] = gData.groups || [];
          const cnts: Record<string, number> = gData.counts || {};
          grps.sort((a, b) => {
            const countDiff = (cnts[b] || 0) - (cnts[a] || 0);
            if (countDiff !== 0) return countDiff;
            return a.localeCompare(b);
          });
          setCategories(grps);
          setGroupCounts(cnts);
          setGroupActiveCounts(gData.activeCounts || {});
          setGroupOfflineCounts(gData.offlineCounts || {});
          setTotalSystemChannels(gData.totalChannels || 0);
          setOnlineCount(gData.onlineChannels ?? 0);
          setOfflineCount(gData.offlineChannels ?? 0);
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

  // Check initial batch scan status
  useEffect(() => {
    fetch('/api/channels/scan-status')
      .then((r) => r.json())
      .then((d) => {
        if (d && (d.isRunning || d.scanned > 0)) {
          setScanProgress(d);
        }
      })
      .catch(() => {});
  }, []);

  // Server-Side Channels Fetcher with Pagination, Filtering & Status
  const loadChannels = useCallback(
    async (
      group: string,
      query: string,
      page: number = 1,
      currentLimit: number = pageSizeRef.current,
      currentStatus: 'all' | 'active' | 'offline' = statusFilter
    ) => {
      setLoading(true);

      try {
        // Special local tabs: favorites and recent
        if (group === 'favorites' || group === 'recent') {
          const res = await fetch('/api/channels?limit=all');
          if (res.ok) {
            const data = await res.json();
            const allItems: Channel[] = data.channels || [];
            const targetIds = group === 'favorites' ? favoritesRef.current : recentIdsRef.current;
            const targetItems = allItems.filter((c) => targetIds.includes(c.id));

            const itemTotal = targetItems.length;
            const itemOnline = targetItems.filter((c) => c.status !== 'offline').length;
            const itemOffline = targetItems.filter((c) => c.status === 'offline').length;

            if (group === 'favorites') {
              setFavoritesActiveCount(itemOnline);
              setFavoritesOfflineCount(itemOffline);
            } else {
              setRecentActiveCount(itemOnline);
              setRecentOfflineCount(itemOffline);
            }
            setCurrentScopeCounts({ total: itemTotal, online: itemOnline, offline: itemOffline });

            let filtered = targetItems;
            if (currentStatus === 'active') {
              filtered = filtered.filter((c) => c.status !== 'offline');
            } else if (currentStatus === 'offline') {
              filtered = filtered.filter((c) => c.status === 'offline');
            }

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
            if (data.globalCounts) {
              setOnlineCount(data.globalCounts.online);
              setOfflineCount(data.globalCounts.offline);
              setTotalSystemChannels(data.globalCounts.total);
            }

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
        if (currentStatus !== 'all') {
          params.set('status', currentStatus);
        }

        const res = await fetch(`/api/channels?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const newChannels: Channel[] = data.channels || [];

          setChannels(newChannels);
          setTotalMatching(data.total || 0);
          setCurrentPage(data.page || 1);
          setTotalPages(data.totalPages || 1);
          if (data.scopeCounts) {
            setCurrentScopeCounts(data.scopeCounts);
          }
          if (data.globalCounts) {
            setOnlineCount(data.globalCounts.online);
            setOfflineCount(data.globalCounts.offline);
            setTotalSystemChannels(data.globalCounts.total);
          }

          setSelectedChannel((prev) => prev ? prev : (newChannels.length > 0 ? newChannels[0] : null));
        }
      } catch (err) {
        console.error('Error loading channels:', err);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter]
  );

  // Trigger load when group, statusFilter, or debounced query changes
  useEffect(() => {
    loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current, statusFilter);
  }, [activeGroup, debouncedQuery, statusFilter, loadChannels]);

  // Poll batch scanner progress if running
  useEffect(() => {
    let timer: any;
    if (scanProgress?.isRunning) {
      timer = setInterval(async () => {
        try {
          const res = await fetch('/api/channels/scan-status');
          if (res.ok) {
            const data = await res.json();
            setScanProgress(data);
            if (!data.isRunning) {
              clearInterval(timer);
              fetchMetadata();
              loadChannels(activeGroup, debouncedQuery, currentPage, pageSizeRef.current, statusFilter);
            }
          }
        } catch {}
      }, 1200);
    }
    return () => clearInterval(timer);
  }, [scanProgress?.isRunning, fetchMetadata, loadChannels, activeGroup, debouncedQuery, currentPage, statusFilter]);

  // Batch scan actions
  const handleStartBatchScan = async () => {
    if (scanProgress?.isRunning || isStartingScan) return;
    setIsStartingScan(true);
    try {
      const isSpecificGroup = activeGroup !== 'all' && activeGroup !== 'favorites' && activeGroup !== 'recent';
      const res = await fetch('/api/channels/scan-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concurrency: 6,
          group: isSpecificGroup ? activeGroup : undefined,
          scopeDescription: isSpecificGroup ? `Quét list "${activeGroup}" (${displayedListTotal} kênh)` : undefined,
        }),
      });
      const data = await res.json();
      if (data.progress) {
        setScanProgress(data.progress);
      }
    } catch (e) {
      console.error('Lỗi khởi động quét:', e);
    } finally {
      setIsStartingScan(false);
    }
  };

  const handleStopBatchScan = async () => {
    try {
      const res = await fetch('/api/channels/scan-stop', { method: 'POST' });
      const data = await res.json();
      if (data.progress) setScanProgress(data.progress);
    } catch (e) {
      console.error('Lỗi dừng quét:', e);
    }
  };

  const handleScanSingleChannel = async (channelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (scanningChannelId) return;
    setScanningChannelId(channelId);
    try {
      const res = await fetch(`/api/channels/${encodeURIComponent(channelId)}/scan`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        // Update local channel item state immediately
        setChannels((prev) =>
          prev.map((c) =>
            c.id === channelId
              ? {
                  ...c,
                  status: result.status === 'online' ? 'active' : 'offline',
                  description:
                    result.status === 'online'
                      ? `Khả dụng (Ping ${result.responseTimeMs}ms, ${new Date().toLocaleDateString('vi-VN')})`
                      : `Không khả dụng: ${result.error || 'Lỗi kết nối'} (${new Date().toLocaleDateString('vi-VN')})`,
                }
              : c
          )
        );
        fetchMetadata();
      }
    } catch (err) {
      console.error('Lỗi quét kênh đơn lẻ:', err);
    } finally {
      setScanningChannelId(null);
    }
  };

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

            {/* Channel Availability & Status Filter Toolbar */}
            <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 flex flex-col gap-2.5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-neutral-400 font-semibold mr-1">Trạng thái:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('all');
                      loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current, 'all');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      statusFilter === 'all'
                        ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800'
                    }`}
                    title={`Tất cả ${displayedListTotal.toLocaleString('vi-VN')} kênh trong ${activeGroup === 'all' ? 'toàn bộ hệ thống' : `list "${activeGroup}"`}`}
                  >
                    Tất cả ({displayedListTotal.toLocaleString('vi-VN')})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('active');
                      loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current, 'active');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      statusFilter === 'active'
                        ? 'bg-emerald-600 text-white font-bold shadow'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-emerald-400 border border-emerald-950'
                    }`}
                    title={`${displayedListOnline.toLocaleString('vi-VN')} kênh khả dụng trong ${activeGroup === 'all' ? 'toàn bộ hệ thống' : `list "${activeGroup}"`}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Khả dụng ({displayedListOnline.toLocaleString('vi-VN')})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('offline');
                      loadChannels(activeGroup, debouncedQuery, 1, pageSizeRef.current, 'offline');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                      statusFilter === 'offline'
                        ? 'bg-rose-600 text-white font-bold shadow'
                        : 'bg-neutral-950 hover:bg-neutral-800 text-rose-400 border border-rose-950'
                    }`}
                    title={`${displayedListOffline.toLocaleString('vi-VN')} kênh không khả dụng trong ${activeGroup === 'all' ? 'toàn bộ hệ thống' : `list "${activeGroup}"`}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-400" />
                    <span>Không khả dụng ({displayedListOffline.toLocaleString('vi-VN')})</span>
                  </button>
                </div>

                {/* Scan Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleStartBatchScan}
                    disabled={scanProgress?.isRunning || isStartingScan}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow"
                    title={
                      activeGroup !== 'all' && activeGroup !== 'favorites' && activeGroup !== 'recent'
                        ? `Tự động kiểm tra ${displayedListTotal} kênh trong list "${activeGroup}"`
                        : 'Tự động kiểm tra từng luồng và đánh dấu offline các kênh hỏng'
                    }
                  >
                    <Activity className={`w-3.5 h-3.5 ${scanProgress?.isRunning ? 'animate-spin' : ''}`} />
                    <span>{scanProgress?.isRunning ? 'Đang Rà Soát...' : 'Quét Tính Khả Dụng'}</span>
                  </button>
                </div>
              </div>

              {/* Batch Scan Progress Banner */}
              {scanProgress && (scanProgress.isRunning || scanProgress.scanned > 0) && (
                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${scanProgress.isRunning ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
                      <span className="font-semibold text-white">
                        {scanProgress.isRunning ? 'Đang quét rà soát luồng:' : 'Hoàn thành đợt rà soát:'}
                      </span>
                      <span className="text-neutral-400 font-mono">
                        {scanProgress.scanned} / {scanProgress.total} kênh ({Math.round((scanProgress.scanned / (scanProgress.total || 1)) * 100)}%)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-emerald-400 font-medium">🟢 {scanProgress.onlineCount} Online</span>
                      <span className="text-rose-400 font-medium">🔴 {scanProgress.offlineCount} Offline</span>
                      {scanProgress.isRunning && (
                        <button
                          type="button"
                          onClick={handleStopBatchScan}
                          className="px-2 py-0.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded text-[10px] font-bold transition"
                        >
                          Dừng
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.round((scanProgress.scanned / (scanProgress.total || 1)) * 100)}%` }}
                    />
                  </div>

                  {scanProgress.isRunning && scanProgress.currentChannelName && (
                    <p className="text-[10px] text-neutral-400 truncate">
                      Đang kiểm tra: <span className="text-amber-300 font-medium">{scanProgress.currentChannelName}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Active Filter & Page Size Header */}
            <div className="flex flex-wrap items-center justify-between text-xs px-1 text-neutral-400 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span>
                  {activeGroup !== 'all' ? (
                    <>
                      Đang lọc list: <strong className="text-amber-400">{activeGroup}</strong> ({displayedListTotal.toLocaleString('vi-VN')} kênh)
                    </>
                  ) : (
                    <span>Tất cả kênh ({totalSystemChannels.toLocaleString('vi-VN')} kênh)</span>
                  )}
                  {statusFilter !== 'all' && (
                    <>
                      {' '}&bull; Trạng thái:{' '}
                      <strong className={statusFilter === 'active' ? 'text-emerald-400' : 'text-rose-400'}>
                        {statusFilter === 'active'
                          ? `Khả dụng (${displayedListOnline.toLocaleString('vi-VN')})`
                          : `Không khả dụng (${displayedListOffline.toLocaleString('vi-VN')})`}
                      </strong>
                    </>
                  )}
                  {debouncedQuery && (
                    <>
                      {' '}&bull; Từ khóa: <strong className="text-white">"{debouncedQuery}"</strong>
                    </>
                  )}
                  {' '}&bull; Tìm thấy: <strong className="text-emerald-400">{totalMatching.toLocaleString('vi-VN')} kênh</strong>
                </span>

                {(activeGroup !== 'all' || debouncedQuery || statusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setActiveGroup('all');
                      setSearchQuery('');
                      setStatusFilter('all');
                      loadChannels('all', '', 1, pageSizeRef.current, 'all');
                    }}
                    className="text-[11px] text-rose-400 hover:underline ml-1"
                  >
                    (Xóa lọc)
                  </button>
                )}
              </div>

              {/* Page Size Setting (24, 48, 96 channels fixed per page) */}
              <div className="flex items-center gap-1.5 text-[11px] bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 shadow-sm">
                <span className="text-neutral-500">Mỗi trang:</span>
                <button
                  type="button"
                  onClick={() => handleChangePageSize(24)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    pageSize === 24
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Hiển thị 24 kênh mỗi trang (Tải nhanh nhất)"
                >
                  24 kênh
                </button>
                <span className="text-neutral-700">|</span>
                <button
                  type="button"
                  onClick={() => handleChangePageSize(48)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    pageSize === 48
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Hiển thị 48 kênh mỗi trang"
                >
                  48 kênh
                </button>
                <span className="text-neutral-700">|</span>
                <button
                  type="button"
                  onClick={() => handleChangePageSize(96)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    pageSize === 96
                      ? 'bg-amber-500 text-neutral-950 shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="Hiển thị 96 kênh mỗi trang"
                >
                  96 kênh
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
                  {(activeGroup !== 'all' || debouncedQuery || statusFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setActiveGroup('all');
                        setSearchQuery('');
                        setStatusFilter('all');
                        loadChannels('all', '', 1, pageSizeRef.current, 'all');
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
                        onScanChannel={handleScanSingleChannel}
                        isScanning={scanningChannelId === channel.id}
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
                              onClick={() => handleChangePageSize(24)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                pageSize === 24
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              24 / trang
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChangePageSize(48)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                pageSize === 48
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              48 / trang
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChangePageSize(96)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                pageSize === 96
                                  ? 'bg-amber-500 text-neutral-950'
                                  : 'text-neutral-400 hover:text-white'
                              }`}
                            >
                              96 / trang
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
