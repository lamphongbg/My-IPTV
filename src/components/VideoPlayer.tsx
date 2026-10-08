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
  ShieldCheck,
  Zap,
  Download,
  Smartphone
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel | null;
  playTrigger?: number;
  onOpenDetails?: (channel: Channel) => void;
  isNokiaLightweight?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playTrigger = 0,
  onOpenDetails,
  isNokiaLightweight,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

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
          xhrSetup: (xhr) => {
            xhr.withCredentials = false;
          },
        });
        hlsRef.current = hls;

        hls.loadSource(effectiveSource);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsLoading(false);
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setAutoplayMuted(false);
            })
            .catch((err) => {
              if (err?.name === 'AbortError') return;
              console.warn('Autoplay unmuted blocked by browser policy:', err);
              // Autoplay policy: retry with muted audio only if video wasn't paused by user
              if (video && !video.paused) {
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
              }
            });
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
        video
          .play()
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
            setAutoplayMuted(false);
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return;
            console.warn('Native playback error or unmuted autoplay blocked:', err);
            // Fallback: try muted autoplay only if video is still active and not paused
            if (video && !video.paused) {
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
            }
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
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return;
          if (!proxyMode) {
            setUseProxy(true);
            startPlayback(true);
          } else {
            setHasError(true);
            setErrorMessage('Trình duyệt không hỗ trợ giải mã trực tiếp luồng này.');
            setIsLoading(false);
          }
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
            console.warn('Playback play request blocked:', err);
            // Retry muted only if user hasn't paused the video
            if (video && !video.paused) {
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
            }
          });
      }
    }
  }, [triggerFeedback]);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleTogglePlay, handleToggleMute, handleToggleFullscreen]);

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
      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col"
    >
      {/* Video Canvas Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center group overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-contain pointer-events-none select-none"
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

        {/* Full-surface Screen Click Overlay (Click anywhere to pause/play, double-click for fullscreen) */}
        {!hasError && !isLoading && (
          <div
            className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center select-none"
            onClick={handleTogglePlay}
            onDoubleClick={handleToggleFullscreen}
            title={isPlaying ? 'Nhấn vào màn hình để tạm dừng (Space)' : 'Nhấn vào màn hình để phát tiếp (Space)'}
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
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleUnmuteAudio();
            }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-neutral-950 px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-amber-400 transition animate-bounce"
            title="Nhấn để bật âm thanh"
          >
            <VolumeX className="w-4 h-4" />
            <span>Đang tắt tiếng. Bấm vào đây để BẬT TIẾNG!</span>
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
      <div className="p-3.5 bg-neutral-900 border-t border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs border border-neutral-700 transition"
            title="Toàn màn hình"
          >
            <Maximize className="w-3.5 h-3.5" />
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
