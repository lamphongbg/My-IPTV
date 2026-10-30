import React, { useState, useMemo } from 'react';
import {
  TranscriptItem,
} from '../services/subtitleTranslator';
import {
  isTtsSupported,
  speakText,
  stopSpeaking,
  exportToSrt,
  exportToTxt,
  triggerFileDownload,
  TtsSettings,
  DEFAULT_TTS_SETTINGS,
} from '../services/transcriptService';
import {
  X,
  Search,
  Download,
  Trash2,
  Volume2,
  VolumeX,
  Copy,
  Check,
  FileText,
  Clock,
  Sparkles,
  Mic,
  Subtitles,
  ExternalLink,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';

interface SubtitleHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: TranscriptItem[];
  onClearHistory: () => void;
  channelName?: string;
  autoTtsEnabled: boolean;
  onToggleAutoTts: () => void;
  ttsRate?: number;
  onChangeTtsRate?: (rate: number) => void;
  ttsSettings?: TtsSettings;
  onChangeTtsSettings?: (settings: TtsSettings) => void;
  onTriggerSample?: () => void;
}

export const SubtitleHistoryDrawer: React.FC<SubtitleHistoryDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onClearHistory,
  channelName,
  autoTtsEnabled,
  onToggleAutoTts,
  ttsRate = 1.0,
  onChangeTtsRate,
  ttsSettings,
  onChangeTtsSettings,
  onTriggerSample,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'stream-cc' | 'speech-recognition'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const ttsAvailable = isTtsSupported();

  // Filter items based on search query and source filter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Source filter
      if (filterSource !== 'all' && item.sourceType !== filterSource) {
        return false;
      }
      // Query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const origMatch = item.originalText.toLowerCase().includes(q);
      const transMatch = item.translatedText.toLowerCase().includes(q);
      return origMatch || transMatch;
    });
  }, [items, searchQuery, filterSource]);

  const handleCopy = (item: TranscriptItem) => {
    const textToCopy = item.translatedText
      ? `${item.translatedText}\n(${item.originalText})`
      : item.originalText;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSpeak = (item: TranscriptItem) => {
    if (speakingId === item.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }

    const textToRead = item.translatedText || item.originalText;
    const lang = item.translatedText ? 'vi-VN' : 'en-US';
    setSpeakingId(item.id);

    const activeSettings = ttsSettings || { ...DEFAULT_TTS_SETTINGS, rate: ttsRate };
    speakText(textToRead, lang, activeSettings, () => {
      setSpeakingId(null);
    });
  };

  const handleExportSrt = () => {
    const srtContent = exportToSrt(items);
    if (!srtContent) return;
    const safeName = (channelName || 'iptv').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(srtContent, `${safeName}_subtitles_${Date.now()}.srt`, 'text/plain;charset=utf-8');
  };

  const handleExportTxt = () => {
    const txtContent = exportToTxt(items, channelName);
    if (!txtContent) return;
    const safeName = (channelName || 'iptv').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    triggerFileDownload(txtContent, `${safeName}_transcript_${Date.now()}.txt`, 'text/plain;charset=utf-8');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg h-full bg-neutral-950/98 border-l border-neutral-800 flex flex-col shadow-2xl text-neutral-200 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/60 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 text-black flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm text-white">Nhật Ký Hội Thoại & Phụ Đề</h2>
                <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {items.length} câu
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate max-w-[280px]">
                {channelName ? `Kênh: ${channelName}` : 'Lịch sử phát trực tiếp'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition cursor-pointer"
              title="Đóng nhật ký"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Bar: Export & Clear */}
        <div className="px-4 py-2.5 border-b border-neutral-800/80 bg-neutral-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportSrt}
              disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-white font-medium transition cursor-pointer border border-neutral-700 shadow-sm"
              title="Tải phụ đề định dạng .SRT để dùng cho VLC / PotPlayer / CapCut"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Xuất .SRT</span>
            </button>

            <button
              type="button"
              onClick={handleExportTxt}
              disabled={items.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 disabled:pointer-events-none text-white font-medium transition cursor-pointer border border-neutral-700 shadow-sm"
              title="Tải toàn bộ văn bản ghi chép .TXT kèm mốc thời gian"
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Xuất .TXT</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-red-950/80 border border-red-800/80 rounded-lg p-1 animate-fadeIn">
                <span className="text-[11px] text-red-200 px-1">Xác nhận xóa?</span>
                <button
                  type="button"
                  onClick={() => {
                    onClearHistory();
                    setShowClearConfirm(false);
                  }}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-bold cursor-pointer"
                >
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-[11px] cursor-pointer"
                >
                  Hủy
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={items.length === 0}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-950/40 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer text-xs"
                title="Xóa toàn bộ lịch sử phụ đề hiện tại"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa sạch</span>
              </button>
            )}
          </div>
        </div>

        {/* Phase 4 TTS Control Panel */}
        {ttsAvailable && (
          <div className="px-4 py-2 bg-gradient-to-r from-amber-950/30 via-neutral-900/50 to-neutral-950 border-b border-neutral-800/80 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-neutral-200 text-xs">Đọc phụ đề giọng nói (TTS)</span>
                <p className="text-[10px] text-neutral-400">Tự động phát âm phụ đề tiếng Việt khi hội thoại xuất hiện</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Speed rate selector */}
              <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5 text-[11px]">
                {[0.8, 1.0, 1.2, 1.4].map((r) => {
                  const currentRate = ttsSettings?.rate ?? ttsRate ?? 1.0;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        onChangeTtsRate?.(r);
                        if (onChangeTtsSettings) {
                          onChangeTtsSettings({
                            ...(ttsSettings || DEFAULT_TTS_SETTINGS),
                            rate: r,
                          });
                        }
                      }}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                        Math.abs(currentRate - r) < 0.05
                          ? 'bg-amber-500 text-black font-bold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {r}x
                    </button>
                  );
                })}
              </div>

              {/* Toggle Auto TTS button */}
              <button
                type="button"
                onClick={onToggleAutoTts}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoTtsEnabled ? 'bg-amber-500' : 'bg-neutral-800'
                }`}
                title="Bật/Tắt tự động đọc giọng nói"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    autoTtsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* Search & Source Filter Bar */}
        <div className="p-3 border-b border-neutral-800 space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm từ khóa câu thoại (gốc hoặc tiếng Việt)..."
              className="w-full bg-neutral-900/90 border border-neutral-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterSource('all')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition ${
                filterSource === 'all'
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              Tất cả ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterSource('stream-cc')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition flex items-center gap-1 ${
                filterSource === 'stream-cc'
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Subtitles className="w-3 h-3 text-cyan-400" />
              <span>CC Stream</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterSource('speech-recognition')}
              className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition flex items-center gap-1 ${
                filterSource === 'speech-recognition'
                  ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800 shadow-sm'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Mic className="w-3 h-3 text-indigo-400" />
              <span>Voice AI</span>
            </button>
          </div>
        </div>

        {/* Transcript Items Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {filteredItems.length === 0 ? (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 text-neutral-500">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-600 mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-neutral-400 mb-1">
                {items.length === 0 ? 'Chưa có dữ liệu phụ đề' : 'Không tìm thấy kết quả phù hợp'}
              </p>
              <p className="text-xs text-neutral-500 max-w-xs mb-4">
                {items.length === 0
                  ? 'Khi kênh phát có phụ đề hoặc khi bạn bật Voice AI, các câu thoại sẽ tự động xuất hiện và lưu tại đây.'
                  : `Không có câu thoại nào chứa từ khóa "${searchQuery}".`}
              </p>
              {items.length === 0 && onTriggerSample && (
                <button
                  type="button"
                  onClick={onTriggerSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Nạp câu thoại mẫu thử nghiệm</span>
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isVoice = item.sourceType === 'speech-recognition';
              const isSpeaking = speakingId === item.id;
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-neutral-900/70 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 transition group space-y-1.5"
                >
                  {/* Top Bar of item */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-400">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-neutral-500">#{items.length - index}</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-neutral-500" />
                        {item.timeFormatted}
                      </span>
                      {isVoice ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 text-[10px] font-semibold">
                          <Mic className="w-2.5 h-2.5" />
                          Voice AI
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 text-[10px] font-semibold">
                          <Subtitles className="w-2.5 h-2.5" />
                          CC Stream
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {ttsAvailable && (
                        <button
                          type="button"
                          onClick={() => handleSpeak(item)}
                          className={`p-1 rounded-md transition cursor-pointer ${
                            isSpeaking
                              ? 'bg-amber-500 text-black font-bold animate-pulse'
                              : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-800'
                          }`}
                          title="Đọc to câu này bằng giọng nói (TTS)"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopy(item)}
                        className={`p-1 rounded-md transition cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                        }`}
                        title="Sao chép câu thoại"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Translated Text */}
                  {item.translatedText ? (
                    <div className="text-amber-300 font-semibold text-xs sm:text-sm leading-snug">
                      {item.translatedText}
                    </div>
                  ) : null}

                  {/* Original Text */}
                  <div className="text-neutral-400 text-xs italic leading-snug">
                    {item.originalText}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer Status */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/60 text-[11px] text-neutral-400 flex items-center justify-between">
          <span>Tự động cập nhật theo thời gian thực</span>
          <span className="text-neutral-500">Giai đoạn 4: Transcript & Voice TTS</span>
        </div>
      </div>
    </div>
  );
};
