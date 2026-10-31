import React, { useState, useEffect, useCallback } from 'react';
import {
  Mic,
  MicOff,
  X,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  HelpCircle,
  Volume2,
} from 'lucide-react';

interface MicrophonePermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionGranted?: () => void;
  onTriggerTestSample?: () => void;
}

export const MicrophonePermissionModal: React.FC<MicrophonePermissionModalProps> = ({
  isOpen,
  onClose,
  onPermissionGranted,
  onTriggerTestSample,
}) => {
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isIframe, setIsIframe] = useState<boolean>(false);

  // Check if running inside an iframe
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        setIsIframe(window.self !== window.top);
      } catch {
        setIsIframe(true);
      }
    }
  }, []);

  // Check current browser permission state
  const checkCurrentPermission = useCallback(async () => {
    if (typeof navigator === 'undefined') return;

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as any });
        setPermissionState(status.state as any);

        status.onchange = () => {
          setPermissionState(status.state as any);
          if (status.state === 'granted') {
            setErrorMessage(null);
            onPermissionGranted?.();
          }
        };
      } catch {
        setPermissionState('unknown');
      }
    }
  }, [onPermissionGranted]);

  useEffect(() => {
    if (isOpen) {
      checkCurrentPermission();
      setErrorMessage(null);
    }
  }, [isOpen, checkCurrentPermission]);

  // Explicitly call getUserMedia upon user button click
  const handleRequestPermission = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setErrorMessage('Trình duyệt này không hỗ trợ API thu âm MediaDevices.');
      return;
    }

    setIsRequesting(true);
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop stream tracks immediately so it releases microphone hardware
      stream.getTracks().forEach((track) => track.stop());

      setPermissionState('granted');
      setIsRequesting(false);
      onPermissionGranted?.();
    } catch (err: any) {
      console.warn('[MicrophonePermissionModal] getUserMedia error:', err);
      setIsRequesting(false);

      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setErrorMessage(
          'Trình duyệt đang chặn Micro hoặc người dùng đã từ chối. Trình duyệt bảo mật sẽ không tự động hiện lại hộp thoại cho đến khi bạn mở khóa tại thanh địa chỉ.'
        );
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        setErrorMessage('Không tìm thấy thiết bị thu âm Micro nào kết nối với máy tính/điện thoại của bạn.');
      } else if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setErrorMessage('Thiết bị Micro đang bị ứng dụng khác chiếm dụng (Zoom, Teams, Zalo, v.v.).');
      } else if (err?.name === 'SecurityError') {
        setErrorMessage('Môi trường iframe bảo mật hạn chế quyền truy cập Micro. Vui lòng mở trên Tab mới.');
      } else {
        setErrorMessage(`Lỗi cấp quyền: ${err?.message || 'Không thể truy cập Micro'}`);
      }
    }
  };

  const handleOpenInNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-900/60">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm ${
                permissionState === 'granted'
                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-400'
                  : 'bg-rose-950/80 border-rose-500/50 text-rose-400'
              }`}
            >
              {permissionState === 'granted' ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">Cấp Quyền Truy Cập Micro</h3>
              <p className="text-[10.5px] text-neutral-400">Cho phép AI nghe trực tiếp âm thanh từ kênh phát</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 space-y-3.5 overflow-y-auto max-h-[75vh]">
          {/* Status Alert Banner */}
          {permissionState === 'granted' ? (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-emerald-300">Đã cấp quyền Micro thành công!</div>
                <div className="text-[11px] text-emerald-200/90 mt-0.5 leading-relaxed">
                  Thiết bị thu âm đã sẵn sàng. AI có thể bóc băng lời thoại kênh theo thời gian thực.
                </div>
              </div>
            </div>
          ) : permissionState === 'denied' || errorMessage ? (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-300">
                  {permissionState === 'denied' ? 'Trình duyệt đang CHẶN Micro' : 'Chưa thể truy cập Micro'}
                </div>
                <div className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">
                  {errorMessage ||
                    'Trình duyệt đã lưu thiết lập Chặn Micro từ trước. Khi ở trạng thái Chặn, trình duyệt sẽ không tự động hiện lại hộp thoại hỏi quyền.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">Cần xác nhận Cho phép (Allow)</div>
                <div className="text-[11px] text-amber-200/90 mt-0.5 leading-relaxed">
                  Nhấn nút bên dưới để trình duyệt mở hộp thoại xin quyền thu âm Micro.
                </div>
              </div>
            </div>
          )}

          {/* Step by step guide to unblock if denied */}
          {permissionState === 'denied' && (
            <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Cách mở khóa Micro trên thanh địa chỉ URL:</span>
              </div>
              <ol className="text-[11px] text-neutral-300 space-y-1.5 pl-4 list-decimal leading-relaxed">
                <li>
                  Nhấp vào biểu tượng <strong>Ổ khóa 🔒</strong> (hoặc biểu tượng Tune / Cài đặt) ở góc bên trái thanh địa chỉ URL trình duyệt.
                </li>
                <li>
                  Tìm mục <strong>Microphone (Micro)</strong> và gạt sang <strong>Cho phép (Allow / Bật)</strong>.
                </li>
                <li>
                  Nhấn nút <strong>[🔄 Thử lại sau khi đã mở khóa]</strong> bên dưới.
                </li>
              </ol>
            </div>
          )}

          {/* Iframe tip */}
          {isIframe && (
            <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-center justify-between gap-2 text-xs">
              <div className="text-[10.5px] text-sky-200 leading-tight">
                💡 Đang xem trong khung iframe AI Studio. Mở trên Tab mới để được cấp quyền Micro trực tiếp 100%.
              </div>
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 transition cursor-pointer active:scale-95 shadow-sm"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Mở Tab mới</span>
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-2 pt-1">
            {permissionState === 'granted' ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Bắt đầu Bóc băng tiếng nói (Voice AI)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRequestPermission}
                disabled={isRequesting}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/50 transition cursor-pointer active:scale-95 flex items-center justify-center gap-2"
              >
                <Mic className="w-4 h-4 animate-pulse" />
                <span>{isRequesting ? 'Đang gửi yêu cầu tới trình duyệt...' : 'Bấm để yêu cầu quyền Micro ngay'}</span>
              </button>
            )}

            {permissionState === 'denied' && (
              <button
                type="button"
                onClick={checkCurrentPermission}
                className="w-full py-2 px-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/80 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Tôi đã bấm Cho phép, kiểm tra lại</span>
              </button>
            )}

            {/* Test Sample fallback */}
            {onTriggerTestSample && (
              <button
                type="button"
                onClick={() => {
                  onTriggerTestSample();
                  onClose();
                }}
                className="w-full py-2 px-3 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                title="Mô phỏng bóc băng và dịch thuật không cần micro"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Thử mẫu nhận diện thoại (Không cần Micro)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-neutral-900/90 border-t border-neutral-800/80 flex items-center justify-between text-[10.5px] text-neutral-400">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Mẹo: Đeo tai nghe để AI nhận diện rõ nhất</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:text-white transition font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
