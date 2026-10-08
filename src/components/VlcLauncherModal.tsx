import React, { useState } from 'react';
import {
  X,
  Play,
  Download,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  FileText,
  Monitor,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Channel } from '../types/iptv';

interface VlcLauncherModalProps {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

export const VlcLauncherModal: React.FC<VlcLauncherModalProps> = ({ channel, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(true);

  if (!isOpen) return null;

  const streamUrl = channel.stream_url;
  const vlcProtocolUrl = `vlc://${streamUrl}`;
  const m3uUrl = `/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u`;
  const m3u8Url = `/api/channel/${encodeURIComponent(channel.id)}/vlc.m3u8`;

  const handleCopy = () => {
    navigator.clipboard.writeText(streamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLaunchProtocol = () => {
    // Attempt launching vlc:// via standard navigation
    window.location.href = vlcProtocolUrl;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-6 text-neutral-100 flex flex-col gap-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-950/60 border border-orange-700/50 flex items-center justify-center">
              <Play className="w-5 h-5 text-orange-400 fill-orange-400/40" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">Khởi Chạy VLC Media Player</h2>
              <p className="text-xs text-neutral-400 truncate max-w-[280px]">{channel.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Direct Launch VLC Protocol */}
          <button
            type="button"
            onClick={handleLaunchProtocol}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 transition active:scale-[0.99]"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Mở Ứng Dụng VLC Ngay (vlc://)</span>
          </button>

          {/* Download M3U8 and M3U */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={m3u8Url}
              download
              className="py-2.5 px-3 bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition text-center"
              title="Tải tệp .m3u8 chuẩn UTF-8 khuyến nghị cho VLC"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Tải file .M3U8 (Tốt nhất)</span>
            </a>

            <a
              href={m3uUrl}
              download
              className="py-2.5 px-3 bg-neutral-800/90 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition text-center"
              title="Tải tệp .m3u truyền thống"
            >
              <Download className="w-3.5 h-3.5 text-orange-400" />
              <span>Tải file .M3U</span>
            </a>
          </div>

          {/* Copy Stream URL for Ctrl + N in VLC */}
          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <span>Link stream (Phát qua Ctrl + N trong VLC):</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 rounded text-[11px] font-medium flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép'}</span>
              </button>
            </div>
            <div className="text-[11px] font-mono text-emerald-400/90 break-all bg-black/60 p-2 rounded border border-neutral-900 select-all">
              {streamUrl}
            </div>
          </div>
        </div>

        {/* Troubleshooting Section: explains the exact notice seen when opening downloaded file */}
        <div className="border border-neutral-800 rounded-xl bg-neutral-950/60 overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            className="w-full p-3 flex items-center justify-between text-left hover:bg-neutral-900/60 transition"
          >
            <div className="flex items-center gap-2 text-amber-400 font-semibold">
              <HelpCircle className="w-4 h-4" />
              <span>Hướng dẫn xử lý khi mở file tải về thấy thông báo</span>
            </div>
            {showTroubleshooting ? (
              <ChevronUp className="w-4 h-4 text-neutral-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-neutral-400" />
            )}
          </button>

          {showTroubleshooting && (
            <div className="p-3 pt-0 space-y-3 text-neutral-300 border-t border-neutral-800/60">
              {/* Notice 1: How do you want to open this file? */}
              <div className="p-2.5 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-1">
                <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-sky-400" />
                  <span>1. Hiện bảng &quot;How do you want to open this file?&quot; (Chọn ứng dụng mở):</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Do hệ điều hành Windows chưa được thiết lập ứng dụng mặc định cho định dạng file <code className="text-amber-300 bg-neutral-950 px-1 py-0.5 rounded">.m3u</code> / <code className="text-amber-300 bg-neutral-950 px-1 py-0.5 rounded">.m3u8</code>.
                </p>
                <div className="text-[11px] text-sky-200/90 space-y-0.5 bg-sky-950/30 p-2 rounded border border-sky-900/30">
                  <p>&bull; Chọn <strong>VLC Media Player</strong> trong danh sách ứng dụng.</p>
                  <p>&bull; Tích vào ô: <strong>&quot;Always use this app to open .m3u files&quot;</strong> (Luôn dùng ứng dụng này).</p>
                  <p>&bull; Nhấn <strong>OK</strong>. Từ lần sau file sẽ tự động mở VLC trong 1 giây!</p>
                </div>
              </div>

              {/* Notice 2: Windows Media Player error */}
              <div className="p-2.5 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-1">
                <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-rose-400" />
                  <span>2. Windows Media Player bật lên và báo lỗi codec:</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Windows Media Player mặc định không đọc được luồng HLS trực tuyến.
                </p>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  👉 Cách sửa: <strong>Nhấp chuột phải</strong> vào file vừa tải về &rarr; Chọn <strong>Open with (Mở bằng)</strong> &rarr; Chọn <strong>VLC Media Player</strong>.
                </p>
              </div>

              {/* Shortcut: Ctrl + N in VLC */}
              <div className="p-2.5 bg-neutral-900/80 rounded-lg border border-neutral-800 space-y-1">
                <div className="font-semibold text-neutral-100 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                  <span>3. Cách nhanh nhất không cần tải file (3 giây):</span>
                </div>
                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  Bấm nút <strong>Sao chép link stream</strong> ở trên &rarr; Mở ứng dụng VLC trên máy &rarr; Nhấn tổ hợp phím <strong>Ctrl + N</strong> &rarr; Dán link và bấm <strong>Play (Phát)</strong>!
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
