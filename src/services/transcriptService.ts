import { TranscriptItem } from './subtitleTranslator';

export interface TtsSettings {
  voiceURI: string;
  rate: number; // 0.6 - 2.0 (default 1.0)
  pitch: number; // 0.5 - 1.5 (default 1.0)
  volume: number; // 0.1 - 1.0 (default 1.0)
}

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

/**
 * Check if Web Speech Synthesis (TTS) is supported in current browser
 */
export function isTtsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Retrieve installed voices from browser SpeechSynthesis
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTtsSupported()) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

/**
 * Listen to asynchronous voices loading event (especially on Chrome and Android)
 */
export function onVoicesChanged(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (!isTtsSupported()) return () => {};

  const handleVoices = () => {
    callback(getAvailableVoices());
  };

  // Immediate callback
  handleVoices();

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = handleVoices;
  }

  return () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      if (window.speechSynthesis.onvoiceschanged === handleVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    }
  };
}

let activeUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Stop any ongoing TTS speech
 */
export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  activeUtterance = null;
}

/**
 * Read text aloud using browser SpeechSynthesis API with full voice, pitch, rate, and volume customization
 */
export function speakText(
  text: string,
  lang: string = 'vi-VN',
  config?: Partial<TtsSettings> | number,
  onEnd?: () => void
): boolean {
  if (!isTtsSupported() || !text || !text.trim()) {
    return false;
  }

  const settings: TtsSettings =
    typeof config === 'number'
      ? { ...DEFAULT_TTS_SETTINGS, rate: config }
      : { ...DEFAULT_TTS_SETTINGS, ...config };

  try {
    stopSpeaking();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = Math.max(0.6, Math.min(2.0, settings.rate));
    utterance.pitch = Math.max(0.5, Math.min(1.5, settings.pitch));
    utterance.volume = Math.max(0.1, Math.min(1.0, settings.volume));

    const voices = getAvailableVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    // 1. Prioritize explicit voiceURI match
    if (settings.voiceURI) {
      selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI || v.name === settings.voiceURI);
    }

    // 2. Fallback to matching target language prefix (e.g. vi-VN)
    if (!selectedVoice) {
      const langPrefix = lang.split('-')[0].toLowerCase();
      selectedVoice = voices.find(
        (v) =>
          v.lang.toLowerCase() === lang.toLowerCase() ||
          v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      activeUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled') {
        console.warn('[TTS] Speech synthesis error:', e);
      }
      activeUtterance = null;
      onEnd?.();
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[TTS] Failed to speak:', err);
    return false;
  }
}

/**
 * Format milliseconds into SRT timestamp format: HH:MM:SS,mmm
 */
function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);

  const pad = (n: number, z = 2) => n.toString().padStart(z, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/**
 * Convert transcript items to standard .SRT (SubRip) format
 */
export function exportToSrt(items: TranscriptItem[]): string {
  if (!items || items.length === 0) return '';

  // Sort chronologically (oldest first for video playback)
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
  const baseTime = sorted[0].timestamp;

  const srtBlocks = sorted.map((item, index) => {
    const startRelMs = Math.max(0, item.timestamp - baseTime);
    // Standard reading duration estimation: ~4 seconds baseline + text length
    const durationMs = Math.max(3000, Math.min(8000, 2000 + (item.translatedText || item.originalText).length * 80));
    const endRelMs = startRelMs + durationMs;

    const startTime = formatSrtTimestamp(startRelMs);
    const endTime = formatSrtTimestamp(endRelMs);

    const lines: string[] = [];
    if (item.translatedText) {
      lines.push(item.translatedText);
    }
    if (item.originalText && item.originalText !== item.translatedText) {
      lines.push(`(${item.originalText})`);
    }

    return `${index + 1}\n${startTime} --> ${endTime}\n${lines.join('\n')}\n`;
  });

  return srtBlocks.join('\n');
}

/**
 * Convert transcript items to human-readable .TXT transcript
 */
export function exportToTxt(items: TranscriptItem[], channelName?: string): string {
  const header = [
    '=====================================================================',
    `BẢN GHI NHẬT KÝ PHỤ ĐỀ TRUYỀN HÌNH (IPTV LIVE TRANSCRIPT)`,
    `Kênh phát sóng: ${channelName || 'IPTV Live Stream'}`,
    `Thời gian xuất file: ${new Date().toLocaleString('vi-VN')}`,
    `Tổng số câu thoại ghi nhận: ${items.length}`,
    '=====================================================================\n',
  ].join('\n');

  // Chronological order
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);

  const rows = sorted.map((item, index) => {
    const sourceLabel = item.sourceType === 'speech-recognition' ? '[Voice AI]' : '[HLS CC]';
    const translated = item.translatedText ? `=> [Dịch]: ${item.translatedText}` : '';
    const original = `[Gốc]: ${item.originalText}`;

    return `[#${index + 1}] [${item.timeFormatted}] ${sourceLabel}\n${original}\n${translated}\n`;
  });

  return `${header}\n${rows.join('\n')}`;
}

/**
 * Trigger browser file download
 */
export function triggerFileDownload(content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
