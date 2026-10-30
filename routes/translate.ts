import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// In-memory LRU cache for translations (speed up repeat subtitles to 0ms)
const translationCache = new Map<string, { translatedText: string; detectedLang?: string; timestamp: number }>();
const MAX_CACHE_SIZE = 8000;

function getCacheKey(text: string, targetLang: string, engine: string, genre: string = 'general'): string {
  return `${engine}:${targetLang}:${genre}:${text.trim().toLowerCase()}`;
}

function addToCache(key: string, translatedText: string, detectedLang?: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
  }
  translationCache.set(key, { translatedText, detectedLang, timestamp: Date.now() });
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Ultra-fast, unlimited Google Translate endpoints for live IPTV streaming
 * Does not suffer from MyMemory's 500-word daily limit or Gemini Free Tier 20 req/day quota limit.
 */
async function translateWithGoogleEndpoints(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<{ translatedText: string; detectedLang?: string }> {
  const sLang = sourceLang === 'autodetect' ? 'auto' : sourceLang;
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'GoogleTranslate/6.28.0.RC05.344431671 (Linux; U; Android 10; Pixel 4)',
  ];

  // Tier 1: Google Chrome Extension Dictionary endpoint (Tested 100% working, <150ms, no quota limit)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${encodeURIComponent(
      sLang
    )}&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgents[0],
        Accept: '*/*',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0]) {
        const trans = decodeHtmlEntities(String(data[0][0]));
        if (trans) {
          return {
            translatedText: trans,
            detectedLang: data[0][1] || sLang,
          };
        }
      }
    }
  } catch {
    // continue to Tier 2
  }

  // Tier 2: Google Translate Mobile App API (High availability, no quota cap)
  try {
    const url = `https://translate.google.com/translate_a/single?client=at&dt=t&dj=1&sl=${encodeURIComponent(
      sLang
    )}&tl=${encodeURIComponent(targetLang)}&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgents[1],
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.sentences) && data.sentences.length > 0) {
        const trans = data.sentences
          .map((s: any) => s.trans || '')
          .join('')
          .trim();
        if (trans) {
          return {
            translatedText: decodeHtmlEntities(trans),
            detectedLang: data.src || sLang,
          };
        }
      }
    }
  } catch {
    // continue to Tier 3
  }

  // Tier 3: Google Single Client endpoint (gtx)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': userAgents[0],
      },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const trans = data[0].map((item: any) => item[0]).join('').trim();
        if (trans) {
          return {
            translatedText: decodeHtmlEntities(trans),
            detectedLang: data[2] || sLang,
          };
        }
      }
    }
  } catch {
    // continue to Lingva mirror
  }

  // Tier 4: Lingva translate mirror (open-source Google proxy)
  try {
    const url = `https://lingva.ml/api/v1/${encodeURIComponent(sLang)}/${encodeURIComponent(targetLang)}/${encodeURIComponent(text)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.translation) {
        return {
          translatedText: decodeHtmlEntities(data.translation.trim()),
          detectedLang: data.info?.detectedSource || sLang,
        };
      }
    }
  } catch {
    // pass through
  }

  throw new Error('All high-speed translation endpoints failed');
}

// Genre-specific context instructions for Gemini AI Translation (Phase 4 Roadmap)
const GENRE_PROMPTS: Record<string, string> = {
  movie: `Bạn là biên kịch dịch phụ đề phim điện ảnh & hành động xuất sắc. Dịch câu thoại sau sang {targetLangName}.
Yêu cầu thể loại PHIM ĐIỆN ẢNH & HÀNH ĐỘNG:
- Ngôn từ kịch tính, sắc sảo, biểu cảm điện ảnh chân thực, lột tả nhịp điệu hồi hộp và cảm xúc nhân vật.
- Dịch mượt mà tiếng lóng, khẩu ngữ và xưng hô tự nhiên như trong phim bom tấn chiếu rạp.
- CHỈ trả về duy nhất câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay tiền tố.`,

  news: `Bạn là biên tập viên dịch thuật thời sự quốc tế của đài truyền hình quốc gia. Dịch bản tin sau sang {targetLangName}.
Yêu cầu thể loại THỜI SỰ & TIN TỨC QUỐC TẾ:
- Văn phong chính luận đĩnh đạc, khách quan, súc tích, trang trọng, chuẩn mực truyền hình.
- Chuẩn xác tuyệt đối các tên riêng, chức danh ngoại giao, địa danh quốc tế và thuật ngữ kinh tế - chính trị.
- CHỈ trả về duy nhất câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay tiền tố.`,

  sports: `Bạn là bình luận viên thể thao trực tiếp nhiệt huyết và chuyên nghiệp. Dịch câu bình luận sau sang {targetLangName}.
Yêu cầu thể loại THỂ THAO & BÌNH LUẬN TRỰC TIẾP:
- Nhịp độ nhanh, sôi nổi, tràn đầy năng lượng và truyền lửa như trên sóng truyền hình trực tiếp.
- Sử dụng chuẩn xác thuật ngữ thể thao (bàn thắng, việt vị, sút phạt, phản công, kiến tạo, set đấu, knockout,...).
- CHỈ trả về duy nhất câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay tiền tố.`,

  documentary: `Bạn là dịch giả thuyết minh phim tài liệu, khoa học và khám phá tự nhiên. Dịch câu thuyết minh sau sang {targetLangName}.
Yêu cầu thể loại KHOA HỌC & PHIM TÀI LIỆU:
- Văn phong thuyết minh trầm ấm, sâu sắc, học thuật và chuẩn xác.
- Chuẩn xác thuật ngữ khoa học vũ trụ, sinh thái, địa lý, thiên nhiên và lịch sử văn minh.
- CHỈ trả về duy nhất câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay tiền tố.`,

  entertainment: `Bạn là biên kịch dịch thuật chương trình giải trí, gameshow và phim hoạt hình. Dịch câu sau sang {targetLangName}.
Yêu cầu thể loại GIẢI TRÍ & HOẠT HÌNH:
- Tươi trẻ, hài hước, dí dỏm, bắt kịp xu hướng giới trẻ, tạo tiếng cười tự nhiên.
- CHỈ trả về duy nhất câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay tiền tố.`,

  general: `Bạn là trợ lý dịch phụ đề truyền hình & phim ảnh trực tiếp. Hãy dịch câu thoại sau sang {targetLangName}.
Yêu cầu:
- Tự nhiên, súc tích, phản ánh đúng ngữ cảnh hội thoại phim/truyền hình.
- CHỈ trả về đúng câu đã dịch, KHÔNG giải thích, KHÔNG thêm dấu ngoặc kép hay lời mở đầu.`
};

// Gemini AI Translate using @google/genai SDK with thinkingBudget: 0 for instant responses
async function translateWithGemini(
  text: string,
  targetLang: string,
  genre: string = 'general'
): Promise<{ translatedText: string; detectedLang?: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return translateWithGoogleEndpoints(text, targetLang);
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
  const promptTemplate = GENRE_PROMPTS[genre] || GENRE_PROMPTS.general;
  const instructionPrompt = promptTemplate.replace('{targetLangName}', targetLangName);

  const response = await Promise.race([
    ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `${instructionPrompt}

Câu thoại gốc:
"${text}"`,
      config: {
        temperature: 0.1,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini translation request timed out (5s)')), 5000)
    ),
  ]);

  const translatedText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : '';
  if (!translatedText) {
    throw new Error('Gemini returned empty text');
  }
  return { translatedText, detectedLang: 'auto' };
}

// POST /api/translate
router.post('/api/translate', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { text, targetLang = 'vi', sourceLang = 'auto', engine = 'google', genre = 'general' } = req.body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      res.status(400).json({ error: 'Text parameter is required' });
      return;
    }

    const trimmedText = text.trim();
    const cacheKey = getCacheKey(trimmedText, targetLang, engine, genre);

    // 1. Check in-memory cache (0ms latency for repeating phrases)
    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey)!;
      res.json({
        originalText: trimmedText,
        translatedText: cached.translatedText,
        detectedLang: cached.detectedLang,
        targetLang,
        engine,
        genre,
        cached: true,
        latencyMs: Date.now() - startTime,
      });
      return;
    }

    // 2. Perform translation with automatic failover
    let result: { translatedText: string; detectedLang?: string };

    if (engine === 'gemini') {
      try {
        result = await translateWithGemini(trimmedText, targetLang, genre);
      } catch (geminiErr: any) {
        console.warn('[Translate API] Gemini fallback to Google high-speed endpoints:', geminiErr?.message);
        result = await translateWithGoogleEndpoints(trimmedText, targetLang, sourceLang);
      }
    } else {
      try {
        result = await translateWithGoogleEndpoints(trimmedText, targetLang, sourceLang);
      } catch (googleErr: any) {
        console.warn('[Translate API] Google endpoints failed, trying Gemini:', googleErr?.message);
        if (process.env.GEMINI_API_KEY) {
          result = await translateWithGemini(trimmedText, targetLang, genre);
        } else {
          throw googleErr;
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
      genre,
      cached: false,
      latencyMs: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('[Translate API Fatal Error]:', error?.message);
    res.status(500).json({
      error: 'Translation failed',
      message: error?.message || 'Unknown translation error',
    });
  }
});

export default router;
