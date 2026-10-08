import React, { useState } from 'react';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { X, Copy, Check, ExternalLink, Play, Tv, ShieldCheck, Smartphone, Download, ChevronRight } from 'lucide-react';

interface ChannelDetailsModalProps {
  channel: Channel | null;
  onClose: () => void;
  onPlayChannel: (channel: Channel) => void;
  isNokiaLightweight?: boolean;
}

export const ChannelDetailsModal: React.FC<ChannelDetailsModalProps> = ({
  channel,
  onClose,
  onPlayChannel,
  isNokiaLightweight,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  const [copied, setCopied] = useState<boolean>(false);
  const [showNokiaGuide, setShowNokiaGuide] = useState<boolean>(isNokia);

  if (!channel) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(channel.stream_url);
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
              <h3 className="text-base font-semibold text-white leading-tight">{channel.name}</h3>
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
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              URL LUỒNG PHÁT (STREAM URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={channel.stream_url}
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
            </div>
          </div>

          {/* CorePlayer on Nokia E72 Tutorial / Toggle */}
          {isNokia ? (
            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-400 font-semibold">
                <Smartphone className="w-4 h-4" />
                <span>Hướng dẫn xem trên Nokia E72 (Symbian S60)</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-[11px] leading-relaxed">
                <li>Mở trình duyệt mặc định trên Nokia E72, truy cập trang web (hệ thống sẽ tự nhận diện E72).</li>
                <li>Chọn kênh và bấm <strong className="text-white">[ Mở CorePlayer ]</strong> hoặc copy URL trên.</li>
                <li>Trong <strong>CorePlayer</strong>: Bấm <strong>Menu &gt; Open URL...</strong></li>
                <li>Dán (Paste) đường dẫn stream và bấm <strong>OK</strong> để phát.</li>
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
                  <span>Dành cho Nokia E72 (Symbian S60 / CorePlayer)</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-amber-400">
                  <span>{showNokiaGuide ? 'Ẩn' : 'Xem hướng dẫn'}</span>
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showNokiaGuide ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {showNokiaGuide && (
                <div className="px-3.5 pb-3.5 pt-1 space-y-2 text-xs border-t border-neutral-800/60 bg-neutral-950">
                  <p className="text-[11px] text-neutral-400">
                    Để kích hoạt giao diện siêu nhẹ và nút CorePlayer trực tiếp trên Nokia E72, hãy truy cập <a href="/legacy" className="text-amber-400 underline">bản Nokia E72 (/legacy)</a>.
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-[11px] leading-relaxed">
                    <li>Trên Nokia E72: Khởi động <strong>CorePlayer</strong>.</li>
                    <li>Chọn <strong>Menu &gt; Open URL...</strong></li>
                    <li>Dán stream URL: <code className="text-emerald-400">{channel.stream_url}</code></li>
                  </ol>
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
                Trạng thái: <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Hoạt động</span>
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
    </div>
  );
};
