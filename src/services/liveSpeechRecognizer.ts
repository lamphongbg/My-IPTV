/**
 * Live Speech Recognition Engine (Phase 3 - Audio Speech-to-Text)
 * Uses Web Speech API (webkitSpeechRecognition) to capture speech directly
 * for channels that lack CEA-608 / WebVTT closed captions.
 */

export type LiveSpeechStatus = 'unsupported' | 'idle' | 'listening' | 'speech-detected' | 'error';

export interface SpokenLanguageOption {
  code: string;
  label: string;
  flag: string;
}

export const SPOKEN_LANGUAGES: SpokenLanguageOption[] = [
  { code: 'en-US', label: 'Tiếng Anh (English)', flag: '🇺🇸' },
  { code: 'vi-VN', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'zh-CN', label: 'Tiếng Trung (Mandarin)', flag: '🇨🇳' },
  { code: 'ja-JP', label: 'Tiếng Nhật (Japanese)', flag: '🇯🇵' },
  { code: 'ko-KR', label: 'Tiếng Hàn (Korean)', flag: '🇰🇷' },
  { code: 'fr-FR', label: 'Tiếng Pháp (Français)', flag: '🇫🇷' },
  { code: 'es-ES', label: 'Tiếng Tây Ban Nha', flag: '🇪🇸' },
  { code: 'de-DE', label: 'Tiếng Đức (Deutsch)', flag: '🇩🇪' },
  { code: 'ru-RU', label: 'Tiếng Nga (Russian)', flag: '🇷🇺' },
];

export class LiveSpeechRecognizer {
  private recognition: any = null;
  private isRunning: boolean = false;
  private shouldRestart: boolean = false;
  private status: LiveSpeechStatus = 'idle';
  private sourceLang: string = 'en-US';
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStatusCallback: ((status: LiveSpeechStatus, message?: string) => void) | null = null;
  private silenceTimer: any = null;

  constructor() {
    this.initRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  private initRecognition() {
    if (!this.isSupported()) {
      this.status = 'unsupported';
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = this.sourceLang;

      this.recognition.onstart = () => {
        this.isRunning = true;
        this.status = 'listening';
        this.onStatusCallback?.('listening', 'Đang lắng nghe âm thanh hội thoại...');
      };

      this.recognition.onspeechstart = () => {
        this.status = 'speech-detected';
        this.onStatusCallback?.('speech-detected', 'Phát hiện giọng nói...');
      };

      this.recognition.onspeechend = () => {
        if (this.isRunning) {
          this.status = 'listening';
          this.onStatusCallback?.('listening', 'Đang nghe...');
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const transcript = item[0]?.transcript || '';
          if (item.isFinal) {
            finalText += transcript;
          } else {
            interimText += transcript;
          }
        }

        const trimmedFinal = finalText.trim();
        const trimmedInterim = interimText.trim();

        if (trimmedFinal) {
          this.onTranscriptCallback?.(trimmedFinal, true);
        } else if (trimmedInterim) {
          this.onTranscriptCallback?.(trimmedInterim, false);
        }
      };

      this.recognition.onerror = (event: any) => {
        const error = event.error;
        console.warn('[LiveSpeechRecognizer] Speech recognition event:', error);

        if (error === 'no-speech') {
          // Normal background silence, continue listening
          return;
        }

        if (error === 'not-allowed') {
          this.status = 'error';
          this.isRunning = false;
          this.shouldRestart = false;
          this.onStatusCallback?.('error', 'Chưa cấp quyền truy cập Micro / Âm thanh trên trình duyệt.');
          return;
        }

        if (error === 'network') {
          this.onStatusCallback?.('listening', 'Đang kết nối lại mạng nhận dạng...');
          return;
        }

        this.onStatusCallback?.('listening', `Lắng nghe: ${error}`);
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        // Automatic reconnection for continuous live broadcast monitoring
        if (this.shouldRestart) {
          setTimeout(() => {
            if (this.shouldRestart && !this.isRunning) {
              try {
                this.recognition?.start();
              } catch (err) {
                console.warn('[LiveSpeechRecognizer] Restart error:', err);
              }
            }
          }, 350);
        } else {
          this.status = 'idle';
          this.onStatusCallback?.('idle', 'Đã dừng nhận dạng âm thanh.');
        }
      };
    } catch (err) {
      console.warn('[LiveSpeechRecognizer] Initialization error:', err);
      this.status = 'unsupported';
    }
  }

  public setLanguage(lang: string) {
    this.sourceLang = lang;
    if (this.recognition) {
      const wasRunning = this.isRunning;
      this.stop();
      this.recognition.lang = lang;
      if (wasRunning) {
        setTimeout(() => this.start(), 200);
      }
    }
  }

  public getLanguage(): string {
    return this.sourceLang;
  }

  public getStatus(): LiveSpeechStatus {
    return this.status;
  }

  public setCallbacks(
    onTranscript: (text: string, isFinal: boolean) => void,
    onStatus: (status: LiveSpeechStatus, message?: string) => void
  ) {
    this.onTranscriptCallback = onTranscript;
    this.onStatusCallback = onStatus;
  }

  public start() {
    if (!this.isSupported()) {
      this.onStatusCallback?.('unsupported', 'Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    if (this.isRunning) return;

    this.shouldRestart = true;
    try {
      if (this.recognition) {
        this.recognition.lang = this.sourceLang;
        this.recognition.start();
      }
    } catch (err: any) {
      // If already started or aborting, handle gracefully
      if (err?.name !== 'InvalidStateError') {
        console.warn('[LiveSpeechRecognizer] Start error:', err);
      }
    }
  }

  public stop() {
    this.shouldRestart = false;
    this.isRunning = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (err) {
        console.warn('[LiveSpeechRecognizer] Stop error:', err);
      }
    }
    this.status = 'idle';
    this.onStatusCallback?.('idle', 'Đã tắt nhận dạng giọng nói.');
  }
}
