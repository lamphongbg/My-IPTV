import React from 'react';
import { X, ExternalLink, Smartphone } from 'lucide-react';

interface NokiaSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NokiaSimulatorModal: React.FC<NokiaSimulatorModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl flex flex-col items-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-2 mb-3 text-amber-400">
          <Smartphone className="w-5 h-5" />
          <h3 className="text-base font-bold tracking-wide uppercase">Mô Phỏng Trình Duyệt Nokia E72</h3>
        </div>
        <p className="text-xs text-neutral-400 text-center mb-4 max-w-xs">
          Màn hình QVGA 320x240 px, giao diện siêu nhẹ, chuẩn Symbian S60 không JavaScript &amp; kết nối trực tiếp CorePlayer.
        </p>

        {/* Nokia E72 Phone Mockup Bezel */}
        <div className="w-[320px] bg-neutral-950 p-3 rounded-2xl border-4 border-neutral-700 shadow-2xl flex flex-col items-center">
          {/* Earpiece / Nokia Brand */}
          <div className="w-full flex items-center justify-between px-2 mb-2">
            <span className="text-[10px] font-bold tracking-widest text-neutral-400">NOKIA</span>
            <div className="w-10 h-1 bg-neutral-700 rounded-full" />
            <span className="text-[10px] font-bold text-amber-500">E72</span>
          </div>

          {/* 320x240 QVGA Screen Container */}
          <div className="w-[290px] h-[220px] bg-[#1a1a1a] rounded border-2 border-neutral-800 overflow-hidden shadow-inner relative">
            <iframe
              src="/legacy"
              title="Nokia E72 Browser"
              className="w-full h-full border-0 select-none"
            />
          </div>

          {/* Navigation D-Pad & Keypad Mockup */}
          <div className="mt-3 w-full flex flex-col items-center">
            {/* D-Pad Center */}
            <div className="w-16 h-12 bg-neutral-800 rounded-lg border border-neutral-600 flex items-center justify-center shadow">
              <div className="w-7 h-5 bg-neutral-900 rounded border border-neutral-500 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-400/80" />
              </div>
            </div>

            {/* Qwerty Grid Mockup */}
            <div className="mt-2 grid grid-cols-5 gap-1 w-full px-2">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="h-2.5 bg-neutral-800 rounded-sm border border-neutral-700/60" />
              ))}
            </div>
          </div>
        </div>

        {/* Action Links */}
        <div className="mt-5 flex items-center gap-3 w-full justify-center">
          <a
            href="/legacy"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mở Toàn Màn Hình (/legacy)
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl text-xs font-medium transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
