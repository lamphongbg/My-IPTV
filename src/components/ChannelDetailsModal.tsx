import React, { useState } from 'react';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { X, Copy, Check, ExternalLink, Play, Tv, ShieldCheck, Smartphone, Download, ChevronRight, Sliders, Zap, Subtitles, Search, AlertTriangle, CheckCircle, RefreshCw, Flag } from 'lucide-react';
import { SubtitleDiagnosticModal } from './SubtitleDiagnosticModal';

interface ChannelDetailsModalProps {
  channel: Channel | null;
  onClose: () => void;
  onPlayChannel: (channel: Channel) => void;
  isNokiaLightweight?: boolean;
  onChannelUpdate?: (channel: Channel) => void;
  isAdmin?: boolean;
}

export const ChannelDetailsModal: React.FC<ChannelDetailsModalProps> = ({
  channel,
  onClose,
  onPlayChannel,
  isNokiaLightweight,
  onChannelUpdate,
  isAdmin,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  const [copied, setCopied] = useState<boolean>(false);
  const [showNokiaGuide, setShowNokiaGuide] = useState<boolean>(isNokia);
  const [urlMode, setUrlMode] = useState<'original' | 'e72'>('original');
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isReporting, setIsReporting] = useState<boolean>(false);

  const effectiveIsAdmin = isAdmin !== undefined ? isAdmin : (typeof window !== 'undefined' && Boolean(localStorage.getItem('my_iptv_admin_token')));
  const isReported = Boolean(channel?.status === 'reported' || channel?.is_reported);

  const handleToggleChannelStatus = async () => {
    if (!channel || isUpdatingStatus) return;
    const isCurrentlyOffline = channel.status === 'offline';
    const targetStatus = isCurrentlyOffline ? 'active' : 'offline';
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.channel || { ...channel, status: targetStatus };
        if (onChannelUpdate) {
          onChannelUpdate(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReportUnavailable = async () => {
    if (!channel || isReporting || isReported) return;
    setIsReporting(true);
    try {
      const res = await fetch(`/api/channels/${channel.id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Người dùng báo cáo không khả dụng' }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated = data.channel || {
          ...channel,
          status: 'reported' as const,
          is_reported: true,
          description: 'Đã báo cáo không khả dụng',
        };
        if (onChannelUpdate) {
          onChannelUpdate(updated);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsReporting(false);
    }
  };

  if (!channel) return null;

  const hasSubtitles = Boolean(
    channel.has_subtitles || (channel.subtitle_tracks && channel.subtitle_tracks.length > 0)
  );

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const e72StreamUrl = `${currentOrigin}/api/channel/${channel.id}/e72.ts`;
  const activeUrl = urlMode === 'e72' ? e72StreamUrl : channel.stream_url;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const corePlayerLink = `/open/${channel.id}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-3">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                className="w-10 h-10 object-contain bg-neutral-900 rounded p-1 border border-neutral-800"
                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold flex items-center justify-center rounded text-xs">
                IPTV
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white leading-tight">{channel.name}</h3>
                {hasSubtitles && (
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-500/40 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm">
                    <Subtitles className="w-3 h-3 text-cyan-400" />
                    <span>CC</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400">Nhóm: {channel.group}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Stream URL Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                URL LUỒNG PHÁT (STREAM URL)
              </label>
              <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setUrlMode('original')}
                  className={`px-2 py-0.5 rounded font-medium transition ${
                    urlMode === 'original'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Gốc (HLS/HTTP)
                </button>
                <button
                  type="button"
                  onClick={() => setUrlMode('e72')}
                  className={`px-2 py-0.5 rounded font-medium transition ${
                    urlMode === 'e72'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Nokia E72 (QVGA TS)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={activeUrl}
                className="w-full bg-neutral-950 border border-neutral-800 text-emerald-400 text-xs font-mono p-2.5 rounded-lg focus:outline-none selection:bg-emerald-950"
              />
              <button
                onClick={handleCopyUrl}
                className="px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition flex-shrink-0 border border-neutral-700"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-amber-400" />}
                <span>{copied ? 'Đã copy' : 'Copy'}</span>
              </button>
            </div>
            {urlMode === 'e72' && (
              <p className="text-[11px] text-emerald-400/90 mt-1">
                ✓ Luồng chuyển mã thời gian thực chuẩn 320x240 H.264 Baseline L1.3 + AAC 64k tối ưu cho CorePlayer trên Nokia E72.
              </p>
            )}
          </div>

          {/* Quick External Launchers */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              MỞ BẰNG ỨNG DỤNG BÊN NGOÀI
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Primary External App Button: CorePlayer on Nokia E72, VLC on other browsers */}
              {isNokia ? (
                <a
                  href={corePlayerLink}
                  className="p-2.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-200 rounded-lg font-medium flex items-center justify-between transition"
                  title="Tự động khởi chạy CorePlayer trên Nokia E72"
                >
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-rose-400" />
                    <span>CorePlayer / S60</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              ) : (
                <a
                  href={getVlcLaunchUrl(channel.stream_url)}
                  onClick={() => launchVlcPlayer(channel.stream_url, channel.id)}
                  className="p-2.5 bg-orange-950/40 hover:bg-orange-900/50 border border-orange-800/50 text-orange-200 rounded-lg font-medium flex items-center justify-between transition"
                  title="Tự động mở trên ứng dụng VLC Player nếu đã cài đặt"
                >
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-orange-400 fill-orange-400/20" />
                    <span>Xem trên VLC player</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </a>
              )}

              {/* Download M3U8 / M3U for VLC */}
              <a
                href={`/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u8`}
                download={`${channel.name}.m3u8`}
                className="p-2.5 bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Tải file .m3u8 chuẩn UTF-8 tốt nhất cho VLC"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-amber-400" />
                  <span>Tải .M3U8 cho VLC (Tốt nhất)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u`}
                download={`${channel.name}.m3u`}
                className="p-2.5 bg-neutral-800/80 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Tải file .m3u truyền thống"
              >
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-orange-400" />
                  <span>Tải .M3U cho VLC</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`/api/channel/${encodeURIComponent(channel.id)}/coreplayer.m3u?res=240p`}
                download={`${channel.name}_240p_e72.m3u`}
                className="p-2.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Tải file .m3u 240p QVGA chuẩn Nokia E72 (loại bỏ lỗi BOM, luồng thuần HTTP)"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-rose-400" />
                  <div>
                    <span>Tải .M3U CorePlayer (240p QVGA)</span>
                    <div className="text-[10px] text-rose-300/80 font-normal">Chuẩn màn hình E72 • CPU chạy mát</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`/api/channel/${encodeURIComponent(channel.id)}/coreplayer.m3u?res=180p`}
                download={`${channel.name}_180p_light.m3u`}
                className="p-2.5 bg-sky-950/40 hover:bg-sky-900/50 border border-sky-800/50 text-sky-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Tải file .m3u 180p siêu nhẹ (tải tức thì trên sóng 2G/3G hoặc mạng yếu)"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-sky-400" />
                  <div>
                    <span>Tải .M3U 180p (Siêu nhẹ)</span>
                    <div className="text-[10px] text-sky-300/80 font-normal">Tải tức thì • Mạng yếu 2G/3G không giật</div>
                  </div>
                </div>
                <Download className="w-3.5 h-3.5 opacity-70" />
              </a>

              {/* Direct Launcher for CorePlayer */}
              <a
                href={`/play/coreplayer/${encodeURIComponent(channel.id)}`}
                className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Khởi chạy trực tiếp CorePlayer trên Nokia E72 (MIME inline)"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span>Mở CorePlayer (Trực tiếp)</span>
                    <div className="text-[10px] text-emerald-300/80 font-normal">Kích hoạt ứng dụng trên E72</div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              {/* Direct Launcher for RealPlayer */}
              <a
                href={`/play/realplayer/${encodeURIComponent(channel.id)}`}
                className="p-2.5 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Khởi chạy trực tiếp RealPlayer trên Nokia E72 (RAM inline)"
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-rose-400" />
                  <div>
                    <span>Mở RealPlayer (Trực tiếp)</span>
                    <div className="text-[10px] text-rose-300/80 font-normal">App gốc trong ROM E72</div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`/open/${encodeURIComponent(channel.id)}`}
                className="p-2.5 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 text-amber-200 rounded-lg font-medium flex items-center justify-between transition"
                title="Mở trang tùy chọn độ phân giải và liên kết trực tiếp"
              >
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <div>
                    <span>Tùy chọn độ phân giải &amp; Mở URL</span>
                    <div className="text-[10px] text-amber-300/80 font-normal">180p, 240p QVGA, 360p, Luồng gốc</div>
                  </div>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={`potplayer://${channel.stream_url}`}
                className="p-2.5 bg-yellow-950/40 hover:bg-yellow-900/50 border border-yellow-800/50 text-yellow-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-yellow-400" />
                  <span>PotPlayer (PC)</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              <a
                href={channel.stream_url}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/50 text-emerald-200 rounded-lg font-medium flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-emerald-400" />
                  <span>Direct HTTP Stream</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>

              {/* Subtitle Deep Diagnostic Action Button */}
              <button
                type="button"
                onClick={() => setIsDiagnosticOpen(true)}
                className="col-span-2 p-2.5 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 text-cyan-200 rounded-lg font-medium flex items-center justify-between transition text-left"
                title="Quét cấu trúc HLS Manifest (.m3u8), kiểm tra thẻ EXT-X-MEDIA:TYPE=SUBTITLES và WebVTT"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-cyan-400" />
                  <div>
                    <span className="font-semibold">Chẩn đoán phụ đề HLS (Deep Scan)</span>
                    <div className="text-[10px] text-cyan-300/80 font-normal">
                      Phân tích thẻ EXT-X-MEDIA, sub-playlist WebVTT &amp; CEA-608
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400 opacity-70" />
              </button>
            </div>
          </div>

          {/* Subtitle Status & Warning Card */}
          <div className={`p-3.5 rounded-xl border ${
            hasSubtitles
              ? 'bg-cyan-950/20 border-cyan-800/40'
              : 'bg-amber-950/25 border-amber-800/40'
          } space-y-2`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {hasSubtitles ? (
                  <Subtitles className="w-4 h-4 text-cyan-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className={`text-xs font-semibold ${hasSubtitles ? 'text-cyan-300' : 'text-amber-300'}`}>
                  {hasSubtitles ? 'TRẠNG THÁI PHỤ ĐỀ HLS' : 'CẢNH BÁO PHỤ ĐỀ (SUBTITLE WARNING)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDiagnosticOpen(true)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 transition"
              >
                <Search className="w-3 h-3" />
                <span>Quét chi tiết</span>
              </button>
            </div>

            {hasSubtitles ? (
              <p className="text-[11px] text-neutral-300 leading-relaxed">
                Kênh có khai báo phụ đề. Nếu trình duyệt không hiển thị phụ đề, hãy dùng công cụ chẩn đoán để kiểm tra sub-playlist WebVTT và phân tích cú pháp manifest.
              </p>
            ) : (
              <div className="text-[11px] text-amber-200/90 leading-relaxed space-y-1">
                <p>
                  ⚠️ <strong>Luồng phát chưa khai báo thẻ phụ đề chuẩn HLS:</strong> Trình duyệt sẽ không thể hiển thị phụ đề tự động nếu nguồn phát không có thẻ <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">#EXT-X-MEDIA:TYPE=SUBTITLES</code> hoặc đóng phụ đề nhúng CEA-608 không tương thích.
                </p>
                <p className="text-[10px] text-neutral-400">
                  Nhấn <strong>"Quét chi tiết"</strong> bên trên để chạy công cụ Subtitle Diagnostic kiểm tra toàn diện manifest và tải thử phân đoạn WebVTT.
                </p>
              </div>
            )}
          </div>

          {/* CorePlayer on Nokia E72 Tutorial / Toggle */}
          {isNokia ? (
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Smartphone className="w-4 h-4" />
                <span>Hướng dẫn xem trên Nokia E72 (Symbian S60)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-[11px] leading-relaxed">
                <li>Mở trình duyệt trên Nokia E72, truy cập trang web (hệ thống tự nhận diện E72).</li>
                <li>Bấm nút <strong>[ Tải .M3U CorePlayer (Đã sửa lỗi) ]</strong> để nhận file .m3u không bị lỗi BOM.</li>
                <li>Hoặc trong <strong>CorePlayer</strong>: Chọn <strong>Menu &gt; Open URL...</strong> &rarr; Dán link MPEG-TS: <code className="text-emerald-400">{`/api/channel/${channel.id}/live.ts`}</code></li>
              </ol>
            </div>
          ) : (
            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/40">
              <button
                type="button"
                onClick={() => setShowNokiaGuide(!showNokiaGuide)}
                className="w-full p-3 flex items-center justify-between text-xs text-neutral-400 hover:text-neutral-200 transition text-left"
              >
                <div className="flex items-center gap-2 text-neutral-300 font-medium">
                  <Smartphone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Xử lý lỗi CorePlayer &amp; Xem trên điện thoại</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-amber-400">
                  <span>{showNokiaGuide ? 'Ẩn' : 'Xem hướng dẫn'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showNokiaGuide ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {showNokiaGuide && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2.5 text-xs border-t border-neutral-800/60 bg-neutral-950">
                  <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-lg text-rose-200 text-[11px] leading-relaxed">
                    <p className="font-semibold text-rose-300 mb-1">⚠️ Sửa lỗi: "HTTPS hỗ trợ các thỏa thuận không được"</p>
                    <p>• <strong>Nguyên nhân:</strong> CorePlayer v1.3.6 trên Nokia E72 (Symbian S60) chỉ hỗ trợ <strong>HTTP thường</strong>. CorePlayer không hỗ trợ chuẩn mã hóa TLS 1.2/1.3 và chứng chỉ bảo mật của HTTPS hiện đại. Khi mở link <code>https://</code>, điện thoại sẽ báo lỗi này.</p>
                    <p className="mt-1">• <strong>Khắc phục:</strong> Nút <em>"Tải .M3U CorePlayer"</em> ở trên đã được cấu hình tự động lọc sạch HTTPS và xuất chuẩn HTTP thuần túy.</p>
                    <p className="mt-1">• <strong>Kết nối qua Wi-Fi:</strong> Chạy máy chủ trên máy tính trong cùng mạng Wi-Fi, mở trình duyệt E72 vào <code>http://[IP-Máy-Tính]:3000/legacy</code> để xem trực tiếp qua HTTP cực kỳ mượt mà.</p>
                  </div>
                  <div className="p-2.5 bg-amber-950/30 border border-amber-800/40 rounded-lg text-amber-200 text-[11px] leading-relaxed">
                    <p className="font-semibold text-amber-300 mb-1">💡 Khuyên dùng cho điện thoại thông minh (Android / iOS):</p>
                    <p>Sử dụng <strong>VLC Media Player</strong> (bấm nút <em>"Xem trên VLC player"</em> ở trên). VLC hỗ trợ 100% các luồng HLS/MPEG-TS mà không cần cấu hình.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Technical Specs */}
          <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-neutral-300 block">THÔNG SỐ KỸ THUẬT</span>
            <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-neutral-400">
              <div>
                Giao thức: <strong className="text-neutral-200">{channel.format.toUpperCase()}</strong>
              </div>
              <div>
                Độ phân giải: <strong className="text-neutral-200">{channel.resolution || 'HD'}</strong>
              </div>
              <div>
                Video Codec: <strong className="text-neutral-200">{channel.video_codec || 'H.264'}</strong>
              </div>
              <div>
                Audio Codec: <strong className="text-neutral-200">{channel.audio_codec || 'AAC'}</strong>
              </div>
              <div className="col-span-2">
                Phụ đề (Subtitles):{' '}
                {hasSubtitles ? (
                  <span className="inline-flex items-center gap-1.5 text-cyan-400 font-medium">
                    <Subtitles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>
                      {channel.subtitle_tracks && channel.subtitle_tracks.length > 0
                        ? `Có phụ đề [CC] (${channel.subtitle_tracks.map((t) => t.name || t.lang || t.type).join(', ')})`
                        : 'Có phụ đề [CC]'}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400/90">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Chưa phát hiện thẻ phụ đề HLS</span>
                  </span>
                )}
              </div>
              <div className="col-span-2 flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-neutral-850">
                <div className="flex items-center gap-2">
                  <span>Trạng thái:</span>
                  {isReported ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      Bị báo cáo không khả dụng
                    </span>
                  ) : channel.status === 'offline' ? (
                    <span className="inline-flex items-center gap-1 text-rose-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      Không hoạt động (Offline)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Khả dụng (Online)
                    </span>
                  )}
                </div>

                {effectiveIsAdmin ? (
                  <button
                    type="button"
                    onClick={handleToggleChannelStatus}
                    disabled={isUpdatingStatus}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 disabled:opacity-50 ${
                      channel.status === 'offline'
                        ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border-emerald-700/60'
                        : 'bg-rose-950/60 hover:bg-rose-900 text-rose-300 border-rose-800/60'
                    }`}
                    title={
                      channel.status === 'offline'
                        ? 'Nhấn để chuyển sang trạng thái Hoạt động'
                        : 'Nhấn để đánh dấu kênh này Không hoạt động'
                    }
                  >
                    {isUpdatingStatus ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    ) : channel.status === 'offline' ? (
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                    )}
                    <span>{channel.status === 'offline' ? 'Đánh dấu hoạt động lại' : 'Đánh dấu không hoạt động'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleReportUnavailable}
                    disabled={isReporting || isReported}
                    className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer active:scale-95 disabled:opacity-80 ${
                      isReported
                        ? 'bg-amber-950/60 text-amber-300 border-amber-600/70 shadow-sm cursor-default'
                        : 'bg-amber-500 hover:bg-amber-400 text-neutral-950 border-amber-400 font-bold'
                    }`}
                    title={isReported ? 'Bạn đã báo cáo kênh này' : 'Báo cáo kênh này không khả dụng'}
                  >
                    {isReporting ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : isReported ? (
                      <Check className="w-3 h-3 text-amber-400" />
                    ) : (
                      <Flag className="w-3 h-3" />
                    )}
                    <span>{isReported ? 'Đã báo cáo không khả dụng' : 'Báo cáo kênh không khả dụng'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
          <a
            href={`/legacy/channel/${channel.id}`}
            className="text-xs text-amber-400 hover:underline"
          >
            Xem phiên bản Nokia E72
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition"
            >
              Đóng
            </button>
            <button
              onClick={() => {
                onPlayChannel(channel);
                onClose();
              }}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Phát ngay
            </button>
          </div>
        </div>
      </div>

      {/* Deep Subtitle Diagnostic Modal */}
      {isDiagnosticOpen && (
        <SubtitleDiagnosticModal
          isOpen={isDiagnosticOpen}
          onClose={() => setIsDiagnosticOpen(false)}
          channel={channel}
          initialStreamUrl={channel.stream_url}
          onApplyTracksToChannel={(tracks) => {
            if (channel) {
              channel.subtitle_tracks = tracks;
              channel.has_subtitles = tracks.length > 0;
            }
          }}
        />
      )}
    </div>
  );
};
