export type SubtitleEngine = 'google' | 'gemini';
export type SubtitleDisplayMode = 'dual' | 'translated' | 'original';
export type SubtitleFontSize = 'sm' | 'md' | 'lg';
export type SubtitlePosition = 'bottom' | 'middle' | 'top';
export type SubtitleGenre = 'general' | 'movie' | 'news' | 'sports' | 'documentary' | 'entertainment';

export interface SubtitleGenreInfo {
  id: SubtitleGenre;
  name: string;
  icon: string;
  desc: string;
}

export const SUBTITLE_GENRES: SubtitleGenreInfo[] = [
  { id: 'general', name: 'Đa dụng / Tự động', icon: '🌐', desc: 'Dịch tự nhiên, súc tích, văn phong hiện đại' },
  { id: 'movie', name: 'Phim điện ảnh & Hành động', icon: '🎬', desc: 'Kịch tính, sắc sảo, lột tả cảm xúc & tiếng lóng phim ảnh' },
  { id: 'news', name: 'Thời sự & Quốc tế', icon: '📰', desc: 'Trang trọng, chính luận, chuẩn xác địa danh & thuật ngữ' },
  { id: 'sports', name: 'Thể thao & Bình luận', icon: '⚽', desc: 'Nhiệt huyết, nhịp độ nhanh, chuẩn thuật ngữ thi đấu' },
  { id: 'documentary', name: 'Khoa học & Phim tài liệu', icon: '🔬', desc: 'Học thuật sâu sắc, chuẩn danh từ khoa học & vũ trụ' },
  { id: 'entertainment', name: 'Giải trí & Hoạt hình', icon: '🎨', desc: 'Trẻ trung, hóm hỉnh, bắt trend đời sống' },
];

export interface SubtitleTrackInfo {
  id: number;
  name: string;
  lang: string;
  type?: string;
  default?: boolean;
}

export interface SubtitleCueItem {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang?: string;
  targetLang: string;
  engine: SubtitleEngine;
  sourceType?: 'stream-cc' | 'speech-recognition';
  genre?: SubtitleGenre;
  timestamp: number;
  active: boolean;
  isLoading: boolean;
  latencyMs?: number;
}

export interface TranscriptItem {
  id: string;
  timestamp: number;
  timeFormatted: string;
  originalText: string;
  translatedText: string;
  sourceLang?: string;
  targetLang: string;
  engine: SubtitleEngine;
  sourceType?: 'stream-cc' | 'speech-recognition';
  genre?: SubtitleGenre;
}

// Client-side in-memory translation cache (0ms for repeat subtitles)
const clientCache = new Map<string, string>();

/**
 * Clean cue text: strips WebVTT markup, voice tags, HTML tags, and extra spaces
 */
export function cleanCueText(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(/^>+\s*/g, '') // strip CEA-608 roll-up speaker change markers (>>, >>>)
    .replace(/<v[^>]*>/gi, '') // <v Voice>
    .replace(/<\/v>/gi, '')
    .replace(/<c[^>]*>/gi, '') // <c.color>
    .replace(/<\/c>/gi, '')
    .replace(/<b[^>]*>/gi, '') // <b>
    .replace(/<\/b>/gi, '')
    .replace(/<i[^>]*>/gi, '') // <i>
    .replace(/<\/i>/gi, '')
    .replace(/<u[^>]*>/gi, '') // <u>
    .replace(/<\/u>/gi, '')
    .replace(/<[^>]+>/g, '') // any remaining HTML tags
    .replace(/\{[^}]+\}/g, '') // {position/align tags}
    .replace(/-->/g, '') // cue timeline artifacts
    .replace(/\[(?:music|applause|cheering|laughter|laughter and applause|singing|instrumental)\]/gi, '') // sound effect tags
    .replace(/\r?\n/g, ' ') // join multiline cues with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Calculate dynamic comfortable reading duration (milliseconds)
 * Based on average human reading speed: ~15-20 characters/second + baseline
 */
export function calculateCueDurationMs(text: string): number {
  const len = text ? text.length : 0;
  // Baseline 3800ms for short phrases, up to 9500ms for long sentences
  return Math.max(3800, Math.min(9500, 2600 + len * 85));
}

/**
 * Smart Sentence Boundary Aggregator for CEA-608 & WebVTT live streaming
 * Eliminates fragmented word-by-word roll-up flickers
 */
export class SentenceAggregator {
  private buffer: string = '';
  private pendingTimer: any = null;

  constructor(
    private onSentenceReady: (sentence: string, isFinal: boolean) => void,
    private idleFlushMs: number = 1400
  ) {}

  public pushCue(rawText: string) {
    const isSpeakerChange = /^>+\s*/.test(rawText);
    const cleaned = cleanCueText(rawText);
    if (!cleaned) return;

    // If speaker change detected (>>), immediately flush previous buffer
    if (isSpeakerChange && this.buffer.trim()) {
      this.flush(true);
    }

    // Check if new cue is a progressive extension of buffer (typical for CEA-608 roll-up)
    const curBuffer = this.buffer.trim();
    if (curBuffer && cleaned.startsWith(curBuffer)) {
      this.buffer = cleaned;
    } else if (curBuffer && curBuffer.endsWith(cleaned)) {
      // Duplicate trailing segment, ignore
    } else {
      this.buffer = curBuffer ? `${curBuffer} ${cleaned}` : cleaned;
    }

    // Normalize multiple spaces
    this.buffer = this.buffer.replace(/\s+/g, ' ').trim();

    // Check if current buffer ends with a sentence terminator (. ? ! ...)
    const hasSentenceTerminator = /[.?!。！？](\s*["')\]}]*\s*)$/.test(this.buffer);
    const hasEnoughWords = this.buffer.split(' ').length >= 18;

    if (hasSentenceTerminator || hasEnoughWords) {
      this.flush(true);
      return;
    }

    // Emit in-progress draft immediately so user sees original text on screen
    this.onSentenceReady(this.buffer, false);

    // Schedule idle flush if speaker pauses
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
    }
    this.pendingTimer = setTimeout(() => {
      if (this.buffer.trim()) {
        this.flush(true);
      }
    }, this.idleFlushMs);
  }

  public flush(isFinal = true) {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    const toEmit = this.buffer.trim();
    this.buffer = '';
    if (toEmit) {
      this.onSentenceReady(toEmit, isFinal);
    }
  }

  public reset() {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.buffer = '';
  }
}

/**
 * Fast translation helper with client-side Google fallback and backend proxy fallback
 */
export async function translateSubtitleText(
  text: string,
  targetLang = 'vi',
  engine: SubtitleEngine = 'google',
  genre: SubtitleGenre = 'general'
): Promise<{ translatedText: string; latencyMs: number; detectedLang?: string; engine: SubtitleEngine }> {
  const startTime = performance.now();
  const cleaned = cleanCueText(text);

  if (!cleaned) {
    return { translatedText: '', latencyMs: 0, engine };
  }

  // 1. Check client memory cache
  const cacheKey = `${engine}:${targetLang}:${genre}:${cleaned.toLowerCase()}`;
  if (clientCache.has(cacheKey)) {
    return {
      translatedText: clientCache.get(cacheKey)!,
      latencyMs: Math.round(performance.now() - startTime),
      engine,
    };
  }

  // 2. Call backend /api/translate route (has multiple Google high-speed endpoints and Gemini failover)
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleaned,
        targetLang,
        engine,
        genre,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      const translated = (data.translatedText || '').trim();
      if (translated) {
        clientCache.set(cacheKey, translated);
        return {
          translatedText: translated,
          latencyMs: Math.round(performance.now() - startTime),
          detectedLang: data.detectedLang,
          engine,
        };
      }
    }
  } catch (err) {
    console.warn('[Subtitle Translator] Server translation error:', err);
  }

  // 3. Browser direct fallback if server failed
  if (engine === 'google') {
    try {
      const gUrl = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&q=${encodeURIComponent(cleaned)}`;
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(2000) });
      if (gRes.ok) {
        const data = await gRes.json();
        if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
          const translated = String(data[0][0]).trim();
          if (translated) {
            clientCache.set(cacheKey, translated);
            return {
              translatedText: translated,
              latencyMs: Math.round(performance.now() - startTime),
              detectedLang: data[0][1] || 'auto',
              engine: 'google',
            };
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback: If all translation attempts failed, return empty string so foreign text is NEVER leaked in 'Chỉ dịch' mode
  return {
    translatedText: '',
    latencyMs: Math.round(performance.now() - startTime),
    engine,
  };
}

// Sample broadcast cues for instant simulation & testing on any channel
export const SAMPLE_BROADCAST_CUES = [
  {
    lang: 'en',
    label: 'Tin tức quốc tế (English)',
    text: 'Breaking news: Live coverage of the international global summit starting in Geneva.',
  },
  {
    lang: 'en',
    label: 'Bình luận thể thao (English)',
    text: 'What an unbelievable strike from outside the penalty box! Absolute world-class goal!',
  },
  {
    lang: 'fr',
    label: 'Bản tin Pháp (Français)',
    text: "Bonjour et bienvenue à tous dans cette édition spéciale d'information en direct.",
  },
  {
    lang: 'zh',
    label: 'Thời sự Trung Quốc (中文)',
    text: '观众朋友们晚上好，欢迎收看正在为您现场直播的全球新闻联播。',
  },
  {
    lang: 'ja',
    label: 'Truyền hình Nhật Bản (日本語)',
    text: '今夜のニュースをお伝えします。各地で穏やかな晴天が続いています。',
  },
  {
    lang: 'ko',
    label: 'Đài Hàn Quốc (한국어)',
    text: '안녕하십니까, 오늘 밤 주요 뉴스를 생방송으로 전해드리겠습니다.',
  },
];
