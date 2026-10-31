import { TranscriptItem } from './subtitleTranslator';

export const GOOGLE_FEMALE_VOICE_ID = 'google-female';

export interface TtsSettings {
  voiceURI: string;
  rate: number; // 0.6 - 2.0 (default 1.0)
  pitch: number; // 0.5 - 1.5 (default 1.0)
  volume: number; // 0.1 - 1.0 (default 1.0)
}

export const DEFAULT_TTS_SETTINGS: TtsSettings = {
  voiceURI: GOOGLE_FEMALE_VOICE_ID,
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
};

/**
 * Check if Web Speech Synthesis or HTML5 Audio TTS is supported
 */
export function isTtsSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Audio' in window || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
}

/**
 * Retrieve installed voices from browser SpeechSynthesis
 */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  try {
    return window.speechSynthesis.getVoices() || [];
  } catch {
    return [];
  }
}

/**
 * Check if a voice is female based on its name and metadata
 */
export function isVoiceFemale(voice: { name: string; voiceURI?: string }): boolean {
  const name = (voice.name || '').toLowerCase();
  const uri = (voice.voiceURI || '').toLowerCase();
  return (
    name.includes('female') ||
    name.includes('hoaimy') ||
    name.includes('hoài my') ||
    name.includes('linh') ||
    name.includes('mai') ||
    name.includes('lan') ||
    name.includes('chi') ||
    name.includes('huong') ||
    name.includes('hương') ||
    name.includes('thao') ||
    name.includes('thảo') ||
    name.includes('trang') ||
    name.includes('ngoc') ||
    name.includes('ngọc') ||
    name.includes('zira') ||
    name.includes('eva') ||
    name.includes('samantha') ||
    name.includes('victoria') ||
    uri.includes('female')
  );
}

/**
 * Listen to asynchronous voices loading event (especially on Chrome and Android)
 */
export function onVoicesChanged(callback: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return () => {};

  const handleVoices = () => {
    callback(getAvailableVoices());
  };

  handleVoices();

  window.speechSynthesis.onvoiceschanged = handleVoices;

  return () => {
    if (window.speechSynthesis && window.speechSynthesis.onvoiceschanged === handleVoices) {
      window.speechSynthesis.onvoiceschanged = null;
    }
  };
}

let activeAudio: HTMLAudioElement | null = null;
let activeUtterance: SpeechSynthesisUtterance | null = null;
let lastSpeakingEndTime: number = 0;

/**
 * Check if TTS is currently producing audio or within the reverberation echo buffer.
 * Used for Acoustic Echo Suppression to prevent microphone Voice AI feedback loop.
 */
export function isCurrentlySpeaking(): boolean {
  if (activeAudio && !activeAudio.paused && !activeAudio.ended) {
    return true;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
    return true;
  }
  // Acoustic reverb buffer (650ms) to ensure mic doesn't capture speaker echo
  if (Date.now() - lastSpeakingEndTime < 650) {
    return true;
  }
  return false;
}

/**
 * Stop any ongoing TTS speech (both HTML5 audio and browser synthesis)
 */
export function stopSpeaking(): void {
  lastSpeakingEndTime = Date.now();
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {}
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  activeUtterance = null;
}

/**
 * Browser utterance speech synthesis helper
 */
function speakWithBrowserSpeech(
  text: string,
  lang: string,
  settings: TtsSettings,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;

  try {
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = Math.max(0.6, Math.min(2.0, settings.rate));
    utterance.pitch = Math.max(0.5, Math.min(1.5, settings.pitch));
    utterance.volume = Math.max(0.1, Math.min(1.0, settings.volume));

    const voices = getAvailableVoices();
    let selectedVoice: SpeechSynthesisVoice | undefined;

    // 1. Explicit voiceURI match
    if (settings.voiceURI && settings.voiceURI !== GOOGLE_FEMALE_VOICE_ID) {
      selectedVoice = voices.find((v) => v.voiceURI === settings.voiceURI || v.name === settings.voiceURI);
    }

    // 2. Prioritize female voice if available for target language
    if (!selectedVoice) {
      const langPrefix = lang.split('-')[0].toLowerCase();
      const matchingVoices = voices.filter(
        (v) =>
          v.lang.toLowerCase() === lang.toLowerCase() ||
          v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
      selectedVoice = matchingVoices.find((v) => isVoiceFemale(v)) || matchingVoices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      lastSpeakingEndTime = Date.now();
      activeUtterance = null;
      onEnd?.();
    };

    utterance.onerror = (e) => {
      lastSpeakingEndTime = Date.now();
      if (e.error !== 'canceled') {
        console.warn('[TTS] Browser speech synthesis error:', e);
      }
      activeUtterance = null;
      onEnd?.();
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('[TTS] Failed to speak with browser:', err);
    return false;
  }
}

/**
 * Read text aloud using Natural Female Voice API (Google) or browser SpeechSynthesis API
 */
export function speakText(
  text: string,
  lang: string = 'vi-VN',
  config?: Partial<TtsSettings> | number,
  onEnd?: () => void
): boolean {
  if (!text || !text.trim()) {
    return false;
  }

  const settings: TtsSettings =
    typeof config === 'number'
      ? { ...DEFAULT_TTS_SETTINGS, rate: config }
      : { ...DEFAULT_TTS_SETTINGS, ...config };

  stopSpeaking();

  // 1. If 'google-female' (Vietnamese Female Voice) is requested:
  if (settings.voiceURI === GOOGLE_FEMALE_VOICE_ID || (!settings.voiceURI && lang.startsWith('vi'))) {
    try {
      const cleanSnippet = text.trim().slice(0, 250);
      const langCode = lang.startsWith('vi') ? 'vi' : lang.split('-')[0];
      const audioUrl = `/api/tts?lang=${encodeURIComponent(langCode)}&text=${encodeURIComponent(cleanSnippet)}`;
      const audio = new Audio(audioUrl);
      audio.playbackRate = Math.max(0.7, Math.min(1.8, settings.rate || 1.0));
      audio.volume = Math.max(0.1, Math.min(1.0, settings.volume || 1.0));

      audio.onended = () => {
        lastSpeakingEndTime = Date.now();
        activeAudio = null;
        onEnd?.();
      };

      audio.onerror = () => {
        lastSpeakingEndTime = Date.now();
        activeAudio = null;
        // Fallback to browser synthesis if network fails
        speakWithBrowserSpeech(text, lang, settings, onEnd);
      };

      activeAudio = audio;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[TTS] Natural female audio playback failed, falling back to browser speech:', err);
          speakWithBrowserSpeech(text, lang, settings, onEnd);
        });
      }
      return true;
    } catch (err) {
      console.warn('[TTS] Audio initialization error, falling back to browser speech:', err);
      return speakWithBrowserSpeech(text, lang, settings, onEnd);
    }
  }

  // 2. Browser speech synthesis
  return speakWithBrowserSpeech(text, lang, settings, onEnd);
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
 * Export array of TranscriptItem to standard .SRT subtitle format
 */
export function exportToSrt(items: TranscriptItem[]): string {
  if (!items || items.length === 0) return '';

  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
  const firstTimestamp = sorted[0].timestamp;

  const srtBlocks = sorted.map((item, index) => {
    const srtIndex = index + 1;
    const startOffsetMs = Math.max(0, item.timestamp - firstTimestamp);
    const durationMs = Math.min(6000, Math.max(2200, item.translatedText.length * 80));
    const endOffsetMs = startOffsetMs + durationMs;

    const startSrt = formatSrtTimestamp(startOffsetMs);
    const endSrt = formatSrtTimestamp(endOffsetMs);

    const textToInclude = item.translatedText
      ? item.sourceType === 'stream-cc' && item.originalText !== item.translatedText
        ? `${item.translatedText}\n${item.originalText}`
        : item.translatedText
      : item.originalText;

    return `${srtIndex}\n${startSrt} --> ${endSrt}\n${textToInclude}\n`;
  });

  return srtBlocks.join('\n');
}

/**
 * Export array of TranscriptItem to clean, readable .TXT format
 */
export function exportToTxt(items: TranscriptItem[], channelName?: string): string {
  if (!items || items.length === 0) return '';

  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
  const header = `=== NHẬT KÝ HỘI THOẠI & PHỤ ĐỀ IPTV ===\n` +
    `Kênh: ${channelName || 'IPTV Stream'}\n` +
    `Thời gian xuất: ${new Date().toLocaleString('vi-VN')}\n` +
    `Tổng số câu thoại: ${sorted.length}\n` +
    `----------------------------------------\n\n`;

  const lines = sorted.map((item, idx) => {
    const time = item.timeFormatted || new Date(item.timestamp).toLocaleTimeString('vi-VN');
    const sourceTag = item.sourceType === 'speech-recognition' ? '[Voice AI]' : '[HLS CC]';
    if (item.translatedText && item.translatedText !== item.originalText) {
      return `[${idx + 1}] (${time}) ${sourceTag} ${item.translatedText} (Gốc: ${item.originalText})`;
    }
    return `[${idx + 1}] (${time}) ${sourceTag} ${item.translatedText || item.originalText}`;
  });

  return header + lines.join('\n\n');
}

/**
 * Trigger browser file download with blob
 */
export function triggerFileDownload(content: string, filename: string, mimeType = 'text/plain;charset=utf-8'): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
