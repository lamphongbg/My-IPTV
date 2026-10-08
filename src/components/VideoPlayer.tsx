import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import { Channel } from '../types/iptv';
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
  Zap
} from 'lucide-react';

interface VideoPlayerProps {
  channel: Channel | null;
  playTrigger?: number;
  onOpenDetails?: (channel: Channel) => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  playTrigger = 0,
  onOpenDetails,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [autoplayMuted, setAutoplayMuted] = useState<boolean>(false);

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

      // Clean up previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      const rawUrl = channel.stream_url.trim();
      const effectiveSource = getStreamSource(rawUrl, proxyMode);

      // 1. Native HLS support (Safari iOS / macOS)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
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
            console.warn('Native playback error or unmuted autoplay blocked:', err);
            // Fallback: try muted autoplay
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
                setIsLoading(false);
                setAutoplayMuted(true);
              })
              .catch(() => {
                if (!proxyMode) {
                  console.info('Switching to proxy mode on native error...');
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setIsLoading(false);
                  setHasError(true);
                  setErrorMessage('Trình duyệt không thể phát luồng này.');
                }
              });
          });
        return;
      }

      // 2. HLS.js for Chrome, Firefox, Edge, Android
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
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
              console.warn('Autoplay unmuted blocked by browser policy:', err);
              // Autoplay policy: retry with muted audio
              video.muted = true;
              setIsMuted(true);
              video
                .play()
                .then(() => {
                  setIsPlaying(true);
                  setAutoplayMuted(true);
                })
                .catch(() => {
                  setIsPlaying(false);
                });
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
                  hls.destroy();
                  hlsRef.current = null;
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setHasError(true);
                  setErrorMessage(
                    'Không thể kết nối đến máy chủ nguồn IPTV (Server luồng phát có thể đang ngoại tuyến hoặc đã đổi đường dẫn).'
                  );
                  setIsLoading(false);
                  hls.destroy();
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                if (!proxyMode) {
                  hls.destroy();
                  hlsRef.current = null;
                  setUseProxy(true);
                  startPlayback(true);
                } else {
                  setHasError(true);
                  setErrorMessage('Định dạng luồng phát không tương thích với trình duyệt hiện tại.');
                  setIsLoading(false);
                  hls.destroy();
                }
                break;
            }
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
        .catch(() => {
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
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel, playTrigger, startPlayback]);

  // User interactions
  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayMuted(false);
        })
        .catch(() => {
          // If unmuted play failed, try muted
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsMuted(true);
            videoRef.current.play().then(() => {
              setIsPlaying(true);
              setAutoplayMuted(true);
            });
          }
        });
    }
  };

  const handleToggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !videoRef.current.muted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
    if (!newMuted) {
      setAutoplayMuted(false);
    }
  };

  const handleUnmuteAudio = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = false;
    setIsMuted(false);
    setAutoplayMuted(false);
  };

  const handleToggleProxy = () => {
    const nextProxy = !useProxy;
    setUseProxy(nextProxy);
    startPlayback(nextProxy);
  };

  const handleRetry = () => {
    startPlayback(useProxy);
  };

  const handleForceProxyRetry = () => {
    setUseProxy(true);
    startPlayback(true);
  };

  const handleCopy = () => {
    if (!channel) return;
    navigator.clipboard.writeText(channel.stream_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

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
    <div className="w-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Video Canvas Container */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center group overflow-hidden">
        <video
          ref={videoRef}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
          controls
          onClick={handleTogglePlay}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Autoplay Muted Notice */}
        {isPlaying && autoplayMuted && (
          <div
            onClick={handleUnmuteAudio}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-neutral-950 px-3.5 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg cursor-pointer hover:bg-amber-400 transition animate-bounce"
            title="Nhấn để bật âm thanh"
          >
            <VolumeX className="w-4 h-4" />
            <span>Đang tắt tiếng. Bấm vào đây để BẬT TIẾNG!</span>
          </div>
        )}

        {/* Big Center Play Button Overlay (when paused and not loading/errored) */}
        {!isPlaying && !isLoading && !hasError && (
          <button
            type="button"
            onClick={handleTogglePlay}
            className="absolute z-10 w-16 h-16 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 flex items-center justify-center shadow-2xl shadow-amber-500/50 hover:scale-110 active:scale-95 transition-all"
            title="Bấm để phát (Play)"
          >
            <Play className="w-8 h-8 fill-current ml-1" />
          </button>
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

              <a
                href={`vlc://${channel.stream_url}`}
                className="px-3 py-2 bg-orange-800 hover:bg-orange-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Mở qua VLC
              </a>

              <a
                href={`/open/${channel.id}`}
                className="px-3 py-2 bg-rose-800 hover:bg-rose-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                CorePlayer / S60
              </a>
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

          <a
            href={`/open/${channel.id}`}
            className="px-2.5 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800/50 rounded-lg text-xs flex items-center gap-1 transition"
            title="Link mở qua CorePlayer hoặc Nokia E72"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CorePlayer</span>
          </a>

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
    </div>
  );
};
