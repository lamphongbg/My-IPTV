import React from 'react';
import {
  SubtitleEngine,
  SubtitleDisplayMode,
  SubtitleFontSize,
  SubtitleTrackInfo,
  SAMPLE_BROADCAST_CUES,
} from '../services/subtitleTranslator';
import {
  Subtitles,
  Zap,
  Sparkles,
  Check,
  Languages,
  X,
  Play,
  Type,
  Search,
  AlertTriangle,
  Radio,
  Sliders,
} from 'lucide-react';

interface SubtitleMenuProps {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  onToggleEnabled: () => void;
  engine: SubtitleEngine;
  onChangeEngine: (engine: SubtitleEngine) => void;
  displayMode: SubtitleDisplayMode;
  onChangeDisplayMode: (mode: SubtitleDisplayMode) => void;
  targetLang: string;
  onChangeTargetLang: (lang: string) => void;
  fontSize: SubtitleFontSize;
  onChangeFontSize: (size: SubtitleFontSize) => void;
  tracks: SubtitleTrackInfo[];
  selectedTrackId: number;
  onSelectTrack: (trackId: number) => void;
  onTriggerSampleCue: (sampleText: string) => void;
  channelHasSubtitles?: boolean;
  channelName?: string;
  onOpenDiagnostic?: () => void;
}

const TARGET_LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

export const SubtitleMenu: React.FC<SubtitleMenuProps> = ({
  isOpen,
  onClose,
  enabled,
  onToggleEnabled,
  engine,
  onChangeEngine,
  displayMode,
  onChangeDisplayMode,
  targetLang,
  onChangeTargetLang,
  fontSize,
  onChangeFontSize,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onTriggerSampleCue,
  channelHasSubtitles,
  channelName,
  onOpenDiagnostic,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full mb-2 right-0 w-84 max-w-[calc(100vw-24px)] bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-2xl p-3.5 shadow-2xl z-50 animate-fadeIn text-neutral-200 select-none max-h-[82vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
            <Subtitles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
              <span>Phụ đề & Dịch AI Trực tiếp</span>
              <span className="text-[10px] text-amber-400 font-mono bg-amber-950/80 px-1 py-0.2 rounded border border-amber-800/60">
                Phím C
              </span>
            </h3>
            <p className="text-[10px] text-neutral-400">Tự động bắt phụ đề HLS và dịch tức thì</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenDiagnostic && (
            <button
              type="button"
              onClick={onOpenDiagnostic}
              className="text-amber-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-neutral-800 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              title="Mở Công Cụ Chẩn Đoán Phụ Đề HLS"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chẩn đoán</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-md hover:bg-neutral-800 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning Banner if stream source lacks subtitle tags */}
      {channelHasSubtitles === false && (
        <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-2.5 text-xs mb-3 text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[11px] text-amber-300">
                Cảnh báo: Nguồn phát thiếu thẻ phụ đề
              </div>
              <p className="text-[10px] text-neutral-300 mt-0.5 leading-relaxed">
                Nguồn HLS của kênh này không khai báo thẻ <code>#EXT-X-MEDIA:TYPE=SUBTITLES</code>. 
                Bạn vẫn có thể dùng tính năng Bắt thoại tự động & Dịch AI hoặc chạy kiểm tra sâu.
              </p>
              {onOpenDiagnostic && (
                <button
                  type="button"
                  onClick={onOpenDiagnostic}
                  className="mt-2 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer"
                >
                  <Search className="w-3 h-3 text-amber-400" />
                  <span>Chạy Subtitle Diagnostic Tool</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Enable/Disable Toggle */}
      <div className="bg-neutral-900/90 rounded-xl p-2.5 border border-neutral-800/80 mb-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-xs text-neutral-100 flex items-center gap-1.5">
            <span>Trạng thái phụ đề</span>
            {enabled ? (
              <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-1.5 py-0.2 rounded-full font-bold">
                Đang bật
              </span>
            ) : (
              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.2 rounded-full font-medium">
                Đang tắt
              </span>
            )}
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">
            {enabled ? 'Bắt thoại & hiển thị bản dịch' : 'Ẩn chữ phụ đề trên màn hình'}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleEnabled}
          className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
            enabled ? 'bg-amber-500' : 'bg-neutral-700'
          }`}
          title="Bật / Tắt phụ đề (Phím C)"
        >
          <div
            className={`w-5 h-5 rounded-full bg-white transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3">
          {/* Section: AI Translation Engine */}
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Công nghệ dịch văn bản</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeEngine('google')}
                className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                  engine === 'google'
                    ? 'bg-emerald-950/70 border-emerald-500/70 text-emerald-200'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-[11px] flex items-center gap-1 text-emerald-400">
                    <Zap className="w-3 h-3" /> Google
                  </span>
                  {engine === 'google' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </div>
                <span className="text-[9.5px] leading-tight opacity-80">
                  Siêu tốc ~50ms, độ trễ cực thấp cho truyền hình trực tiếp
                </span>
              </button>

              <button
                type="button"
                onClick={() => onChangeEngine('gemini')}
                className={`p-2 rounded-xl text-left border transition flex flex-col justify-between ${
                  engine === 'gemini'
                    ? 'bg-violet-950/70 border-violet-500/70 text-violet-200'
                    : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-bold text-[11px] flex items-center gap-1 text-violet-400">
                    <Sparkles className="w-3 h-3" /> Gemini AI
                  </span>
                  {engine === 'gemini' && <Check className="w-3.5 h-3.5 text-violet-400" />}
                </div>
                <span className="text-[9.5px] leading-tight opacity-80">
                  Gemini 3.8 Flash: Dịch mượt, chuẩn ngữ cảnh hội thoại phim
                </span>
              </button>
            </div>
          </div>

          {/* Section: Display Mode */}
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Sliders className="w-3 h-3 text-sky-400" />
              <span>Chế độ hiển thị</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-neutral-900/70 p-1 rounded-xl border border-neutral-800">
              <button
                type="button"
                onClick={() => onChangeDisplayMode('dual')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center transition ${
                  displayMode === 'dual'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Song ngữ
              </button>
              <button
                type="button"
                onClick={() => onChangeDisplayMode('translated')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center transition ${
                  displayMode === 'translated'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Chỉ dịch
              </button>
              <button
                type="button"
                onClick={() => onChangeDisplayMode('original')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center transition ${
                  displayMode === 'original'
                    ? 'bg-amber-500 text-neutral-950 font-bold shadow'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Chỉ câu gốc
              </button>
            </div>
          </div>

          {/* Section: Target Language */}
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Languages className="w-3 h-3 text-rose-400" />
              <span>Ngôn ngữ dịch đích</span>
            </label>
            <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-1">
              {TARGET_LANGUAGES.map((lang) => {
                const isSelected = targetLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => onChangeTargetLang(lang.code)}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition border ${
                      isSelected
                        ? 'bg-amber-950/80 border-amber-500/70 text-amber-200 font-semibold'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{lang.flag}</span>
                      <span className="truncate">{lang.label}</span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-amber-400 flex-shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Font Size */}
          <div>
            <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Type className="w-3 h-3 text-emerald-400" />
              <span>Cỡ chữ phụ đề</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'sm' as SubtitleFontSize, label: 'Nhỏ (14px)' },
                { id: 'md' as SubtitleFontSize, label: 'Vừa (18px)' },
                { id: 'lg' as SubtitleFontSize, label: 'Lớn (22px)' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChangeFontSize(s.id)}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center border transition ${
                    fontSize === s.id
                      ? 'bg-neutral-800 border-amber-500 text-amber-300'
                      : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Detected Stream Subtitle Tracks */}
          <div className="pt-2 border-t border-neutral-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Radio className="w-3 h-3 text-amber-400" />
                <span>Track phụ đề nguồn</span>
              </span>
              <span className="text-[10px] text-neutral-400">
                {tracks.length > 0 ? `${tracks.length} track phát hiện` : 'Tự động bắt CEA-608 / VTT'}
              </span>
            </div>

            {tracks.length > 0 ? (
              <div className="space-y-1 max-h-24 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onSelectTrack(-1)}
                  className={`w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition border ${
                    selectedTrackId === -1
                      ? 'bg-amber-950/80 border-amber-600/70 text-amber-200 font-semibold'
                      : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <span>Tự động chọn track chuẩn đài</span>
                  {selectedTrackId === -1 && <Check className="w-3 h-3 text-amber-400" />}
                </button>
                {tracks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTrack(t.id)}
                    className={`w-full px-2 py-1.5 rounded-lg text-left text-xs flex items-center justify-between transition border ${
                      selectedTrackId === t.id
                        ? 'bg-amber-950/80 border-amber-600/70 text-amber-200 font-semibold'
                        : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <span className="truncate">
                      {t.name} {t.lang ? `(${t.lang.toUpperCase()})` : ''}
                    </span>
                    {selectedTrackId === t.id && <Check className="w-3 h-3 text-amber-400" />}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-neutral-400 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80">
                📡 Bộ lắng nghe HLS đang sẵn sàng thu nhận các sự kiện <code>CUE_ENTER</code> và dòng chữ CEA-608/708 ngay khi đài phát bắn ra.
              </p>
            )}
          </div>

          {/* Section: Live Demo Simulator */}
          <div className="pt-2 border-t border-neutral-800">
            <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Chạy thử câu phụ đề mẫu (Demo)</span>
            </label>
            <p className="text-[10px] text-neutral-400 mb-2">
              Bấm vào câu mẫu bất kỳ để kiểm tra dịch tức thì ngay trên luồng phát hiện tại:
            </p>
            <div className="space-y-1">
              {SAMPLE_BROADCAST_CUES.slice(0, 3).map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onTriggerSampleCue(sample.text)}
                  className="w-full text-left p-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 transition flex items-center justify-between group"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <div className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 fill-current text-amber-400 group-hover:scale-110 transition-transform" />
                      <span>{sample.label}</span>
                    </div>
                    <div className="text-[10px] text-neutral-400 truncate mt-0.5">
                      "{sample.text}"
                    </div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono group-hover:bg-amber-500 group-hover:text-black transition">
                    Thử ngay
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
