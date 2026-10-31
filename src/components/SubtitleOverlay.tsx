import React from 'react';
import {
  SubtitleCueItem,
  SubtitleDisplayMode,
  SubtitleFontSize,
  SubtitlePosition,
} from '../services/subtitleTranslator';
import { Mic } from 'lucide-react';

interface SubtitleOverlayProps {
  currentSubtitle: SubtitleCueItem | null;
  displayMode: SubtitleDisplayMode;
  fontSize: SubtitleFontSize;
  position?: SubtitlePosition;
  enabled: boolean;
  isFullscreen: boolean;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  currentSubtitle,
  displayMode,
  fontSize,
  position = 'bottom',
  enabled,
  isFullscreen,
}) => {
  if (!enabled || !currentSubtitle || !currentSubtitle.active) {
    return null;
  }

  const isLiveVoiceDraft = Boolean(
    currentSubtitle.sourceType === 'speech-recognition' && currentSubtitle.isLoading
  );

  // Check if source and target language are the same (e.g. Vietnamese speech -> Vietnamese subtitles)
  const isSameTargetLang = Boolean(
    currentSubtitle.targetLang &&
      currentSubtitle.sourceLang &&
      (currentSubtitle.sourceLang.toLowerCase().startsWith(currentSubtitle.targetLang.toLowerCase()) ||
        (currentSubtitle.sourceLang.toLowerCase().startsWith('vi') && currentSubtitle.targetLang === 'vi') ||
        (currentSubtitle.sourceLang.toLowerCase().startsWith('en') && currentSubtitle.targetLang === 'en'))
  );

  // Check if translated text is identical to original foreign text (failed translation)
  // NOTE: If source language IS the target language (e.g. Vietnamese), it is NOT untranslated!
  const isUntranslated =
    !isSameTargetLang &&
    Boolean(currentSubtitle.translatedText && currentSubtitle.originalText) &&
    currentSubtitle.translatedText.trim().toLowerCase() === currentSubtitle.originalText.trim().toLowerCase();

  // If in 'translated' mode and translation is not ready or untranslated (except live voice draft)
  if (displayMode === 'translated') {
    const hasValidTranslation = Boolean(currentSubtitle.translatedText && currentSubtitle.translatedText.trim() && !isUntranslated);
    if (!hasValidTranslation && !isLiveVoiceDraft) {
      return null;
    }
  }

  // If in 'original' mode and original text is empty, do not render
  if (displayMode === 'original' && (!currentSubtitle.originalText || !currentSubtitle.originalText.trim())) {
    return null;
  }

  // Determine vertical positioning classes based on position prop & fullscreen state
  let verticalPosClass = '';
  if (position === 'top') {
    verticalPosClass = isFullscreen ? 'top-16 sm:top-20' : 'top-8 sm:top-10';
  } else if (position === 'middle') {
    verticalPosClass = 'top-1/2 -translate-y-1/2';
  } else {
    // 'bottom' default
    verticalPosClass = isFullscreen ? 'bottom-16 sm:bottom-20' : 'bottom-12 sm:bottom-14';
  }

  // Determine font size classes
  const sizeClasses = {
    sm: {
      translated: 'text-sm sm:text-base leading-snug',
      original: 'text-[11px] sm:text-xs',
      padding: 'px-3.5 py-1.5 sm:px-4 sm:py-2',
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

  const hasTranslation = Boolean(
    currentSubtitle.translatedText && currentSubtitle.translatedText.trim() && !isUntranslated
  );
  const hasOriginal = Boolean(currentSubtitle.originalText && currentSubtitle.originalText.trim());

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-25 text-center pointer-events-none transition-all duration-200 ease-out w-full max-w-[95%] sm:max-w-[85%] md:max-w-[75%] ${verticalPosClass}`}
    >
      <div
        className={`inline-block ${sizeClasses.padding} rounded-2xl bg-black/85 backdrop-blur-md border border-white/15 shadow-[0_10px_35px_rgba(0,0,0,0.95)] text-center transition-all animate-fadeIn`}
      >
        {/* Real-time Voice Recognition Interim Draft (Active audio listening) */}
        {isLiveVoiceDraft && !hasTranslation && (
          <div className="flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping flex-shrink-0" />
            <p
              className={`${sizeClasses.translated} text-[#FCD34D] font-extrabold tracking-wide flex items-center gap-1.5`}
              style={{
                WebkitTextStroke: '1px rgba(0, 0, 0, 0.95)',
                textShadow:
                  '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,1), 1px 0 2px rgba(0,0,0,1), -1px 0 2px rgba(0,0,0,1)',
              }}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400 inline" />
              <span>{currentSubtitle.originalText}</span>
            </p>
          </div>
        )}

        {/* Dual Mode: Show Translated Text (Top) + Original Text (Bottom) */}
        {!isLiveVoiceDraft && displayMode === 'dual' && (
          <div className="space-y-1">
            {/* Translated Text in vibrant Amber/Gold with high-contrast text stroke */}
            {hasTranslation ? (
              <p
                className={`${sizeClasses.translated} text-[#FCD34D] font-extrabold tracking-wide`}
                style={{
                  WebkitTextStroke: '1px rgba(0, 0, 0, 0.95)',
                  textShadow:
                    '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,1), 1px 0 2px rgba(0,0,0,1), -1px 0 2px rgba(0,0,0,1)',
                }}
              >
                {currentSubtitle.translatedText}
              </p>
            ) : (
              <p
                className={`${sizeClasses.translated} text-[#FCD34D] font-extrabold tracking-wide`}
                style={{
                  WebkitTextStroke: '1px rgba(0, 0, 0, 0.95)',
                  textShadow:
                    '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,1), 1px 0 2px rgba(0,0,0,1), -1px 0 2px rgba(0,0,0,1)',
                }}
              >
                {currentSubtitle.originalText}
              </p>
            )}

            {/* Original Text in soft italic neutral with crisp outline */}
            {hasOriginal && hasTranslation && !isSameTargetLang && (
              <p
                className={`${sizeClasses.original} text-neutral-200/95 font-medium italic tracking-normal`}
                style={{
                  WebkitTextStroke: '0.6px rgba(0, 0, 0, 0.9)',
                  textShadow: '0 1px 3px rgba(0,0,0,1), 0 0 6px rgba(0,0,0,0.85)',
                }}
              >
                {currentSubtitle.originalText}
              </p>
            )}
          </div>
        )}

        {/* Translated Only Mode: 100% Pure Translated Subtitle Only */}
        {!isLiveVoiceDraft && displayMode === 'translated' && hasTranslation && (
          <p
            className={`${sizeClasses.translated} text-[#FCD34D] font-extrabold tracking-wide`}
            style={{
              WebkitTextStroke: '1.2px rgba(0, 0, 0, 0.95)',
              textShadow:
                '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,1), 1px 0 2px rgba(0,0,0,1), -1px 0 2px rgba(0,0,0,1)',
            }}
          >
            {currentSubtitle.translatedText}
          </p>
        )}

        {/* Original Only Mode: 100% Pure Original Subtitle Only */}
        {!isLiveVoiceDraft && displayMode === 'original' && hasOriginal && (
          <p
            className={`${sizeClasses.translated} text-white font-extrabold tracking-wide`}
            style={{
              WebkitTextStroke: '1.2px rgba(0, 0, 0, 0.95)',
              textShadow:
                '0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.95), 0 -1px 2px rgba(0,0,0,1), 1px 0 2px rgba(0,0,0,1), -1px 0 2px rgba(0,0,0,1)',
            }}
          >
            {currentSubtitle.originalText}
          </p>
        )}
      </div>
    </div>
  );
};
