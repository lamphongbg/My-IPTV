export type SubtitleEngine = 'google' | 'gemini';
export type SubtitleDisplayMode = 'dual' | 'translated' | 'original';
export type SubtitleFontSize = 'sm' | 'md' | 'lg';

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
  timestamp: number;
  active: boolean;
  isLoading: boolean;
  latencyMs?: number;
}

// Client-side in-memory translation cache (0ms for repeat subtitles)
const clientCache = new Map<string, string>();

/**
 * Clean cue text: strips WebVTT markup, voice tags, HTML tags, and extra spaces
 */
export function cleanCueText(rawText: string): string {
  if (!rawText) return '';
  return rawText
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
    .replace(/\r?\n/g, ' ') // join multiline cues with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Fast translation helper with client-side Google fallback and backend proxy fallback
 */
export async function translateSubtitleText(
  text: string,
  targetLang = 'vi',
  engine: SubtitleEngine = 'google'
): Promise<{ translatedText: string; latencyMs: number; detectedLang?: string; engine: SubtitleEngine }> {
  const startTime = performance.now();
  const cleaned = cleanCueText(text);

  if (!cleaned) {
    return { translatedText: '', latencyMs: 0, engine };
  }

  // 1. Check client memory cache
  const cacheKey = `${engine}:${targetLang}:${cleaned.toLowerCase()}`;
  if (clientCache.has(cacheKey)) {
    return {
      translatedText: clientCache.get(cacheKey)!,
      latencyMs: Math.round(performance.now() - startTime),
      engine,
    };
  }

  // 2. If engine is google, attempt client-side direct Google Translate first (super fast in user's browser)
  if (engine === 'google') {
    try {
      const gUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
        targetLang
      )}&dt=t&q=${encodeURIComponent(cleaned)}`;
      const gRes = await fetch(gUrl, { signal: AbortSignal.timeout(1800) });
      if (gRes.ok) {
        const data = await gRes.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translated = data[0].map((item: any) => item[0]).join('').trim();
          const detectedLang = data[2] || 'auto';
          clientCache.set(cacheKey, translated);
          return {
            translatedText: translated,
            latencyMs: Math.round(performance.now() - startTime),
            detectedLang,
            engine: 'google',
          };
        }
      }
    } catch {
      // Browser direct call blocked or failed, fall through to server /api/translate
    }
  }

  // 3. Call backend /api/translate route
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: cleaned,
        targetLang,
        engine,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      const translated = (data.translatedText || cleaned).trim();
      clientCache.set(cacheKey, translated);
      return {
        translatedText: translated,
        latencyMs: Math.round(performance.now() - startTime),
        detectedLang: data.detectedLang,
        engine,
      };
    }
  } catch (err) {
    console.warn('[Subtitle Translator] Server translation error:', err);
  }

  // Fallback: return original text if all translation channels failed
  return {
    translatedText: cleaned,
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
