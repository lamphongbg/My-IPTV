import React, { useState } from 'react';
import { Channel } from '../types/iptv';
import { X, Upload, FileText, CheckCircle, AlertTriangle } from 'lucide-react';

interface M3uImporterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportChannels: (channels: Channel[]) => void;
}

export const M3uImporterModal: React.FC<M3uImporterModalProps> = ({
  isOpen,
  onClose,
  onImportChannels,
}) => {
  const [m3uText, setM3uText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleParse = async () => {
    if (!m3uText.trim()) {
      setError('Vui lòng dán nội dung danh sách M3U/M3U8.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessCount(null);

    try {
      const res = await fetch('/api/parse-m3u', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: m3uText }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi xử lý file M3U');
      }

      if (data.channels && data.channels.length > 0) {
        setSuccessCount(data.channels.length);
        onImportChannels(data.channels);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError('Không tìm thấy kênh hợp lệ trong nội dung M3U.');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi gửi yêu cầu phân tích M3U');
    } finally {
      setLoading(false);
    }
  };

  const handleSample = () => {
    const sample = `#EXTM3U
#EXTINF:-1 tvg-id="vtv1" tvg-name="VTV1" group-title="VTV",VTV1 HD
https://vtv1.vtvgo.vn/vtv1.m3u8
#EXTINF:-1 tvg-id="nasa" tvg-name="NASA TV" group-title="Khoa học",NASA TV Public
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8`;
    setM3uText(sample);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/50">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-white">Nhập Danh Sách Kênh M3U</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-neutral-400">
            Dán nội dung danh sách định dạng <strong>#EXTM3U</strong> của bạn vào ô bên dưới để xem trực tiếp hoặc xuất sang Nokia E72.
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-neutral-300">Nội dung M3U Playlist:</label>
              <button
                type="button"
                onClick={handleSample}
                className="text-[11px] text-amber-400 hover:underline"
              >
                Chèn mẫu thử
              </button>
            </div>
            <textarea
              rows={8}
              value={m3uText}
              onChange={(e) => setM3uText(e.target.value)}
              placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-name=&quot;Kênh 1&quot; group-title=&quot;Tin tức&quot;,Kênh 1&#10;https://example.com/stream.m3u8"
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500 selection:bg-neutral-800"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Đã nhập thành công {successCount} kênh vào danh sách!</span>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-neutral-800 bg-neutral-950/50 flex items-center justify-between">
          <a
            href="/playlist.m3u"
            download="playlist.m3u"
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            Tải file playlist.m3u mẫu
          </a>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition"
            >
              Hủy
            </button>
            <button
              onClick={handleParse}
              disabled={loading}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
            >
              {loading ? 'Đang phân tích...' : 'Nhập kênh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
