/**
 * Live Speech Recognition Engine (Phase 3 - Audio Speech-to-Text & Subtitling)
 * Uses Web Speech API (webkitSpeechRecognition) and MediaDevices API
 * to capture and transcribe broadcast audio directly for channels without CC.
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
  private isStarting: boolean = false;
  private shouldRestart: boolean = false;
  private status: LiveSpeechStatus = 'idle';
  private sourceLang: string = 'en-US';
  private onTranscriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  private onStatusCallback: ((status: LiveSpeechStatus, message?: string) => void) | null = null;
  private restartTimer: any = null;
  private consecutiveAborts: number = 0;

  constructor(defaultLang = 'en-US') {
    this.sourceLang = defaultLang;
    this.initRecognition();
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Explicitly request browser microphone permission through user gesture
   */
  public async requestMicrophoneAccess(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return true;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop stream tracks so SpeechRecognition has dedicated input
      stream.getTracks().forEach((track) => track.stop());
      this.status = 'listening';
      this.shouldRestart = true;
      this.consecutiveAborts = 0;
      this.onStatusCallback?.('listening', 'Đã cấp quyền! Đang lắng nghe âm thanh kênh...');
      await this.start();
      return true;
    } catch (err: any) {
      console.warn('[LiveSpeechRecognizer] Microphone permission request:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        this.status = 'error';
        this.shouldRestart = false;
        this.onStatusCallback?.(
          'error',
          'Chưa cấp quyền Micro trên trình duyệt. Nhấn Ổ khóa 🔒 ở thanh URL > chọn "Cho phép Micro".'
        );
        return false;
      }
      return true;
    }
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
        this.isStarting = false;
        this.status = 'listening';
        this.consecutiveAborts = 0;
        this.onStatusCallback?.('listening', 'Đang lắng nghe âm thanh hội thoại...');
      };

      this.recognition.onspeechstart = () => {
        this.status = 'speech-detected';
        this.onStatusCallback?.('speech-detected', 'Đang phát hiện giọng nói...');
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
        console.warn('[LiveSpeechRecognizer] Speech event:', error);

        if (error === 'no-speech') {
          // Normal silence between sentences
          this.status = 'listening';
          this.onStatusCallback?.('listening', 'Đang lắng nghe âm thanh hội thoại...');
          return;
        }

        if (error === 'aborted') {
          // Chrome fires 'aborted' when restarting or switching audio context.
          // NEVER display raw "aborted" to user! Schedule a smooth auto-recovery.
          this.consecutiveAborts++;
          if (this.shouldRestart) {
            const delay = Math.min(1500, 300 * this.consecutiveAborts);
            this.scheduleRestart(delay);
          }
          return;
        }

        if (error === 'not-allowed') {
          this.status = 'error';
          this.isRunning = false;
          this.shouldRestart = false;
          this.onStatusCallback?.(
            'error',
            'Chưa cấp quyền Micro trên trình duyệt. Hãy nhấn ổ khóa ở thanh địa chỉ để Cho phép.'
          );
          return;
        }

        if (error === 'audio-capture') {
          this.status = 'error';
          this.isRunning = false;
          this.shouldRestart = false;
          this.onStatusCallback?.('error', 'Không tìm thấy thiết bị thu âm Micro hoặc thiết bị đang bận.');
          return;
        }

        if (error === 'network') {
          this.onStatusCallback?.('listening', 'Đang kết nối lại mạng nhận dạng...');
          this.scheduleRestart(800);
          return;
        }

        this.onStatusCallback?.('listening', 'Đang đồng bộ âm thanh...');
      };

      this.recognition.onend = () => {
        this.isRunning = false;
        this.isStarting = false;

        // Auto restart for continuous 24/7 broadcast listening
        if (this.shouldRestart) {
          this.scheduleRestart(350);
        } else if (this.status !== 'error') {
          this.status = 'idle';
          this.onStatusCallback?.('idle', 'Đã tắt nhận dạng giọng nói.');
        }
      };
    } catch (err) {
      console.warn('[LiveSpeechRecognizer] Initialization error:', err);
      this.status = 'unsupported';
    }
  }

  /**
   * Query browser permission state for microphone
   */
  public async checkPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
      return 'unsupported';
    }
    try {
      const result = await navigator.permissions.query({ name: 'microphone' as any });
      return result.state;
    } catch {
      return 'unsupported';
    }
  }

  private scheduleRestart(delayMs = 350) {
    if (!this.shouldRestart) return;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
    }

    this.restartTimer = setTimeout(() => {
      if (this.shouldRestart && !this.isRunning && !this.isStarting) {
        try {
          this.isStarting = true;
          this.recognition?.start();
        } catch (err: any) {
          this.isStarting = false;
          if (err?.name !== 'InvalidStateError') {
            console.warn('[LiveSpeechRecognizer] Restart error:', err);
          }
        }
      }
    }, delayMs);
  }

  public setLanguage(lang: string) {
    if (this.sourceLang === lang) return;
    this.sourceLang = lang;

    if (this.recognition) {
      const wasRunning = this.isRunning || this.shouldRestart;
      if (this.restartTimer) {
        clearTimeout(this.restartTimer);
      }

      this.shouldRestart = false;
      this.isRunning = false;
      this.isStarting = false;

      try {
        this.recognition.stop();
      } catch {}

      this.recognition.lang = lang;
      this.onStatusCallback?.('listening', 'Đang chuyển ngôn ngữ kênh...');

      if (wasRunning) {
        setTimeout(() => {
          this.shouldRestart = true;
          this.start();
        }, 300);
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

  public async start() {
    if (!this.isSupported()) {
      this.status = 'unsupported';
      this.onStatusCallback?.('unsupported', 'Trình duyệt không hỗ trợ Web Speech API.');
      return;
    }

    if (this.isRunning) return;

    this.shouldRestart = true;
    this.consecutiveAborts = 0;

    try {
      if (this.recognition) {
        this.isStarting = true;
        this.recognition.lang = this.sourceLang;
        this.recognition.start();
      }
    } catch (err: any) {
      this.isStarting = false;
      if (err?.name === 'InvalidStateError') {
        // Recognition is already active or in start transition
        this.isRunning = true;
      } else {
        console.warn('[LiveSpeechRecognizer] Direct start exception:', err);
        this.scheduleRestart(600);
      }
    }
  }

  public stop() {
    this.shouldRestart = false;
    this.isRunning = false;
    this.isStarting = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

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
