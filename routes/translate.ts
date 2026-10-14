import { Router, Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const router = Router();

// In-memory LRU cache for translations (speed up repeat subtitles to 0ms)
const translationCache = new Map<string, { translatedText: string; detectedLang?: string; timestamp: number }>();
const MAX_CACHE_SIZE = 5000;

function getCacheKey(text: string, targetLang: string, engine: string): string {
  return `${engine}:${targetLang}:${text.trim().toLowerCase()}`;
}

function addToCache(key: string, translatedText: string, detectedLang?: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(key, { translatedText, detectedLang, timestamp: Date.now() });
}

// Fast public translation service (MyMemory)
async function translateWithFastAPI(text: string, targetLang: string, sourceLang = 'autodetect'): Promise<{ translatedText: string; detectedLang?: string }> {
  const pair = `${sourceLang === 'auto' ? 'autodetect' : sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(pair)}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
    signal: AbortSignal.timeout(3500),
  });

  if (!res.ok) {
    throw new Error(`Translation API error: ${res.status}`);
  }

  const json = await res.json();
  const translated = json?.responseData?.translatedText;
  if (translated && typeof translated === 'string') {
    // If MyMemory returns upper case error message, handle it
    if (translated.startsWith('MYMEMORY WARNING:') || translated.startsWith('PLEASE SELECT')) {
      throw new Error(translated);
    }
    return {
      translatedText: translated.trim(),
      detectedLang: json?.matches?.[0]?.['source-language'] || sourceLang,
    };
  }

  throw new Error('No translated text returned from fast translation service');
}

// Gemini AI Translate using @google/genai SDK
async function translateWithGemini(text: string, targetLang: string): Promise<{ translatedText: string; detectedLang?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return translateWithFastAPI(text, targetLang);
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const languageNames: Record<string, string> = {
    vi: 'Tiếng Việt',
    en: 'English',
    fr: 'Tiếng Pháp',
    zh: 'Tiếng Trung',
    ja: 'Tiếng Nhật',
    ko: 'Tiếng Hàn',
    de: 'Tiếng Đức',
    es: 'Tiếng Tây Ban Nha',
    ru: 'Tiếng Nga',
  };

  const targetLangName = languageNames[targetLang] || targetLang;

  const response = await Promise.race([
    ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Bạn là trợ lý dịch phụ đề truyền hình & phim ảnh trực tiếp. Hãy dịch câu thoại sau sang ${targetLangName}.
Yêu cầu:
- Tự nhiên, súc tích, phản ánh đúng ngữ cảnh hội thoại phim/truyền hình.
- CHỈ trả về đúng câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay lời mở đầu.

Câu thoại gốc:
"${text}"`,
      config: {
        temperature: 0.2,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini translation request timed out (3.5s)')), 3500)
    ),
  ]);

  const translatedText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : text;
  return { translatedText, detectedLang: 'auto' };
}

// POST /api/translate
router.post('/api/translate', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { text, targetLang = 'vi', sourceLang = 'auto', engine = 'google' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text parameter is required' });
      return;
    }

    const trimmedText = text.trim();
    const cacheKey = getCacheKey(trimmedText, targetLang, engine);

    // 1. Check in-memory cache
    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey)!;
      res.json({
        originalText: trimmedText,
        translatedText: cached.translatedText,
        detectedLang: cached.detectedLang,
        targetLang,
        engine,
        cached: true,
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    // 2. Perform translation
    let result: { translatedText: string; detectedLang?: string };

    if (engine === 'gemini') {
      try {
        result = await translateWithGemini(trimmedText, targetLang);
      } catch (geminiErr: any) {
        console.warn('[Translate API] Gemini error, fallback to fast API:', geminiErr?.message);
        result = await translateWithFastAPI(trimmedText, targetLang, sourceLang);
      }
    } else {
      try {
        result = await translateWithFastAPI(trimmedText, targetLang, sourceLang);
      } catch (apiErr: any) {
        // Fallback to Gemini if fast API failed
        if (process.env.GEMINI_API_KEY) {
          result = await translateWithGemini(trimmedText, targetLang);
        } else {
          throw apiErr;
        }
      }
    }

    // Save to cache
    addToCache(cacheKey, result.translatedText, result.detectedLang);

    res.json({
      originalText: trimmedText,
      translatedText: result.translatedText,
      detectedLang: result.detectedLang,
      targetLang,
      engine,
      cached: false,
      latencyMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('[Translate API Error]:', error?.message);
    res.status(500).json({
      error: 'Translation failed',
      message: error?.message || 'Unknown translation error',
    });
  }
});

export default router;
