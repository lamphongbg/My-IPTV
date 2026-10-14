import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { VlcLauncherModal } from './VlcLauncherModal';
import {
  Play,
  Pause,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Crop,
  Tv,
  ShieldCheck,
  Zap,
  Download,
  Smartphone,
  Sliders,
  Check,
  Subtitles,
  Sparkles
} from 'lucide-react';
import {
  SubtitleEngine,
  SubtitleDisplayMode,
  SubtitleFontSize,
  SubtitleTrackInfo,
  SubtitleCueItem,
  cleanCueText,
  translateSubtitleText,
} from '../services/subtitleTranslator';
import { SubtitleOverlay } from './SubtitleOverlay';
import { SubtitleMenu } from './SubtitleMenu';

export type AspectRatioMode = 'contain' | 'cover' | 'fill' | '16:9' | '4:3' | '21:9';

interface AspectRatioOption {
  id: AspectRatioMode;
  label: string;
  description: string;
  badge?: string;
}

const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  {
    id: 'contain',
    label: 'Chuẩn đài (Vừa vặn cân đối)',
    description: 'Giữ nguyên 100% tỷ lệ gốc của đài phát, không méo hình, cân bằng tuyệt đối trên mọi màn hình',
    badge: 'Mặc định',
  },
  {
    id: 'cover',
    label: 'Lấp đầy màn hình (Zoom không viền đen)',
    description: 'Phóng to tràn màn hình, cắt viền đen trên MacBook 16:10, UltraWide 21:9 & điện thoại',
    badge: 'Tràn viền',
  },
  {
    id: 'fill',
    label: 'Kéo giãn toàn màn hình (Stretch)',
    description: 'Kéo giãn 100% chiều ngang & dọc phủ kín màn hình, không mất góc hình',
  },
  {
    id: '16:9',
    label: 'Tỷ lệ 16:9 Widescreen Chuẩn',
    description: 'Ép chuẩn tỷ lệ 16:9, khắc phục các kênh anamorphic 720x576 bị co bẹp',
  },
  {
    id: '4:3',
    label: 'Tỷ lệ 4:3 Cổ điển (TV Vuông)',
    description: 'Tỷ lệ tivi truyền thống cho phim xưa, tư liệu, có viền đen 2 bên đối xứng',
  },
  {
    id: '21:9',
    label: 'Tỷ lệ 21:9 Điện ảnh (Cinema UltraWide)',
    description: 'Chuẩn màn ảnh rộng rạp chiếu phim, tuyệt đẹp cho màn hình UltraWide',
    badge: 'Cinema',
  },
];

interface HlsQualityLevel {
  index: number;
  height: number;
  width: number;
  bitrate: number;
  label: string;
  isSmoothPreset?: boolean;
}

interface VideoPlayerProps {
  channel: Channel | null;
  playTrigger?: number;
  onOpenDetails?: (channel: Channel) => void;
  isNokiaLightweight?: boolean;
  onChannelUpdate?: (channel: Channel) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playTrigger = 0,
  onOpenDetails,
  isNokiaLightweight,
  onChannelUpdate,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Keep live channel reference and avoid duplicate saves
  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);
  const persistedChannelIdsRef = useRef<Set<string>>(new Set());

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [autoplayMuted, setAutoplayMuted] = useState<boolean>(false);
  const [feedbackIcon, setFeedbackIcon] = useState<'play' | 'pause' | null>(null);
  const [isVlcModalOpen, setIsVlcModalOpen] = useState<boolean>(false);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolution selection states
  const [hlsLevels, setHlsLevels] = useState<HlsQualityLevel[]>([]);
  const [currentLevelIndex, setCurrentLevelIndex] = useState<number>(-1); // -1 = Auto
  const [activeResolutionLabel, setActiveResolutionLabel] = useState<string>('Tự động');
  const [isResolutionMenuOpen, setIsResolutionMenuOpen] = useState<boolean>(false);
  const [resolutionNotice, setResolutionNotice] = useState<string | null>(null);
  const resolutionMenuRef = useRef<HTMLDivElement>(null);
  const resolutionNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuPositionStyle, setMenuPositionStyle] = useState<React.CSSProperties>({});

  // Fullscreen & HUD overlay states
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aspect ratio state (support 5 professional IPTV aspect ratio modes)
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>(() => {
    try {
      const saved = localStorage.getItem('iptv_aspect_ratio');
      if (saved && ['contain', 'cover', 'fill', '16:9', '4:3', '21:9'].includes(saved)) {
        return saved as AspectRatioMode;
      }
    } catch {}
    return 'contain';
  });
  const [isAspectMenuOpen, setIsAspectMenuOpen] = useState<boolean>(false);
  const aspectMenuRef = useRef<HTMLDivElement>(null);
  const [aspectNotice, setAspectNotice] = useState<string | null>(null);
  const aspectNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Real-time Subtitle & Translation states (HLS CUE_ENTER + Google / Gemini AI)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('iptv_subtitles_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [subtitleEngine, setSubtitleEngine] = useState<SubtitleEngine>(() => {
    try {
      const saved = localStorage.getItem('iptv_subtitle_engine');
      if (saved === 'gemini' || saved === 'google') return saved;
    } catch {}
    return 'google';
  });
  const [subtitleDisplayMode, setSubtitleDisplayMode] = useState<SubtitleDisplayMode>(() => {
    try {
      const saved = localStorage.getItem('iptv_subtitle_mode');
      if (saved === 'dual' || saved === 'translated' || saved === 'original') return saved;
    } catch {}
    return 'dual';
  });
  const [subtitleTargetLang, setSubtitleTargetLang] = useState<string>(() => {
    try {
      return localStorage.getItem('iptv_subtitle_target_lang') || 'vi';
    } catch {
      return 'vi';
    }
  });
  const [subtitleFontSize, setSubtitleFontSize] = useState<SubtitleFontSize>(() => {
    try {
      const saved = localStorage.getItem('iptv_subtitle_font_size');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') return saved;
    } catch {}
    return 'md';
  });
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([]);
  const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState<number>(-1);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleCueItem | null>(null);
  const [isSubtitleMenuOpen, setIsSubtitleMenuOpen] = useState<boolean>(false);
  const subtitleMenuRef = useRef<HTMLDivElement>(null);
  const subtitleClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCueTextRef = useRef<string>('');
  const lastCueTimeRef = useRef<number>(0);

  // Synchronize subtitle refs for stable access in HLS event callbacks
  const subtitlesEnabledRef = useRef(subtitlesEnabled);
  useEffect(() => {
    subtitlesEnabledRef.current = subtitlesEnabled;
    try {
      localStorage.setItem('iptv_subtitles_enabled', subtitlesEnabled ? 'true' : 'false');
    } catch {}
  }, [subtitlesEnabled]);

  const subtitleEngineRef = useRef(subtitleEngine);
  useEffect(() => {
    subtitleEngineRef.current = subtitleEngine;
    try {
      localStorage.setItem('iptv_subtitle_engine', subtitleEngine);
    } catch {}
  }, [subtitleEngine]);

  const subtitleTargetLangRef = useRef(subtitleTargetLang);
  useEffect(() => {
    subtitleTargetLangRef.current = subtitleTargetLang;
    try {
      localStorage.setItem('iptv_subtitle_target_lang', subtitleTargetLang);
    } catch {}
  }, [subtitleTargetLang]);

  // Auto-persist detected subtitles (CEA-608 or HLS tracks) to the backend database
  const persistDetectedSubtitles = useCallback(
    async (
      detectedTracks: Array<{ name?: string; lang?: string; type?: string; isDefault?: boolean }>,
      sourceInfo = 'CEA-608'
    ) => {
      const currentChannel = channelRef.current;
      if (!currentChannel || !currentChannel.id) return;

      const existing = currentChannel.subtitle_tracks || [];
      const hasCeaAlready = currentChannel.has_subtitles && existing.some((t) => t.type === 'cea608');

      const persistKey = `${currentChannel.id}_${detectedTracks.map((t) => t.name || t.type).join('_')}`;
      if (persistedChannelIdsRef.current.has(persistKey)) {
        return;
      }
      if (hasCeaAlready && existing.length >= detectedTracks.length) {
        return;
      }
      persistedChannelIdsRef.current.add(persistKey);

      try {
        console.log(
          `[VideoPlayer] 🎯 Nhận diện luồng ${sourceInfo} lúc xem thực tế ("${currentChannel.name}"). Đang tự động lưu phụ đề...`
        );
        const res = await fetch(`/api/channels/${encodeURIComponent(currentChannel.id)}/subtitles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            has_subtitles: true,
            subtitle_tracks: detectedTracks,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.channel) {
            console.log(
              `[VideoPlayer] ✅ Đã tự động cập nhật phụ đề ${sourceInfo} cho kênh "${currentChannel.name}".`
            );
            if (onChannelUpdate) {
              onChannelUpdate(json.channel);
            }
          }
        }
      } catch (err) {
        console.warn('[VideoPlayer] Lỗi tự động lưu phụ đề:', err);
      }
    },
    [onChannelUpdate]
  );

  // Subtitle cue processing & translation handler
  const handleProcessCueText = useCallback(
    async (rawText: string, originatingTrack?: TextTrack | null) => {
      const cleaned = cleanCueText(rawText);
      if (!cleaned) return;

      // Prevent rapid duplicate cues within 1.5s
      const now = Date.now();
      if (cleaned === lastCueTextRef.current && now - lastCueTimeRef.current < 1500) {
        return;
      }
      lastCueTextRef.current = cleaned;
      lastCueTimeRef.current = now;

      // Auto-record CEA-608 on real cue reception during playback if not already marked
      const curChannel = channelRef.current;
      if (
        curChannel &&
        (!curChannel.has_subtitles ||
          !curChannel.subtitle_tracks ||
          curChannel.subtitle_tracks.length === 0)
      ) {
        const trackName = originatingTrack?.label || 'Phụ đề ẩn CEA-608 (Closed Captions)';
        const trackLang = originatingTrack?.language || subtitleTargetLangRef.current || 'vi';
        persistDetectedSubtitles(
          [
            {
              name: trackName,
              lang: trackLang,
              type: 'cea608',
              isDefault: true,
            },
          ],
          'CEA-608 (Cues thực tế)'
        );
      }

      if (!subtitlesEnabledRef.current) {
        return;
      }

      const cueId = `cue_${now}_${Math.random().toString(36).substring(2, 6)}`;
      setCurrentSubtitle({
        id: cueId,
        originalText: cleaned,
        translatedText: '',
        targetLang: subtitleTargetLangRef.current,
        engine: subtitleEngineRef.current,
        timestamp: now,
        active: true,
        isLoading: true,
      });

      if (subtitleClearTimerRef.current) {
        clearTimeout(subtitleClearTimerRef.current);
      }

      try {
        const res = await translateSubtitleText(
          cleaned,
          subtitleTargetLangRef.current,
          subtitleEngineRef.current
        );
        setCurrentSubtitle((prev) => {
          if (prev && prev.id === cueId) {
            return {
              ...prev,
              translatedText: res.translatedText,
              detectedLang: res.detectedLang,
              latencyMs: res.latencyMs,
              isLoading: false,
            };
          }
          return prev;
        });
      } catch (err) {
        console.warn('[VideoPlayer] Subtitle translation error:', err);
        setCurrentSubtitle((prev) => (prev && prev.id === cueId ? { ...prev, isLoading: false } : prev));
      }

      // Auto clear cue after 5.5 seconds if no new speech cue arrives
      subtitleClearTimerRef.current = setTimeout(() => {
        setCurrentSubtitle((prev) => (prev && prev.id === cueId ? { ...prev, active: false } : prev));
      }, 5500);
    },
    [persistDetectedSubtitles]
  );

  const handleToggleSubtitles = useCallback(() => {
    setSubtitlesEnabled((prev) => {
      const next = !prev;
      if (!next && subtitleClearTimerRef.current) {
        clearTimeout(subtitleClearTimerRef.current);
        setCurrentSubtitle(null);
      }
      return next;
    });
  }, []);

  const handleSelectSubtitleTrack = useCallback((trackId: number) => {
    setSelectedSubtitleTrackId(trackId);
    if (trackId >= 1000) {
      // Custom native TextTrack (CEA-608)
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = -1;
      }
      if (videoRef.current && videoRef.current.textTracks) {
        const realIdx = trackId - 1000;
        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = i === realIdx ? 'hidden' : 'disabled';
        }
      }
    } else {
      // Hls manifest subtitle track
      if (hlsRef.current) {
        hlsRef.current.subtitleTrack = trackId;
      }
      if (videoRef.current && videoRef.current.textTracks) {
        const tracks = videoRef.current.textTracks;
        for (let i = 0; i < tracks.length; i++) {
          tracks[i].mode = trackId === -1 ? 'disabled' : 'hidden';
        }
      }
    }
  }, []);

  // Auto-hide controls in fullscreen after 3s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    if (isFullscreen) {
      hideControlsTimerRef.current = setTimeout(() => {
        if (!isResolutionMenuOpen && !isAspectMenuOpen && !isSubtitleMenuOpen) {
          setShowControls(false);
        }
      }, 3000);
    }
  }, [isFullscreen, isResolutionMenuOpen, isAspectMenuOpen, isSubtitleMenuOpen]);

  useEffect(() => {
    if (isFullscreen) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
    }
  }, [isFullscreen, resetControlsTimer]);

  // Fullscreen change listener across browsers
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = Boolean(
        document.fullscreenElement === playerContainerRef.current ||
        (document as any).webkitFullscreenElement === playerContainerRef.current ||
        (document as any).mozFullScreenElement === playerContainerRef.current ||
        (document as any).msFullscreenElement === playerContainerRef.current
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Click outside to close aspect ratio menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        aspectMenuRef.current &&
        !aspectMenuRef.current.contains(event.target as Node)
      ) {
        setIsAspectMenuOpen(false);
      }
    };
    if (isAspectMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isAspectMenuOpen]);

  // Click outside to close subtitle menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        subtitleMenuRef.current &&
        !subtitleMenuRef.current.contains(event.target as Node)
      ) {
        setIsSubtitleMenuOpen(false);
      }
    };
    if (isSubtitleMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSubtitleMenuOpen]);

  // Aspect ratio selection handler with user notification
  const handleSelectAspectMode = useCallback((mode: AspectRatioMode) => {
    setAspectMode(mode);
    setIsAspectMenuOpen(false);
    try {
      localStorage.setItem('iptv_aspect_ratio', mode);
    } catch {}
    const labels: Record<AspectRatioMode, string> = {
      contain: 'Chuẩn đài / Cân đối (Vừa vặn)',
      cover: 'Lấp đầy màn hình (Cắt viền đen)',
      fill: 'Kéo giãn toàn màn hình',
      '16:9': 'Tỷ lệ 16:9 Widescreen',
      '4:3': 'Tỷ lệ 4:3 Cổ điển',
      '21:9': 'Tỷ lệ 21:9 Điện ảnh Cinema',
    };
    if (aspectNoticeTimerRef.current) clearTimeout(aspectNoticeTimerRef.current);
    setAspectNotice(labels[mode]);
    aspectNoticeTimerRef.current = setTimeout(() => {
      setAspectNotice(null);
    }, 2200);
  }, []);

  // Dynamic positioning for resolution menu to prevent clipping on narrow screens
  const updateMenuPosition = useCallback(() => {
    if (!resolutionMenuRef.current) return;
    const buttonRect = resolutionMenuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Boundary constraints: respect player container if available, otherwise viewport
    const containerRect = playerContainerRef.current?.getBoundingClientRect();
    const minLeft = (containerRect ? Math.max(containerRect.left, 8) : 8) + 8;
    const maxRight = (containerRect ? Math.min(containerRect.right, viewportWidth - 8) : viewportWidth - 8) - 8;

    // Available width for the menu (ensure minimum 260px, maximum 320px)
    const maxAvailableWidth = Math.max(260, maxRight - minLeft);
    const targetWidth = Math.min(320, maxAvailableWidth);

    // Initial target: align to left of button
    let targetLeft = buttonRect.left;

    // If aligning left causes right edge to spill past maxRight, shift left
    if (targetLeft + targetWidth > maxRight) {
      targetLeft = maxRight - targetWidth;
    }
    // If shifting left causes left edge to spill past minLeft, clamp to minLeft
    if (targetLeft < minLeft) {
      targetLeft = minLeft;
    }

    // Convert to relative coordinate from the resolutionMenuRef button container
    const relLeft = targetLeft - buttonRect.left;

    setMenuPositionStyle({
      left: `${Math.round(relLeft)}px`,
      width: `${Math.round(targetWidth)}px`,
      maxWidth: `${Math.round(maxAvailableWidth)}px`,
    });
  }, []);

  useEffect(() => {
    if (isResolutionMenuOpen) {
      updateMenuPosition();
      const handleReposition = () => updateMenuPosition();
      window.addEventListener('resize', handleReposition);
      window.addEventListener('scroll', handleReposition, true);
      return () => {
        window.removeEventListener('resize', handleReposition);
        window.removeEventListener('scroll', handleReposition, true);
      };
    }
  }, [isResolutionMenuOpen, updateMenuPosition]);

  // Click outside to close resolution menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resolutionMenuRef.current &&
        !resolutionMenuRef.current.contains(event.target as Node)
      ) {
        setIsResolutionMenuOpen(false);
      }
    };
    if (isResolutionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isResolutionMenuOpen]);

  const showResolutionNotice = useCallback((text: string) => {
    if (resolutionNoticeTimerRef.current) {
      clearTimeout(resolutionNoticeTimerRef.current);
    }
    setResolutionNotice(text);
    resolutionNoticeTimerRef.current = setTimeout(() => {
      setResolutionNotice(null);
    }, 2200);
  }, []);

  const triggerFeedback = useCallback((type: 'play' | 'pause') => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedbackIcon(type);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackIcon(null);
    }, 600);
  }, []);

  // Proxy state: auto-enable if stream is insecure HTTP loaded on HTTPS, or when direct fails
  const [useProxy, setUseProxy] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && channel?.stream_url) {
      return window.location.protocol === 'https:' && channel.stream_url.startsWith('http:');
    }
    return false;
  });

  // Calculate actual playback URL
  const getStreamSource = useCallback(
    (streamUrl: string, proxyEnabled: boolean): string => {
      if (proxyEnabled) {
        return `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}`;
      }
      // Force proxy if mixed-content (HTTP on HTTPS page)
      if (
        typeof window !== 'undefined' &&
        window.location.protocol === 'https:' &&
        streamUrl.startsWith('http:')
      ) {
        return `/api/proxy/stream?url=${encodeURIComponent(streamUrl)}`;
      }
      return streamUrl;
    },
    []
  );

  // Load and play stream
  const startPlayback = useCallback(
    (proxyMode: boolean) => {
      if (!channel || !videoRef.current) return;

      const video = videoRef.current;
      setHasError(false);
      setErrorMessage('');
      setIsLoading(true);

      // Initialize subtitle tracks from channel data if available
      if (channel.subtitle_tracks && channel.subtitle_tracks.length > 0) {
        setSubtitleTracks(
          channel.subtitle_tracks.map((t, idx) => ({
            id: typeof t.id === 'number' ? t.id : idx,
            name: t.name || `Phụ đề ${idx + 1}`,
            lang: t.lang || '',
            type: t.type,
            default: t.isDefault || t.default,
          }))
        );
      } else {
        setSubtitleTracks([]);
      }

      // Clean up previous HLS instance safely
      if (hlsRef.current) {
        try {
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }

      // Safely clear prior video src before setting new source
      if (video.src) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {
          // ignore
        }
      }

      const rawUrl = channel.stream_url.trim();
      const effectiveSource = getStreamSource(rawUrl, proxyMode);
      const isHlsStream =
        rawUrl.includes('.m3u8') ||
        effectiveSource.includes('.m3u8') ||
        channel.format === 'hls' ||
        rawUrl.includes('chunklist');

      // 1. PREFER HLS.js for all browsers supporting MediaSource (Chrome, Edge, Firefox, Android)
      if (isHlsStream && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 60,
          maxBufferLength: 30,
          enableCEA708Captions: true,
          renderTextTracksNatively: false,
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(effectiveSource);
        hls.attachMedia(video);

        // Subtitle track updates from Hls stream
        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_event, data) => {
          if (data && Array.isArray(data.subtitleTracks)) {
            const parsedTracks: SubtitleTrackInfo[] = data.subtitleTracks.map((t, idx) => ({
              id: idx,
              name: t.name || `Phụ đề ${idx + 1}`,
              lang: t.lang || '',
              type: t.type,
              default: t.default,
            }));
            setSubtitleTracks((prev) => {
              const ceaTracks = prev.filter((p) => p.type === 'cea608');
              return [...parsedTracks, ...ceaTracks];
            });

            if (subtitlesEnabledRef.current && hls.subtitleTrack === -1 && parsedTracks.length > 0) {
              hls.subtitleTrack = 0;
              setSelectedSubtitleTrackId(0);
            }

            const curChannel = channelRef.current;
            if (
              parsedTracks.length > 0 &&
              curChannel &&
              (!curChannel.has_subtitles ||
                !curChannel.subtitle_tracks ||
                curChannel.subtitle_tracks.length === 0)
            ) {
              persistDetectedSubtitles(
                parsedTracks.map((t) => ({
                  name: t.name,
                  lang: t.lang,
                  type: (t.type as any) || 'embedded',
                  isDefault: t.default,
                })),
                'HLS Subtitle Manifest'
              );
            }
          }
        });

        hls.on(Hls.Events.SUBTITLE_TRACK_SWITCH, (_event, data) => {
          setSelectedSubtitleTrackId(data.id);
        });

        // Scan HTML5 textTracks on video element (detects CEA-608 & VTT)
        const scanAndRecordTextTracks = () => {
          const tracks = video.textTracks;
          if (!tracks) return;

          const foundCeaTracks: SubtitleTrackInfo[] = [];

          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            track.mode = 'hidden'; // Hide default native browser black box

            track.oncuechange = () => {
              if (track.activeCues && track.activeCues.length > 0) {
                const cue = track.activeCues[0] as any;
                if (cue && cue.text) {
                  handleProcessCueText(cue.text, track);
                }
              }
            };

            const isCaption = track.kind === 'captions' || track.kind === 'subtitles';
            const label = track.label || '';
            const isCea = isCaption || /cc|608|708|caption|closed/i.test(label);

            if (isCea) {
              const trackName =
                label ||
                (track.kind === 'captions' ? `Phụ đề ẩn CEA-608 (CC${i + 1})` : `Phụ đề ${i + 1}`);
              foundCeaTracks.push({
                id: 1000 + i,
                name: trackName,
                lang: track.language || 'vi',
                type: 'cea608',
                default: i === 0,
              });
            }
          }

          if (foundCeaTracks.length > 0) {
            setSubtitleTracks((prev) => {
              const merged = [...prev];
              for (const cea of foundCeaTracks) {
                if (!merged.some((p) => p.name === cea.name || (p.type === 'cea608' && p.lang === cea.lang))) {
                  merged.push(cea);
                }
              }
              return merged;
            });

            // Automatically persist CEA-608 detected tracks to database
            persistDetectedSubtitles(
              foundCeaTracks.map((t) => ({
                name: t.name,
                lang: t.lang,
                type: 'cea608',
                isDefault: t.default,
              })),
              'CEA-608 TextTrack'
            );
          }
        };

        const setupTextTracksFallback = () => {
          scanAndRecordTextTracks();
          const tracks = video.textTracks;
          if (!tracks) return;

          tracks.onaddtrack = (e: TrackEvent) => {
            const track = e.track as TextTrack | null;
            if (track) {
              track.mode = 'hidden';
              track.oncuechange = () => {
                if (track.activeCues && track.activeCues.length > 0) {
                  const cue = track.activeCues[0] as any;
                  if (cue && cue.text) {
                    handleProcessCueText(cue.text, track);
                  }
                }
              };
              scanAndRecordTextTracks();
            }
          };
        };
        setupTextTracksFallback();

        // Real-time subtitle cue arrival (Hls.Events.CUE_ENTER & CUES_PARSED)
        const cueEnterEvent = ((Hls.Events as any).CUE_ENTER || (Hls.Events as any).EVENT_CUE_ENTER || 'hlsEventCueEnter') as any;
        hls.on(cueEnterEvent, (_event: any, data: any) => {
          const cue = data?.cue || data;
          const text = cue?.text || (typeof cue === 'string' ? cue : '');
          if (text) {
            handleProcessCueText(text);
          }
        });

        hls.on(Hls.Events.CUES_PARSED, (_event: any, data: any) => {
          if (data && Array.isArray(data.cues)) {
            data.cues.forEach((c: any) => {
              if (c && c.text) {
                handleProcessCueText(c.text);
              }
            });
            scanAndRecordTextTracks();
          }
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);

          if (hls.levels && hls.levels.length > 0) {
            const parsed: HlsQualityLevel[] = hls.levels.map((lvl, idx) => {
              const h = lvl.height || 0;
              const w = lvl.width || 0;
              let label = h > 0 ? `${h}p` : `Mức ${idx + 1}`;
              if (h >= 1080) label = `${h}p Full HD`;
              else if (h >= 720) label = `${h}p HD`;
              else if (h >= 480) label = `${h}p SD`;
              else if (h >= 360) label = `${h}p (Mượt mà)`;
              else if (h > 0 && h <= 240) label = `${h}p (Siêu nhẹ)`;

              return {
                index: idx,
                height: h,
                width: w,
                bitrate: lvl.bitrate || 0,
                label,
                isSmoothPreset: h > 0 && h <= 480,
              };
            });

            // Sort by height descending
            parsed.sort((a, b) => (b.height || 0) - (a.height || 0));
            setHlsLevels(parsed);

            // Restore saved user resolution preference if available
            const savedRes = typeof window !== 'undefined' ? localStorage.getItem('iptv_preferred_resolution') : null;
            if (savedRes && savedRes !== 'auto') {
              const targetHeight = parseInt(savedRes, 10);
              const matched = parsed.find((p) => p.height === targetHeight);
              if (matched) {
                hls.currentLevel = matched.index;
                setCurrentLevelIndex(matched.index);
                setActiveResolutionLabel(matched.label);
              } else {
                setCurrentLevelIndex(-1);
                setActiveResolutionLabel('Tự động');
              }
            } else {
              setCurrentLevelIndex(-1);
              setActiveResolutionLabel('Tự động');
            }
          } else {
            setHlsLevels([]);
            setCurrentLevelIndex(-1);
            setActiveResolutionLabel('Tự động');
          }

          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setAutoplayMuted(false);
            })
            .catch((err) => {
              if (err?.name === 'AbortError') return;
              // Browser Autoplay Policy: modern browsers require user interaction before playing audio.
              // Gracefully fallback to muted autoplay so video starts immediately without getting stuck.
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setAutoplayMuted(true);
                })
                .catch((err2) => {
                  if (err2?.name !== 'AbortError') {
                    setIsPlaying(false);
                  }
                });
            });
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          if (hls.currentLevel === -1 && hls.levels && hls.levels[data.level]) {
            const activeLevel = hls.levels[data.level];
            const h = activeLevel.height;
            if (h) {
              setActiveResolutionLabel(`Tự động (${h}p)`);
            }
          }
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.warn('HLS Event Error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (!proxyMode) {
                  // Direct stream failed (CORS or server blocked). Auto switch to proxy!
                  console.info('Direct stream blocked by CORS/network. Auto-enabling Proxy CORS...');
                  try {
                    hls.detachMedia();
                    hls.destroy();
                  } catch {
                    // ignore
                  }
                  hlsRef.current = null;
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setHasError(true);
                  setErrorMessage(
                    'Không thể kết nối đến máy chủ nguồn IPTV (Server luồng phát có thể đang ngoại tuyến hoặc đã đổi đường dẫn).'
                  );
                  setIsLoading(false);
                  try {
                    hls.detachMedia();
                    hls.destroy();
                  } catch {
                    // ignore
                  }
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                try {
                  hls.recoverMediaError();
                } catch {
                  // ignore
                }
                break;
              default:
                if (!proxyMode) {
                  try {
                    hls.detachMedia();
                    hls.destroy();
                  } catch {
                    // ignore
                  }
                  hlsRef.current = null;
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setHasError(true);
                  setErrorMessage('Định dạng luồng phát không tương thích với trình duyệt hiện tại.');
                  setIsLoading(false);
                  try {
                    hls.detachMedia();
                    hls.destroy();
                  } catch {
                    // ignore
                  }
                }
                break;
            }
          }
        });
        return;
      }

      // 2. Native HLS support for Safari iOS / macOS (where Hls.isSupported is false)
      if (isHlsStream && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = effectiveSource;
        video.load();

        // Native Safari CEA-608 & TextTrack listener
        const scanNativeTracks = () => {
          const tracks = video.textTracks;
          if (!tracks) return;
          const foundCeaTracks: SubtitleTrackInfo[] = [];
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            track.mode = 'hidden';
            track.oncuechange = () => {
              if (track.activeCues && track.activeCues.length > 0) {
                const cue = track.activeCues[0] as any;
                if (cue && cue.text) handleProcessCueText(cue.text, track);
              }
            };
            const isCaption = track.kind === 'captions' || track.kind === 'subtitles';
            const label = track.label || '';
            const isCea = isCaption || /cc|608|708|caption|closed/i.test(label);
            if (isCea) {
              const trackName =
                label || (track.kind === 'captions' ? `Phụ đề ẩn CEA-608 (CC${i + 1})` : `Phụ đề ${i + 1}`);
              foundCeaTracks.push({
                id: 1000 + i,
                name: trackName,
                lang: track.language || 'vi',
                type: 'cea608',
                default: i === 0,
              });
            }
          }
          if (foundCeaTracks.length > 0) {
            setSubtitleTracks((prev) => {
              const merged = [...prev];
              for (const cea of foundCeaTracks) {
                if (!merged.some((p) => p.name === cea.name || (p.type === 'cea608' && p.lang === cea.lang))) {
                  merged.push(cea);
                }
              }
              return merged;
            });
            persistDetectedSubtitles(
              foundCeaTracks.map((t) => ({ name: t.name, lang: t.lang, type: 'cea608', isDefault: t.default })),
              'CEA-608 Safari Native'
            );
          }
        };

        scanNativeTracks();
        if (video.textTracks) {
          video.textTracks.onaddtrack = () => scanNativeTracks();
        }
        video
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setAutoplayMuted(false);
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return;
            // Fallback: try muted autoplay immediately if unmuted was blocked by browser
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
                setAutoplayMuted(true);
              })
              .catch((err2) => {
                if (err2?.name === 'AbortError') return;
                if (!proxyMode) {
                  console.info('Switching to proxy mode on native error...');
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage('Trình duyệt không thể phát trực tiếp luồng này.');
                }
              });
          });
        return;
      }

      // 3. Direct HTML5 video fallback (MP4 or HTTP)
      video.src = effectiveSource;
      video.load();
      video
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
          setAutoplayMuted(false);
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          video.muted = true;
          setIsMuted(true);
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setIsLoading(false);
              setAutoplayMuted(true);
            })
            .catch((err2) => {
              if (err2?.name === 'AbortError') return;
              if (!proxyMode) {
                setUseProxy(true);
                startPlayback(true);
              } else {
                setHasError(true);
                setErrorMessage('Trình duyệt không hỗ trợ giải mã trực tiếp luồng này.');
                setIsLoading(false);
              }
            });
        });
    },
    [channel, getStreamSource]
  );

  // Trigger playback when channel changes, playTrigger increments, or useProxy toggles
  useEffect(() => {
    if (!channel) return;
    const initialProxy =
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      channel.stream_url.startsWith('http:');
    setUseProxy(initialProxy);
    startPlayback(initialProxy);

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {
          // ignore
        }
        hlsRef.current = null;
      }
      if (videoRef.current && videoRef.current.src) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch {
          // ignore
        }
      }
    };
  }, [channel, playTrigger, startPlayback]);

  // User interactions: Ground truth DOM-driven play/pause toggle
  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    // If currently playing in autoplay muted state, clicking the video screen seamlessly un-mutes audio!
    if (autoplayMuted && !video.paused) {
      video.muted = false;
      setIsMuted(false);
      setAutoplayMuted(false);
      triggerFeedback('play');
      return;
    }

    // Check DOM ground truth rather than stale React state
    const isCurrentlyPaused = video.paused || video.ended;

    if (!isCurrentlyPaused) {
      // Currently playing -> Pause immediately!
      try {
        video.pause();
      } catch (e) {
        console.warn('Error pausing video:', e);
      }
      setIsPlaying(false);
      triggerFeedback('pause');
    } else {
      // Currently paused -> Play!
      triggerFeedback('play');
      const promise = video.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            setIsPlaying(true);
            setAutoplayMuted(false);
          })
          .catch((err) => {
            // If play was interrupted by user pausing immediately, do nothing
            if (err?.name === 'AbortError') {
              setIsPlaying(false);
              return;
            }
            // Retry muted if browser policy blocked unmuted play
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
                setAutoplayMuted(true);
              })
              .catch((err2) => {
                if (err2?.name !== 'AbortError') {
                  setIsPlaying(false);
                }
              });
          });
      }
    }
  }, [autoplayMuted, triggerFeedback]);

  const handleToggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted) {
      setAutoplayMuted(false);
    }
  }, []);

  const handleUnmuteAudio = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    setIsMuted(false);
    setAutoplayMuted(false);
  }, []);

  const handleToggleProxy = useCallback(() => {
    const nextProxy = !useProxy;
    setUseProxy(nextProxy);
    startPlayback(nextProxy);
  }, [useProxy, startPlayback]);

  const handleRetry = useCallback(() => {
    startPlayback(useProxy);
  }, [useProxy, startPlayback]);

  const handleForceProxyRetry = useCallback(() => {
    setUseProxy(true);
    startPlayback(true);
  }, [startPlayback]);

  const handleCopy = useCallback(() => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.stream_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [channel]);

  const handleSelectLevel = useCallback(
    (levelIndex: number, label: string) => {
      if (!hlsRef.current) return;
      const hls = hlsRef.current;
      hls.currentLevel = levelIndex;
      setCurrentLevelIndex(levelIndex);
      setIsResolutionMenuOpen(false);

      if (levelIndex === -1) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('iptv_preferred_resolution', 'auto');
        }
        setActiveResolutionLabel('Tự động');
        showResolutionNotice('⚡ Đã bật Tự động điều chỉnh theo tốc độ mạng');
      } else {
        const selected = hlsLevels.find((l) => l.index === levelIndex);
        if (selected && selected.height) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('iptv_preferred_resolution', `${selected.height}`);
          }
        }
        setActiveResolutionLabel(label);
        showResolutionNotice(`✓ Đã chọn ${label} • Tải nhanh & xem mượt mà`);
      }
    },
    [hlsLevels, showResolutionNotice]
  );

  const handleToggleFullscreen = useCallback(() => {
    const container = playerContainerRef.current || videoRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if ((videoRef.current as any)?.webkitEnterFullscreen) {
        (videoRef.current as any).webkitEnterFullscreen();
      }
    }
  }, []);

  // Keyboard shortcut listener (Space/K = Play/Pause, M = Mute, F = Fullscreen)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
        return;
      }

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
      } else if (e.key === 'r' || e.key === 'R' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const modes: AspectRatioMode[] = ['contain', 'cover', 'fill', '16:9', '4:3', '21:9'];
        const nextIdx = (modes.indexOf(aspectMode) + 1) % modes.length;
        handleSelectAspectMode(modes[nextIdx]);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleToggleSubtitles();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleToggleMute, handleToggleFullscreen, aspectMode, handleSelectAspectMode, handleToggleSubtitles]);

  const handleVideoMediaError = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
      // Intercept media error event to prevent unhandled bubbling to window
      e.stopPropagation();
      const video = videoRef.current;
      const mediaErr = video?.error;
      console.warn('HTML5 Video Error intercepted:', mediaErr?.code, mediaErr?.message);

      if (!useProxy && channel) {
        console.info('Auto-switching to proxy CORS after video element error...');
        setUseProxy(true);
        startPlayback(true);
      } else {
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(
          'Trình duyệt không hỗ trợ giải mã trực tiếp nguồn phát này hoặc nguồn phát đang bảo trì. Bạn có thể bấm "Xem trên VLC player" để mở luồng mượt mà.'
        );
      }
    },
    [channel, useProxy, startPlayback]
  );

  if (!channel) {
    return (
      <div className="w-full aspect-video bg-neutral-900 border border-neutral-800 rounded-xl flex flex-col items-center justify-center p-6 text-center text-neutral-400 shadow-xl">
        <div className="w-16 h-16 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center mb-3 text-amber-500">
          <Play className="w-8 h-8 fill-current ml-1" />
        </div>
        <h3 className="text-lg font-semibold text-neutral-200">Chưa chọn kênh truyền hình</h3>
        <p className="text-xs text-neutral-500 max-w-sm mt-1">
          Chọn một kênh từ danh sách bên phải hoặc bấm vào biểu tượng Play để bắt đầu phát.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      className={`${
        isFullscreen
          ? 'fixed inset-0 w-screen h-screen bg-black z-[9999] overflow-hidden flex flex-col justify-between'
          : 'w-full bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl flex flex-col relative'
      } ${isFullscreen && !showControls ? 'cursor-none' : 'cursor-auto'}`}
    >
      {/* Fullscreen Top Floating Bar */}
      {isFullscreen && (
        <div
          className={`absolute top-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-b from-black/90 via-black/50 to-transparent z-40 transition-opacity duration-300 flex items-center justify-between gap-4 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-9 h-9 object-contain bg-black/60 rounded-lg p-0.5 border border-white/20 flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-9 h-9 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center font-bold text-amber-400 text-xs flex-shrink-0">
                IPTV
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                  {channel.name}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {channel.group}
                </span>
                {useProxy && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Proxy Bật
                  </span>
                )}
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950/80 text-sky-300 border border-sky-700/60 font-mono">
                  {activeResolutionLabel}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const modes: AspectRatioMode[] = ['contain', 'cover', 'fill', '16:9', '4:3', '21:9'];
                    const nextIdx = (modes.indexOf(aspectMode) + 1) % modes.length;
                    handleSelectAspectMode(modes[nextIdx]);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-800/90 hover:bg-neutral-700 text-amber-300 hover:text-amber-200 border border-neutral-700 font-mono transition cursor-pointer flex items-center gap-1 active:scale-95"
                  title="Nhấn để đổi tỷ lệ khung hình (Phím R)"
                >
                  <Crop className="w-2.5 h-2.5 text-amber-400" />
                  <span>Tỷ lệ: {aspectMode === 'contain' ? 'Chuẩn đài' : aspectMode === 'cover' ? 'Lấp đầy' : aspectMode === 'fill' ? 'Kéo giãn' : aspectMode}</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSubtitles();
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono transition cursor-pointer flex items-center gap-1 active:scale-95 ${
                    subtitlesEnabled
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/60 hover:bg-amber-500/35'
                      : 'bg-neutral-800/90 hover:bg-neutral-700 text-neutral-400 border-neutral-700'
                  }`}
                  title="Nhấn để Bật/Tắt phụ đề & Dịch AI (Phím C)"
                >
                  <Subtitles className="w-2.5 h-2.5 text-amber-400" />
                  <span>CC: {subtitlesEnabled ? `Dịch ${subtitleTargetLang.toUpperCase()}` : 'Tắt'}</span>
                </button>
              </div>
              <p className="text-[11px] text-neutral-300 truncate mt-0.5">
                {channel.description || `Định dạng ${channel.format.toUpperCase()} • Codec ${channel.video_codec || 'H.264'} / ${channel.audio_codec || 'AAC'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleFullscreen}
              className="px-3 py-1.5 bg-neutral-800/80 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md border border-neutral-700 transition cursor-pointer"
              title="Thoát chế độ toàn màn hình (Esc hoặc F)"
            >
              <Minimize className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Thoát toàn màn hình</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Canvas Container */}
      <div
        className={`relative w-full bg-black flex items-center justify-center group overflow-hidden ${
          isFullscreen
            ? 'w-full h-full flex-1 max-h-screen'
            : 'aspect-video rounded-t-xl'
        }`}
      >
        <video
          ref={videoRef}
          className={`${
            aspectMode === 'cover'
              ? 'w-full h-full object-cover object-center'
              : aspectMode === 'fill'
              ? 'w-full h-full object-fill'
              : aspectMode === '16:9'
              ? isFullscreen
                ? 'w-full h-full max-w-[calc(100dvh*16/9)] max-h-[calc(100dvw*9/16)] aspect-video object-fill mx-auto my-auto'
                : 'w-full h-full object-fill aspect-video'
              : aspectMode === '4:3'
              ? isFullscreen
                ? 'w-full h-full max-w-[calc(100dvh*4/3)] max-h-[calc(100dvw*3/4)] aspect-[4/3] object-fill mx-auto my-auto'
                : 'h-full aspect-[4/3] object-fill mx-auto'
              : aspectMode === '21:9'
              ? isFullscreen
                ? 'w-full h-full max-w-[calc(100dvh*21/9)] max-h-[calc(100dvw*9/21)] aspect-[21/9] object-fill mx-auto my-auto'
                : 'w-full aspect-[21/9] object-fill mx-auto'
              : 'w-full h-full object-contain mx-auto my-auto'
          } pointer-events-none select-none transition-all duration-200`}
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onPlaying={() => {
            setIsPlaying(true);
            setIsLoading(false);
          }}
          onWaiting={() => setIsLoading(true)}
          onEnded={() => setIsPlaying(false)}
          onError={handleVideoMediaError}
        />

        {/* Real-time Subtitle & Translation Broadcast Overlay */}
        <SubtitleOverlay
          currentSubtitle={currentSubtitle}
          displayMode={subtitleDisplayMode}
          fontSize={subtitleFontSize}
          enabled={subtitlesEnabled}
          isFullscreen={isFullscreen}
        />

        {/* Full-surface Screen Click Overlay (Click anywhere to pause/play, double-click for fullscreen) */}
        {!hasError && !isLoading && (
          <div
            className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center select-none"
            onClick={handleTogglePlay}
            onDoubleClick={handleToggleFullscreen}
          >
            {/* Transient Animated Feedback Icon (Pause ⏸ / Play ▶) */}
            {feedbackIcon && (
              <div className="w-16 h-16 rounded-full bg-neutral-950/85 backdrop-blur-md border border-neutral-700 text-amber-400 flex items-center justify-center shadow-2xl transition-all scale-110 pointer-events-none animate-pulse">
                {feedbackIcon === 'pause' ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </div>
            )}

            {/* Persistent Big Center Play Button when Paused (and not showing feedback) */}
            {!isPlaying && !feedbackIcon && (
              <div
                className="w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 hover:scale-110 active:scale-95 transition-all pointer-events-none"
                title="Bấm để phát (Play)"
              >
                <Play className="w-8 h-8 fill-current ml-1" />
              </div>
            )}
          </div>
        )}

        {/* Autoplay Muted Notice */}
        {isPlaying && autoplayMuted && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleUnmuteAudio();
            }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-amber-500 hover:bg-amber-400 text-neutral-950 px-4 py-2 rounded-full font-bold text-xs sm:text-sm flex items-center gap-2 shadow-2xl cursor-pointer transition transform hover:scale-105 active:scale-95 animate-bounce border border-amber-300"
            title="Nhấn để bật âm thanh (Chính sách bảo mật trình duyệt yêu cầu tương tác để mở âm thanh)"
          >
            <VolumeX className="w-4 h-4" />
            <span>Đang phát tắt tiếng. Bấm vào đây để BẬT TIẾNG!</span>
          </button>
        )}

        {/* On-screen Resolution Change Toast Notice */}
        {resolutionNotice && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 text-amber-300 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-2xl border border-amber-500/50 pointer-events-none animate-pulse">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span>{resolutionNotice}</span>
          </div>
        )}

        {/* On-screen Aspect Ratio Notice */}
        {aspectNotice && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 text-amber-300 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-2xl border border-amber-500/50 pointer-events-none animate-pulse">
            <Crop className="w-3.5 h-3.5 text-amber-400" />
            <span>Tỷ lệ: {aspectNotice}</span>
          </div>
        )}

        {/* Active Resolution Pill (Top Left) */}
        {isPlaying && !isLoading && (
          <div className="absolute top-3 left-3 z-20 pointer-events-none">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-black/60 text-neutral-300 border border-neutral-700/60 backdrop-blur-sm flex items-center gap-1 shadow">
              <Sliders className="w-2.5 h-2.5 text-sky-400" />
              <span>{activeResolutionLabel}</span>
            </span>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center pointer-events-none z-10">
            <RefreshCw className="w-10 h-10 text-amber-400 animate-spin mb-2" />
            <p className="text-xs text-neutral-300 font-semibold tracking-wide">
              {useProxy ? 'ĐANG KẾT NỐI QUA PROXY CORS...' : 'ĐANG TẢI LUỒNG PHÁT...'}
            </p>
          </div>
        )}

        {/* Error Fallback Banner */}
        {hasError && (
          <div className="absolute inset-0 bg-neutral-950/95 flex flex-col items-center justify-center p-6 text-center z-20 overflow-y-auto">
            <AlertCircle className="w-12 h-12 text-rose-500 mb-2" />
            <h4 className="text-base font-bold text-white">Không thể phát trực tiếp trên trình duyệt</h4>
            <p className="text-xs text-neutral-400 max-w-md mt-1 mb-4 leading-relaxed">
              {errorMessage || 'Nguồn phát IPTV thường chặn CORS hoặc sử dụng giao thức chỉ hỗ trợ trên app chuyên dụng.'}
            </p>

            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {/* Force Proxy Retry Button */}
              {!useProxy ? (
                <button
                  type="button"
                  onClick={handleForceProxyRetry}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Phát qua Proxy CORS (Khuyên dùng)
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-4 h-4" />
                  Thử lại Proxy
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                {copied ? 'Đã sao chép' : 'Sao chép URL'}
              </button>

              <a
                href={channel.stream_url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở link gốc
              </a>

              {isNokia ? (
                <a
                  href={`/open/${channel.id}`}
                  className="px-3 py-2 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                  title="Tự động khởi chạy CorePlayer trên Nokia E72"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mở bằng CorePlayer
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      launchVlcPlayer(channel.stream_url, channel.id);
                      setIsVlcModalOpen(true);
                    }}
                    className="px-3 py-2 bg-orange-800 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Khởi chạy trên ứng dụng VLC Player"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Xem trên VLC player
                  </button>
                  <a
                    href={`/api/channel/${channel.id}/vlc.m3u8`}
                    download={`${channel.name}.m3u8`}
                    className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-neutral-700"
                    title="Tải file .M3U8 để mở bằng VLC"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    Tải file .M3U8
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Player Meta Info Bar */}
      <div
        className={`${
          isFullscreen
            ? `absolute bottom-0 inset-x-0 p-4 sm:p-5 bg-gradient-to-t from-black/95 via-black/75 to-transparent z-40 transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`
            : 'p-3.5 bg-neutral-900 border-t border-neutral-800 rounded-b-xl'
        } flex flex-col md:flex-row md:items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-3">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-11 h-11 object-contain bg-neutral-800 rounded-lg p-1 border border-neutral-700 flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-11 h-11 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center font-bold text-amber-400 text-xs flex-shrink-0">
              IPTV
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                {channel.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {channel.group}
              </span>
              {useProxy && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Proxy CORS Bật
                </span>
              )}
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {channel.description ||
                `Định dạng ${channel.format.toUpperCase()} • Codec ${channel.video_codec || 'H.264'} / ${channel.audio_codec || 'AAC'}`}
            </p>
          </div>
        </div>

        {/* Quick Actions & Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Proxy Toggle Button */}
          <button
            type="button"
            onClick={handleToggleProxy}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition border ${
              useProxy
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
            }`}
            title="Bật/Tắt máy chủ Proxy CORS giải quyết chặn luồng"
          >
            <Zap className={`w-3.5 h-3.5 ${useProxy ? 'text-emerald-400' : ''}`} />
            <span>Proxy: {useProxy ? 'BẬT' : 'TẮT'}</span>
          </button>

          {/* Resolution / Quality Selector */}
          <div className="relative" ref={resolutionMenuRef}>
            <button
              type="button"
              onClick={() => setIsResolutionMenuOpen(!isResolutionMenuOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                isResolutionMenuOpen
                  ? 'bg-sky-950/80 text-sky-200 border-sky-600'
                  : currentLevelIndex >= 0 && (hlsLevels.find((l) => l.index === currentLevelIndex)?.height || 0) <= 480
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/60 hover:bg-emerald-900/60'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title="Tùy chọn độ phân giải: Giảm độ phân giải (360p/240p) để tăng tốc độ tải và xem mượt mà hơn khi mạng yếu"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Độ phân giải:</span>
              <span className="max-w-[105px] truncate font-bold text-amber-300">{activeResolutionLabel}</span>
              {currentLevelIndex >= 0 && (hlsLevels.find((l) => l.index === currentLevelIndex)?.height || 0) <= 480 && (
                <span className="px-1 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-400 font-bold hidden md:inline">
                  ⚡ MƯỢT
                </span>
              )}
            </button>

            {/* Resolution Dropdown Popup & Mobile Bottom Sheet */}
            {isResolutionMenuOpen && (
              <>
                {/* Mobile Bottom Sheet Drawer for narrow screens (screen width < 640px) */}
                <div
                  className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-end justify-center p-0 sm:hidden animate-fadeIn"
                  onClick={() => setIsResolutionMenuOpen(false)}
                >
                  <div
                    className="w-full max-w-lg bg-neutral-950 border-t border-neutral-800 rounded-t-2xl p-4 shadow-2xl text-xs z-50 pb-8 flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-sky-400" />
                        <span className="font-bold text-neutral-100 text-sm">Tùy chọn độ phân giải</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsResolutionMenuOpen(false)}
                        className="text-neutral-400 hover:text-white p-1 text-base rounded hover:bg-neutral-800"
                        title="Đóng"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-[11px] text-neutral-400 mb-2.5 leading-relaxed bg-neutral-900/80 p-2.5 rounded-lg border border-neutral-800/60">
                      💡 <strong>Mẹo xem mượt:</strong> Chọn độ phân giải <strong>360p</strong> hoặc <strong>480p</strong> giúp video tải nhanh hơn tức thì, giảm giật lag và tiết kiệm 70% băng thông mạng khi mạng yếu.
                    </p>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {/* Option: Auto */}
                      <button
                        type="button"
                        onClick={() => handleSelectLevel(-1, 'Tự động')}
                        className={`w-full p-2.5 rounded-lg flex items-center justify-between transition text-left gap-2 ${
                          currentLevelIndex === -1
                            ? 'bg-sky-950/70 border border-sky-600/70 text-sky-200'
                            : 'hover:bg-neutral-900 text-neutral-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                            <span>Tự động (HLS)</span>
                            <span className="text-[9px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded whitespace-nowrap">Khuyên dùng</span>
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                            Tự điều chỉnh theo tốc độ đường truyền
                          </div>
                        </div>
                        {currentLevelIndex === -1 && <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                      </button>

                      {/* Detected Quality Levels */}
                      {hlsLevels.length > 0 ? (
                        hlsLevels.map((lvl) => {
                          const isSelected = currentLevelIndex === lvl.index;
                          return (
                            <button
                              key={lvl.index}
                              type="button"
                              onClick={() => handleSelectLevel(lvl.index, lvl.label)}
                              className={`w-full p-2.5 rounded-lg flex items-center justify-between transition text-left gap-2 ${
                                isSelected
                                  ? 'bg-amber-950/70 border border-amber-600/70 text-amber-200'
                                  : 'hover:bg-neutral-900 text-neutral-300'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                                  <span>{lvl.label}</span>
                                  {lvl.isSmoothPreset && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded font-medium whitespace-nowrap">
                                      ⚡ Tải nhanh / Mượt
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                                  {lvl.width && lvl.height ? `${lvl.width}x${lvl.height}` : ''}
                                  {lvl.bitrate ? ` • ${(lvl.bitrate / 1000).toFixed(0)} kbps` : ''}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="p-2.5 text-neutral-400 text-[11px] bg-neutral-900/50 rounded-lg border border-neutral-800/50">
                          Luồng phát này cung cấp một mức chất lượng cố định từ nguồn đài. Trên điện thoại hoặc mạng yếu, bạn có thể tải M3U hoặc mở CorePlayer để chọn chuyển mã 180p/240p/360p.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Chế độ: <strong className="text-amber-300">{activeResolutionLabel}</strong></span>
                      <a
                        href={`/open/${channel.id}`}
                        className="text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <span>Cấu hình E72/VLC</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Desktop Popover Menu for wider screens (sm and up) */}
                <div
                  style={menuPositionStyle}
                  className="hidden sm:block absolute bottom-full mb-2 bg-neutral-950/95 backdrop-blur-md border border-neutral-800 rounded-xl shadow-2xl p-3 z-50 text-xs box-border w-80 max-w-[calc(100vw-32px)]"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-sky-400" />
                      <span className="font-bold text-neutral-100">Tùy chọn độ phân giải</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsResolutionMenuOpen(false)}
                      className="text-neutral-400 hover:text-white p-0.5 text-sm"
                      title="Đóng"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-neutral-400 mb-2.5 leading-relaxed bg-neutral-900/80 p-2 rounded-lg border border-neutral-800/60">
                    💡 <strong>Mẹo xem mượt:</strong> Chọn độ phân giải <strong>360p</strong> hoặc <strong>480p</strong> giúp video tải nhanh hơn tức thì, giảm giật lag và tiết kiệm 70% băng thông mạng khi mạng yếu.
                  </p>

                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {/* Option: Auto */}
                    <button
                      type="button"
                      onClick={() => handleSelectLevel(-1, 'Tự động')}
                      className={`w-full p-2 rounded-lg flex items-center justify-between transition text-left gap-2 ${
                        currentLevelIndex === -1
                          ? 'bg-sky-950/70 border border-sky-600/70 text-sky-200'
                          : 'hover:bg-neutral-900 text-neutral-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                          <span>Tự động (HLS)</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-neutral-800 text-neutral-400 rounded whitespace-nowrap">Khuyên dùng</span>
                        </div>
                        <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                          Tự điều chỉnh theo tốc độ đường truyền
                        </div>
                      </div>
                      {currentLevelIndex === -1 && <Check className="w-4 h-4 text-sky-400 flex-shrink-0" />}
                    </button>

                    {/* Detected Quality Levels */}
                    {hlsLevels.length > 0 ? (
                      hlsLevels.map((lvl) => {
                        const isSelected = currentLevelIndex === lvl.index;
                        return (
                          <button
                            key={lvl.index}
                            type="button"
                            onClick={() => handleSelectLevel(lvl.index, lvl.label)}
                            className={`w-full p-2 rounded-lg flex items-center justify-between transition text-left gap-2 ${
                              isSelected
                                ? 'bg-amber-950/70 border border-amber-600/70 text-amber-200'
                                : 'hover:bg-neutral-900 text-neutral-300'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                                <span>{lvl.label}</span>
                                {lvl.isSmoothPreset && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 rounded font-medium whitespace-nowrap">
                                    ⚡ Tải nhanh / Mượt
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-neutral-400 mt-0.5 truncate">
                                {lvl.width && lvl.height ? `${lvl.width}x${lvl.height}` : ''}
                                {lvl.bitrate ? ` • ${(lvl.bitrate / 1000).toFixed(0)} kbps` : ''}
                              </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-2 text-neutral-400 text-[11px] bg-neutral-900/50 rounded-lg">
                        Luồng phát này cung cấp một mức chất lượng cố định từ nguồn đài. Trên điện thoại hoặc mạng yếu, bạn có thể tải M3U hoặc mở CorePlayer để chọn chuyển mã 180p/240p/360p.
                      </div>
                    )}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                    <span>Chế độ: <strong className="text-amber-300">{activeResolutionLabel}</strong></span>
                    <a
                      href={`/open/${channel.id}`}
                      className="text-amber-400 hover:underline flex items-center gap-1"
                    >
                      <span>Cấu hình E72/VLC</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Aspect Ratio Selector (Cân đối tỷ lệ khung hình màn hình) */}
          <div className="relative" ref={aspectMenuRef}>
            <button
              type="button"
              onClick={() => setIsAspectMenuOpen(!isAspectMenuOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                isAspectMenuOpen
                  ? 'bg-amber-950/80 text-amber-200 border-amber-600'
                  : aspectMode !== 'contain'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-700/60 hover:bg-amber-900/60'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title="Tùy chọn tỷ lệ khung hình (Phím R): Chuẩn đài, Lấp đầy (Cover), Kéo giãn (Stretch), 16:9, 4:3"
            >
              <Crop className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Tỷ lệ:</span>
              <span className="font-bold text-amber-300">
                {aspectMode === 'contain'
                  ? 'Vừa vặn'
                  : aspectMode === 'cover'
                  ? 'Lấp đầy'
                  : aspectMode === 'fill'
                  ? 'Kéo giãn'
                  : aspectMode}
              </span>
            </button>

            {isAspectMenuOpen && (
              <div
                className="absolute bottom-full mb-2 right-0 w-64 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-xl p-2 shadow-2xl z-50 animate-fadeIn"
              >
                <div className="text-[11px] font-bold text-neutral-400 px-2 py-1 uppercase tracking-wider border-b border-neutral-800/80 mb-1 flex items-center justify-between">
                  <span>Tỷ Lệ Màn Hình</span>
                  <span className="text-[10px] text-amber-400 font-mono">Phím R</span>
                </div>
                <div className="space-y-1">
                  {ASPECT_RATIO_OPTIONS.map((opt) => {
                    const isSelected = aspectMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectAspectMode(opt.id)}
                        className={`w-full p-2 rounded-lg flex items-center justify-between transition text-left gap-2 ${
                          isSelected
                            ? 'bg-amber-950/70 border border-amber-600/70 text-amber-200'
                            : 'hover:bg-neutral-900 text-neutral-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <span>{opt.label}</span>
                            {opt.badge && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-medium">
                                {opt.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                            {opt.description}
                          </div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Subtitles & AI Translation Menu Button */}
          <div className="relative" ref={subtitleMenuRef}>
            <button
              type="button"
              onClick={() => setIsSubtitleMenuOpen(!isSubtitleMenuOpen)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border ${
                isSubtitleMenuOpen
                  ? 'bg-amber-950/80 text-amber-200 border-amber-600'
                  : subtitlesEnabled
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
              title="Cài đặt Phụ đề & Dịch AI Trực tiếp (Phím C)"
            >
              <Subtitles className={`w-3.5 h-3.5 ${subtitlesEnabled ? 'text-amber-400' : 'text-neutral-400'}`} />
              <span className="hidden sm:inline">Phụ đề:</span>
              <span className="font-bold">
                {subtitlesEnabled ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <span>{subtitleTargetLang.toUpperCase()}</span>
                    {subtitleEngine === 'gemini' ? (
                      <Sparkles className="w-2.5 h-2.5 text-violet-400" />
                    ) : (
                      <Zap className="w-2.5 h-2.5 text-emerald-400" />
                    )}
                  </span>
                ) : (
                  <span className="text-neutral-400">Tắt</span>
                )}
              </span>
            </button>

            <SubtitleMenu
              isOpen={isSubtitleMenuOpen}
              onClose={() => setIsSubtitleMenuOpen(false)}
              enabled={subtitlesEnabled}
              onToggleEnabled={handleToggleSubtitles}
              engine={subtitleEngine}
              onChangeEngine={(eng) => setSubtitleEngine(eng)}
              displayMode={subtitleDisplayMode}
              onChangeDisplayMode={(m) => setSubtitleDisplayMode(m)}
              targetLang={subtitleTargetLang}
              onChangeTargetLang={(l) => setSubtitleTargetLang(l)}
              fontSize={subtitleFontSize}
              onChangeFontSize={(s) => setSubtitleFontSize(s)}
              tracks={subtitleTracks}
              selectedTrackId={selectedSubtitleTrackId}
              onSelectTrack={handleSelectSubtitleTrack}
              onTriggerSampleCue={(sampleText) => {
                if (!subtitlesEnabled) setSubtitlesEnabled(true);
                handleProcessCueText(sampleText);
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleTogglePlay}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition"
            title={isPlaying ? 'Tạm dừng' : 'Phát tiếp'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{isPlaying ? 'Tạm dừng' : 'Phát'}</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs border border-neutral-700 transition"
            title={isMuted ? 'Bật âm thanh' : 'Tắt tiếng'}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-neutral-300" />}
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs flex items-center gap-1 border border-neutral-700 transition"
            title="Sao chép URL stream"
          >
            <Copy className="w-3.5 h-3.5 text-amber-400" />
            <span>{copied ? 'Đã chép!' : 'Copy'}</span>
          </button>

          {/* External Player Button: CorePlayer on Nokia E72 lightweight browser, VLC Player on other browsers */}
          {isNokia ? (
            <a
              href={`/open/${channel.id}`}
              className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/50 rounded-lg text-xs flex items-center gap-1.5 transition"
              title="Tự động khởi chạy CorePlayer trên Nokia E72"
            >
              <Smartphone className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline font-medium">CorePlayer</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                launchVlcPlayer(channel.stream_url, channel.id);
                setIsVlcModalOpen(true);
              }}
              className="px-2.5 py-1.5 bg-orange-950/60 hover:bg-orange-900 text-orange-200 border border-orange-800/50 rounded-lg text-xs flex items-center gap-1.5 transition group"
              title="Khởi chạy và xem trên ứng dụng VLC Player"
            >
              <Play className="w-3.5 h-3.5 text-orange-400 fill-orange-400/30 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline font-medium">Xem trên VLC player</span>
              <span className="sm:hidden font-medium text-[11px]">VLC</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className={`p-1.5 rounded-lg text-xs transition border ${
              isFullscreen
                ? 'bg-amber-500 text-neutral-950 border-amber-400 font-bold'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
            }`}
            title={isFullscreen ? 'Thoát toàn màn hình (Esc hoặc F)' : 'Toàn màn hình (F)'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {onOpenDetails && (
            <button
              type="button"
              onClick={() => onOpenDetails(channel)}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition"
            >
              Chi tiết
            </button>
          )}
        </div>
      </div>

      {/* VLC Player Launcher & Troubleshooting Modal */}
      <VlcLauncherModal
        channel={channel}
        isOpen={isVlcModalOpen}
        onClose={() => setIsVlcModalOpen(false)}
      />
    </div>
  );
};
