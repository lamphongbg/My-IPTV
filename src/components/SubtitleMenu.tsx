import React, { useState, useEffect } from 'react';
import {
  SubtitleEngine,
  SubtitleDisplayMode,
  SubtitleFontSize,
  SubtitlePosition,
  SubtitleTrackInfo,
  SubtitleGenre,
  SUBTITLE_GENRES,
  SAMPLE_BROADCAST_CUES,
} from '../services/subtitleTranslator';
import {
  LiveSpeechStatus,
  SPOKEN_LANGUAGES,
} from '../services/liveSpeechRecognizer';
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
  ArrowDown,
  ArrowUp,
  Minus,
  Clock,
  Plus,
  RotateCcw,
  MoveVertical,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Gauge,
  Activity,
  FileText,
  Film,
  Palette,
  Bot,
} from 'lucide-react';
import {
  TtsSettings,
  DEFAULT_TTS_SETTINGS,
  speakText,
  stopSpeaking,
  onVoicesChanged,
} from '../services/transcriptService';

interface SubtitleMenuProps {
  isOpen: boolean;
  onClose: () => void;
  enabled: boolean;
  onToggleEnabled: () => void;
  engine: SubtitleEngine;
  onChangeEngine: (engine: SubtitleEngine) => void;
  genre?: SubtitleGenre;
  onChangeGenre?: (genre: SubtitleGenre) => void;
  displayMode: SubtitleDisplayMode;
  onChangeDisplayMode: (mode: SubtitleDisplayMode) => void;
  targetLang: string;
  onChangeTargetLang: (lang: string) => void;
  fontSize: SubtitleFontSize;
  onChangeFontSize: (size: SubtitleFontSize) => void;
  position: SubtitlePosition;
  onChangePosition: (pos: SubtitlePosition) => void;
  delayOffset: number;
  onChangeDelayOffset: (offset: number) => void;
  tracks: SubtitleTrackInfo[];
  selectedTrackId: number;
  onSelectTrack: (trackId: number) => void;
  onTriggerSampleCue: (sampleText: string) => void;
  channelHasSubtitles?: boolean;
  channelName?: string;
  onOpenDiagnostic?: () => void;
  liveSpeechEnabled?: boolean;
  onToggleLiveSpeech?: () => void;
  speechSourceLang?: string;
  onChangeSpeechSourceLang?: (lang: string) => void;
  liveSpeechStatus?: LiveSpeechStatus;
  liveSpeechMessage?: string;
  isSpeechSupported?: boolean;
  onOpenHistory?: () => void;
  transcriptCount?: number;
  autoTtsEnabled?: boolean;
  onToggleAutoTts?: () => void;
  ttsSettings?: TtsSettings;
  onChangeTtsSettings?: (settings: TtsSettings) => void;
}

export type SubtitleMenuTab = 'translation' | 'style' | 'voice';

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
  position,
  onChangePosition,
  delayOffset,
  onChangeDelayOffset,
  tracks,
  selectedTrackId,
  onSelectTrack,
  onTriggerSampleCue,
  channelHasSubtitles,
  channelName,
  onOpenDiagnostic,
  liveSpeechEnabled = false,
  onToggleLiveSpeech,
  speechSourceLang = 'en-US',
  onChangeSpeechSourceLang,
  liveSpeechStatus = 'idle',
  liveSpeechMessage,
  isSpeechSupported = true,
  genre = 'general',
  onChangeGenre,
  onOpenHistory,
  transcriptCount = 0,
  autoTtsEnabled = false,
  onToggleAutoTts,
  ttsSettings,
  onChangeTtsSettings,
}) => {
  const [activeTab, setActiveTab] = useState<SubtitleMenuTab>(() => {
    try {
      const saved = localStorage.getItem('iptv_subtitle_menu_tab');
      if (saved === 'translation' || saved === 'style' || saved === 'voice') return saved;
    } catch {}
    return 'translation';
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlayingTtsSample, setIsPlayingTtsSample] = useState<boolean>(false);
  const [showDemoList, setShowDemoList] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('iptv_subtitle_menu_tab', activeTab);
    } catch {}
  }, [activeTab]);

  useEffect(() => {
    const cleanup = onVoicesChanged((loadedVoices) => {
      setVoices(loadedVoices);
    });
    return cleanup;
  }, []);

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full mb-2 right-0 w-96 max-w-[calc(100vw-24px)] bg-neutral-950/98 backdrop-blur-2xl border border-neutral-800 rounded-2xl shadow-2xl z-50 animate-fadeIn text-neutral-200 select-none overflow-hidden flex flex-col"
      style={{ maxHeight: 'calc(100vh - 120px)' }}
    >
      {/* 1. Header Bar: Compact & Clean */}
      <div className="px-3.5 py-2.5 bg-neutral-900/80 border-b border-neutral-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
            <Subtitles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-xs text-white truncate flex items-center gap-1.5">
              <span>Cài đặt Phụ đề</span>
              {enabled && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" />
              )}
            </h3>
            <p className="text-[10px] text-neutral-400 truncate">
              {channelName ? `Kênh: ${channelName}` : 'Dịch AI & thuyết minh trực tiếp'}
            </p>
          </div>
        </div>

        {/* Master Toggle + Close */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onToggleEnabled}
            className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm ${
              enabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700'
            }`}
            title="Bật/Tắt phụ đề (Phím tắt C)"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-white' : 'bg-neutral-500'}`} />
            <span>{enabled ? 'Đang bật' : 'Đang tắt'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition cursor-pointer"
            title="Đóng menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning banner if source lacks CC tags */}
      {channelHasSubtitles === false && (
        <div className="px-3 py-1.5 bg-amber-950/50 border-b border-amber-600/40 text-amber-200 text-[10px] flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">Kênh thiếu CC: Dùng <strong>Voice AI</strong> để nghe trực tiếp</span>
          </div>
          {onToggleLiveSpeech && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('voice');
                if (!liveSpeechEnabled) onToggleLiveSpeech();
              }}
              className="px-2 py-0.5 bg-amber-500 text-black rounded font-bold hover:bg-amber-400 transition cursor-pointer flex-shrink-0"
            >
              Bật ngay
            </button>
          )}
        </div>
      )}

      {/* 2. Professional Segmented Navigation Tabs */}
      <div className="p-1.5 bg-neutral-900/60 border-b border-neutral-800/80">
        <div className="grid grid-cols-3 gap-1 bg-neutral-950/70 p-0.5 rounded-xl border border-neutral-800/70">
          <button
            type="button"
            onClick={() => setActiveTab('translation')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'translation'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>Dịch thuật</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'style'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Hiển thị & Trễ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'voice'
                ? 'bg-amber-500 text-neutral-950 shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Giọng đọc AI</span>
            {(autoTtsEnabled || liveSpeechEnabled) && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* 3. Main Content Scroll Area */}
      <div className="p-3.5 space-y-3.5 overflow-y-auto max-h-[58vh]">
        {/* ================= TAB 1: DỊCH THUẬT (TRANSLATION) ================= */}
        {activeTab === 'translation' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Chế độ hiển thị phụ đề */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-amber-400" />
                  <span>Chế độ hiển thị</span>
                </label>
                <span className="text-[10px] font-semibold text-amber-400">
                  {displayMode === 'translated' ? 'Chỉ dịch (Ẩn gốc)' : displayMode === 'dual' ? 'Song ngữ (2 dòng)' : 'Chỉ câu gốc'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'translated' as SubtitleDisplayMode, label: 'Chỉ dịch', sub: 'Ẩn tiếng gốc' },
                  { id: 'dual' as SubtitleDisplayMode, label: 'Song ngữ', sub: 'Dịch + Gốc' },
                  { id: 'original' as SubtitleDisplayMode, label: 'Chỉ câu gốc', sub: 'Không dịch' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeDisplayMode(mode.id)}
                    className={`py-2 px-1 rounded-xl text-center border transition flex flex-col items-center justify-center cursor-pointer ${
                      displayMode === mode.id
                        ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400 shadow-sm'
                        : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    <span className="text-[11px] font-bold leading-tight">{mode.label}</span>
                    <span className={`text-[9px] leading-tight ${displayMode === mode.id ? 'text-neutral-950 font-semibold' : 'text-neutral-400'}`}>
                      {mode.sub}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Ngôn ngữ dịch đích */}
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Languages className="w-3 h-3 text-sky-400" />
                <span>Ngôn ngữ dịch đích</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {TARGET_LANGUAGES.map((lang) => {
                  const isSelected = targetLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => onChangeTargetLang(lang.code)}
                      className={`p-1.5 rounded-lg text-center transition border cursor-pointer flex items-center justify-center gap-1 ${
                        isSelected
                          ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold shadow-sm'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="text-xs">{lang.flag}</span>
                      <span className="text-[10.5px] truncate">{lang.code.toUpperCase()}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Động cơ dịch văn bản */}
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Công nghệ dịch văn bản</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChangeEngine('google')}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    engine === 'google'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-200 shadow-sm'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-[11px] flex items-center gap-1 text-emerald-400">
                      <Zap className="w-3 h-3" /> Google Siêu tốc
                    </span>
                    {engine === 'google' && <Check className="w-3 h-3 text-emerald-400" />}
                  </div>
                  <span className="text-[9.5px] leading-tight opacity-80">
                    Phản hồi ~50ms, tối ưu độ trễ cho live
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeEngine('gemini')}
                  className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                    engine === 'gemini'
                      ? 'bg-violet-950/70 border-violet-500 text-violet-200 shadow-sm'
                      : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-bold text-[11px] flex items-center gap-1 text-violet-400">
                      <Sparkles className="w-3 h-3" /> Gemini AI
                    </span>
                    {engine === 'gemini' && <Check className="w-3 h-3 text-violet-400" />}
                  </div>
                  <span className="text-[9.5px] leading-tight opacity-80">
                    Dịch mượt theo ngữ cảnh từng thể loại
                  </span>
                </button>
              </div>
            </div>

            {/* Ngữ cảnh dịch AI (Khi dùng Gemini hoặc chọn trước) */}
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                <Film className="w-3 h-3 text-violet-400" />
                <span>Ngữ cảnh thể loại kênh</span>
              </label>
              <div className="grid grid-cols-3 gap-1">
                {SUBTITLE_GENRES.map((g) => {
                  const isSelected = (genre || 'general') === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => onChangeGenre?.(g.id)}
                      className={`p-1.5 rounded-lg text-left border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-violet-950/80 border-violet-500 text-violet-200 font-bold shadow-sm'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="text-[10px] truncate flex items-center gap-1">
                        <span>{g.icon}</span>
                        <span className="truncate">{g.name.split('/')[0].trim()}</span>
                      </span>
                      {isSelected && <Check className="w-2.5 h-2.5 text-violet-400 flex-shrink-0 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: HIỂN THỊ & BÙ TRỄ (STYLE & SYNC) ================= */}
        {activeTab === 'style' && (
          <div className="space-y-3 animate-fadeIn">
            {/* Cỡ chữ & Vị trí hiển thị (Gọn gàng trong 1 cụm trực quan) */}
            <div className="grid grid-cols-2 gap-2">
              {/* Cỡ chữ */}
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Type className="w-3 h-3 text-emerald-400" />
                  <span>Cỡ chữ</span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'sm' as SubtitleFontSize, label: 'Nhỏ' },
                    { id: 'md' as SubtitleFontSize, label: 'Vừa' },
                    { id: 'lg' as SubtitleFontSize, label: 'Lớn' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onChangeFontSize(s.id)}
                      className={`py-1.5 rounded-lg text-[10.5px] font-semibold text-center border transition cursor-pointer ${
                        fontSize === s.id
                          ? 'bg-neutral-800 border-amber-500 text-amber-300 font-bold'
                          : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Vị trí */}
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <MoveVertical className="w-3 h-3 text-sky-400" />
                  <span>Vị trí</span>
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'bottom' as SubtitlePosition, label: 'Đáy', icon: ArrowDown },
                    { id: 'middle' as SubtitlePosition, label: 'Giữa', icon: Minus },
                    { id: 'top' as SubtitlePosition, label: 'Đỉnh', icon: ArrowUp },
                  ].map((p) => {
                    const IconComponent = p.icon;
                    const isSelected = position === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => onChangePosition(p.id)}
                        className={`py-1.5 rounded-lg text-center border transition flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-950/70 border-sky-500 text-sky-200 font-bold'
                            : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                        title={`Hiển thị ở vị trí ${p.label}`}
                      >
                        <IconComponent className={`w-3 h-3 ${isSelected ? 'text-sky-400' : 'text-neutral-500'}`} />
                        <span className="text-[10.5px]">{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bù trễ đồng bộ (Sync Delay) - Compact & Elegant */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Bù trễ đồng bộ lời thoại</span>
                </label>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                    delayOffset === 0
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60'
                      : delayOffset > 0
                      ? 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                      : 'bg-sky-950/80 text-sky-300 border-sky-800/60'
                  }`}
                >
                  {delayOffset === 0
                    ? '0.0s (Chuẩn)'
                    : delayOffset > 0
                    ? `+${delayOffset.toFixed(1)}s (Chờ tiếng)`
                    : `${delayOffset.toFixed(1)}s (Hiện sớm)`}
                </span>
              </div>

              {/* Stepper + Reset */}
              <div className="flex items-center gap-1 bg-neutral-900/80 p-1 rounded-xl border border-neutral-800 mb-1">
                <button
                  type="button"
                  onClick={() => onChangeDelayOffset(Math.max(-3, Number((delayOffset - 0.5).toFixed(1))))}
                  className="flex-1 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-semibold text-neutral-200 transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Hiện phụ đề sớm hơn 0.5s"
                >
                  <Minus className="w-3 h-3 text-sky-400" />
                  <span>-0.5s</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDelayOffset(0)}
                  className="px-3 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-[10.5px] font-semibold text-neutral-300 transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Khôi phục chuẩn 0.0s"
                >
                  <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                  <span>0s</span>
                </button>

                <button
                  type="button"
                  onClick={() => onChangeDelayOffset(Math.min(5, Number((delayOffset + 0.5).toFixed(1))))}
                  className="flex-1 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-xs font-semibold text-neutral-200 transition flex items-center justify-center gap-1 cursor-pointer"
                  title="Trễ thêm 0.5s"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>+0.5s</span>
                </button>
              </div>

              {/* Quick Preset Chips */}
              <div className="grid grid-cols-6 gap-1">
                {[-1.0, -0.5, 0.0, 0.5, 1.0, 2.0].map((val) => {
                  const isSelected = delayOffset === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onChangeDelayOffset(val)}
                      className={`py-0.5 rounded text-[9.5px] font-mono font-semibold transition cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400 shadow-sm'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {val > 0 ? `+${val}` : `${val}`}s
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Track phụ đề nguồn (Stream Tracks) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>Track phụ đề nguồn</span>
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {tracks.length > 0 ? `${tracks.length} track` : 'Auto CEA-608'}
                </span>
              </div>

              {tracks.length > 0 ? (
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => onSelectTrack(-1)}
                    className={`w-full px-2 py-1 rounded-lg text-left text-[11px] flex items-center justify-between transition border ${
                      selectedTrackId === -1
                        ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-semibold'
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
                      className={`w-full px-2 py-1 rounded-lg text-left text-[11px] flex items-center justify-between transition border ${
                        selectedTrackId === t.id
                          ? 'bg-amber-950/80 border-amber-600 text-amber-200 font-semibold'
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
                <p className="text-[9.5px] text-neutral-400 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/80 leading-relaxed">
                  📡 Tự động bắt tín hiệu <strong>CEA-608 / WebVTT</strong> ngay khi kênh phát có thoại.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: GIỌNG ĐỌC & AUDIO AI (VOICE & SPEECH) ================= */}
        {activeTab === 'voice' && (
          <div className="space-y-3 animate-fadeIn">
            {/* 1. Đọc phát âm phụ đề (TTS) */}
            <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center ${
                      autoTtsEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white">Đọc phát âm phụ đề (TTS)</span>
                    <p className="text-[9.5px] text-neutral-400">Tự động đọc to bản dịch bằng giọng nói</p>
                  </div>
                </div>

                {onToggleAutoTts && (
                  <button
                    type="button"
                    onClick={onToggleAutoTts}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      autoTtsEnabled ? 'bg-amber-500' : 'bg-neutral-800'
                    }`}
                    title={autoTtsEnabled ? 'Tắt đọc tự động' : 'Bật đọc tự động'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        autoTtsEnabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                )}
              </div>

              {/* TTS Controls */}
              <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                {/* Voice select */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                      <Bot className="w-3 h-3 text-amber-400" />
                      <span>Chọn giọng đọc</span>
                    </label>
                    <span className="text-[9.5px] text-neutral-400 font-mono">
                      {voices.length > 0 ? `${voices.length} giọng` : 'Mặc định'}
                    </span>
                  </div>
                  <select
                    value={ttsSettings?.voiceURI || ''}
                    onChange={(e) => {
                      onChangeTtsSettings?.({
                        ...(ttsSettings || DEFAULT_TTS_SETTINGS),
                        voiceURI: e.target.value,
                      });
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Tự động chọn theo ngôn ngữ --</option>
                    {voices.some(
                      (v) => (v.lang || '').toLowerCase().startsWith('vi') || v.name.toLowerCase().includes('vietnam')
                    ) && (
                      <optgroup label="🇻🇳 Giọng Tiếng Việt">
                        {voices
                          .filter(
                            (v) =>
                              (v.lang || '').toLowerCase().startsWith('vi') ||
                              v.name.toLowerCase().includes('vietnam')
                          )
                          .map((v) => (
                            <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                              {v.name} ({v.lang})
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label="🌐 Giọng khác">
                      {voices
                        .filter(
                          (v) =>
                            !(v.lang || '').toLowerCase().startsWith('vi') &&
                            !v.name.toLowerCase().includes('vietnam')
                        )
                        .map((v) => (
                          <option key={v.voiceURI || v.name} value={v.voiceURI || v.name}>
                            {v.name} ({v.lang})
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                {/* Speed & Pitch Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Speed */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9.5px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                        <Gauge className="w-2.5 h-2.5 text-sky-400" />
                        <span>Tốc độ</span>
                      </label>
                      <span className="text-[9.5px] font-mono text-amber-400 font-bold">
                        {(ttsSettings?.rate || 1.0).toFixed(1)}x
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-0.5">
                      {[0.8, 1.0, 1.2, 1.4].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            onChangeTtsSettings?.({
                              ...(ttsSettings || DEFAULT_TTS_SETTINGS),
                              rate: r,
                            });
                          }}
                          className={`py-1 rounded text-[9.5px] font-semibold text-center border transition cursor-pointer ${
                            Math.abs((ttsSettings?.rate || 1.0) - r) < 0.05
                              ? 'bg-amber-500 text-neutral-950 font-bold border-amber-400'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pitch */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[9.5px] font-bold text-neutral-400 uppercase flex items-center gap-1">
                        <Sliders className="w-2.5 h-2.5 text-violet-400" />
                        <span>Cao độ</span>
                      </label>
                      <span className="text-[9.5px] font-mono text-violet-300 font-bold">
                        {(ttsSettings?.pitch || 1.0) <= 0.9 ? 'Trầm' : (ttsSettings?.pitch || 1.0) >= 1.15 ? 'Bổng' : 'Chuẩn'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-0.5">
                      {[
                        { label: 'Trầm', val: 0.85 },
                        { label: 'Chuẩn', val: 1.0 },
                        { label: 'Bổng', val: 1.2 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => {
                            onChangeTtsSettings?.({
                              ...(ttsSettings || DEFAULT_TTS_SETTINGS),
                              pitch: item.val,
                            });
                          }}
                          className={`py-1 rounded text-[9.5px] font-semibold text-center border transition cursor-pointer ${
                            Math.abs((ttsSettings?.pitch || 1.0) - item.val) < 0.05
                              ? 'bg-violet-600 text-white font-bold border-violet-500'
                              : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Voice Test & Reset */}
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isPlayingTtsSample) {
                        stopSpeaking();
                        setIsPlayingTtsSample(false);
                      } else {
                        setIsPlayingTtsSample(true);
                        const samplePhrase =
                          'Chào bạn, đây là giọng đọc thử nghiệm thuyết minh phụ đề IPTV.';
                        speakText(
                          samplePhrase,
                          targetLang === 'vi' ? 'vi-VN' : targetLang,
                          ttsSettings || DEFAULT_TTS_SETTINGS,
                          () => setIsPlayingTtsSample(false)
                        );
                      }
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-[10.5px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                      isPlayingTtsSample
                        ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {isPlayingTtsSample ? (
                      <>
                        <VolumeX className="w-3 h-3" />
                        <span>Dừng nghe thử</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Nghe thử giọng</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeTtsSettings?.(DEFAULT_TTS_SETTINGS)}
                    className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-lg text-[10px] font-medium border border-neutral-700 transition cursor-pointer flex items-center gap-1"
                    title="Đặt lại giọng mặc định"
                  >
                    <RotateCcw className="w-2.5 h-2.5 text-amber-400" />
                    <span>Đặt lại</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Nhận dạng âm thanh trực tiếp (Audio AI / Voice-to-Text) */}
            <div className={`p-2.5 rounded-xl border transition space-y-2 ${
              liveSpeechEnabled
                ? 'bg-rose-950/30 border-rose-600/60 shadow-lg shadow-rose-950/50'
                : 'bg-neutral-900/60 border-neutral-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center border ${
                    liveSpeechEnabled
                      ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                  }`}>
                    {liveSpeechEnabled ? <Mic className="w-3.5 h-3.5 animate-pulse" /> : <MicOff className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs text-white flex items-center gap-1.5">
                      <span>Bóc băng tiếng nói (Voice AI)</span>
                      {liveSpeechEnabled && (
                        <span className="flex items-center gap-1 text-[9px] text-rose-400 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-neutral-400">
                      Tạo phụ đề từ âm thanh kênh (khi không có CC)
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleLiveSpeech}
                  disabled={!isSpeechSupported}
                  className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${
                    !isSpeechSupported
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : liveSpeechEnabled
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700'
                  }`}
                >
                  {liveSpeechEnabled ? 'Đang bật' : 'Bật ngay'}
                </button>
              </div>

              {/* Status Wave when active */}
              {liveSpeechEnabled && (
                <div className="p-1.5 rounded-lg bg-neutral-950/80 border border-neutral-800 flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1.5 text-rose-300 font-mono truncate mr-2">
                    <Activity className="w-3 h-3 text-rose-400 animate-pulse flex-shrink-0" />
                    <span className="truncate">{liveSpeechMessage || 'Đang lắng nghe âm thanh kênh phát...'}</span>
                  </div>
                  <div className="flex items-center gap-0.5 h-2.5 flex-shrink-0">
                    <span className="w-0.5 h-2 bg-rose-500 animate-bounce" />
                    <span className="w-0.5 h-2.5 bg-rose-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-1.5 bg-rose-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              {/* Ngôn ngữ giọng nói phát (Kênh đang nói) - Clean labels */}
              <div>
                <label className="text-[9.5px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Ngôn ngữ kênh đang nói (Nguồn)
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {SPOKEN_LANGUAGES.slice(0, 6).map((sl) => {
                    const isSelected = speechSourceLang === sl.code;
                    // Format short clean label (e.g. "Tiếng Anh" -> "Anh")
                    const cleanLabel = sl.label.replace('Tiếng ', '').split('(')[0].trim();
                    return (
                      <button
                        key={sl.code}
                        type="button"
                        onClick={() => onChangeSpeechSourceLang?.(sl.code)}
                        className={`px-1.5 py-1 rounded-md text-[10px] font-medium border text-left flex items-center justify-between transition cursor-pointer ${
                          isSelected
                            ? 'bg-rose-950/80 border-rose-500 text-rose-200 font-bold'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <span className="truncate flex items-center gap-1">
                          <span>{sl.flag}</span>
                          <span className="truncate">{cleanLabel}</span>
                        </span>
                        {isSelected && <Check className="w-2.5 h-2.5 text-rose-400 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Utility Toolbar (Clean Footer) */}
      <div className="p-2 bg-neutral-900/90 border-t border-neutral-800 flex items-center justify-between gap-1.5 text-xs">
        {/* Open History Drawer */}
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            className="flex-1 py-1.5 px-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white font-medium transition cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-700/80 shadow-sm"
            title="Xem toàn bộ lịch sử thoại & xuất file .SRT/.TXT"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold">Nhật ký</span>
            {transcriptCount > 0 && (
              <span className="px-1 py-0.2 text-[9px] font-mono rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {transcriptCount}
              </span>
            )}
          </button>
        )}

        {/* Diagnostic Modal */}
        {onOpenDiagnostic && (
          <button
            type="button"
            onClick={onOpenDiagnostic}
            className="py-1.5 px-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-medium transition cursor-pointer flex items-center justify-center gap-1 border border-neutral-700/80"
            title="Chẩn đoán chuyên sâu luồng HLS"
          >
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px]">Chẩn đoán</span>
          </button>
        )}

        {/* Demo Cue Simulator Trigger */}
        <button
          type="button"
          onClick={() => setShowDemoList(!showDemoList)}
          className={`py-1.5 px-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1 border text-[11px] font-medium ${
            showDemoList
              ? 'bg-amber-500 text-black border-amber-400 font-bold'
              : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border-neutral-700/80'
          }`}
          title="Chạy thử câu phụ đề mẫu"
        >
          <Play className="w-3 h-3 fill-current" />
          <span>Demo</span>
        </button>
      </div>

      {/* Pop-up Demo List if triggered */}
      {showDemoList && (
        <div className="p-2.5 bg-neutral-950 border-t border-neutral-800 space-y-1 animate-fadeIn">
          <div className="text-[10px] text-neutral-400 mb-1 flex items-center justify-between">
            <span>Bấm câu mẫu để thử dịch ngay:</span>
            <button
              type="button"
              onClick={() => setShowDemoList(false)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {SAMPLE_BROADCAST_CUES.slice(0, 3).map((sample, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onTriggerSampleCue(sample.text);
                setShowDemoList(false);
              }}
              className="w-full text-left p-1.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 transition flex items-center justify-between group cursor-pointer"
            >
              <div className="min-w-0 flex-1 mr-2">
                <div className="text-[10px] text-amber-300 font-semibold truncate flex items-center gap-1">
                  <Play className="w-2.5 h-2.5 fill-current text-amber-400" />
                  <span>{sample.label}</span>
                </div>
                <div className="text-[9.5px] text-neutral-400 truncate">"{sample.text}"</div>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded font-mono group-hover:bg-amber-500 group-hover:text-black">
                Thử
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
