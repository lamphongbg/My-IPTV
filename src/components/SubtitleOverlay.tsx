import React from 'react';
import { SubtitleCueItem, SubtitleDisplayMode, SubtitleFontSize } from '../services/subtitleTranslator';
import { Zap, Sparkles } from 'lucide-react';

interface SubtitleOverlayProps {
  currentSubtitle: SubtitleCueItem | null;
  displayMode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  enabled: boolean;
  isFullscreen: boolean;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  currentSubtitle,
  displayMode,
  fontSize,
  enabled,
  isFullscreen,
}) => {
  if (!enabled || !currentSubtitle || !currentSubtitle.active) {
    return null;
  }

  // Determine font size classes
  const sizeClasses = {
    sm: {
      translated: 'text-sm sm:text-base leading-snug',
      original: 'text-[11px] sm:text-xs',
      padding: 'px-3 py-1.5 sm:px-4 sm:py-2',
    },
    md: {
      translated: 'text-base sm:text-lg md:text-xl font-bold leading-snug',
      original: 'text-xs sm:text-sm',
      padding: 'px-4 py-2 sm:px-5 sm:py-2.5',
    },
    lg: {
      translated: 'text-lg sm:text-xl md:text-2xl font-extrabold leading-tight',
      original: 'text-xs sm:text-base',
      padding: 'px-5 py-2.5 sm:px-6 sm:py-3.5',
    },
  }[fontSize];

  const hasTranslation = Boolean(currentSubtitle.translatedText && currentSubtitle.translatedText.trim());
  const hasOriginal = Boolean(currentSubtitle.originalText && currentSubtitle.originalText.trim());

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-25 text-center pointer-events-none transition-all duration-200 w-full max-w-[94%] sm:max-w-[85%] md:max-w-[75%] ${
        isFullscreen ? 'bottom-16 sm:bottom-20' : 'bottom-12 sm:bottom-14'
      }`}
    >
      <div
        className={`inline-block ${sizeClasses.padding} rounded-xl bg-black/85 backdrop-blur-md border border-neutral-700/80 shadow-2xl shadow-black text-center transition-all animate-fadeIn`}
      >
        {/* Dual Mode: Show Translated Text + Original Text */}
        {displayMode === 'dual' && (
          <div className="space-y-1">
            {/* Translated Text in vibrant Amber/Gold */}
            <p
              className={`${sizeClasses.translated} text-amber-300 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]`}
            >
              {currentSubtitle.translatedText ? (
                currentSubtitle.translatedText
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span>{currentSubtitle.originalText}</span>
                  {currentSubtitle.isLoading && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" title="Đang dịch tức thì..." />
                  )}
                </span>
              )}
            </p>

            {/* Original Text in soft italic neutral */}
            {hasOriginal && currentSubtitle.translatedText && (
              <p
                className={`${sizeClasses.original} text-neutral-300/90 font-normal italic tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]`}
              >
                {currentSubtitle.originalText}
              </p>
            )}
          </div>
        )}

        {/* Translated Only Mode */}
        {displayMode === 'translated' && (
          <p
            className={`${sizeClasses.translated} text-amber-300 tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]`}
          >
            {currentSubtitle.translatedText ? (
              currentSubtitle.translatedText
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span>{currentSubtitle.originalText}</span>
                {currentSubtitle.isLoading && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" title="Đang dịch tức thì..." />
                )}
              </span>
            )}
          </p>
        )}

        {/* Original Only Mode */}
        {displayMode === 'original' && (
          <p
            className={`${sizeClasses.translated} text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]`}
          >
            {currentSubtitle.originalText}
          </p>
        )}

        {/* Latency & Engine Tag Badge */}
        <div className="mt-1 flex items-center justify-center gap-2 text-[9px] text-neutral-400 select-none">
          {currentSubtitle.engine === 'gemini' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-950/80 border border-violet-800/60 text-violet-300 font-mono">
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
              <span>Gemini 3.8 Flash AI</span>
              {currentSubtitle.latencyMs ? ` • ${currentSubtitle.latencyMs}ms` : ''}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 font-mono">
              <Zap className="w-2.5 h-2.5 text-emerald-400" />
              <span>Google Translate</span>
              {currentSubtitle.latencyMs !== undefined ? ` • ${currentSubtitle.latencyMs}ms` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
