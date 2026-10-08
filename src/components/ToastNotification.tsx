import React from 'react';
import { Bell, CheckCircle2, AlertCircle, X, Sparkles, ExternalLink } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type?: 'reminder' | 'alert' | 'success' | 'info';
  channelId?: string;
  category?: string;
  onAction?: () => void;
  actionText?: string;
}

interface ToastNotificationProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0"
    >
      {toasts.map((toast) => {
        const isAlert = toast.type === 'alert';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-2xl backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3 ${
              isAlert
                ? 'bg-amber-950/95 border-amber-500/70 text-amber-100 shadow-amber-950/50'
                : isSuccess
                ? 'bg-emerald-950/95 border-emerald-500/70 text-emerald-100 shadow-emerald-950/50'
                : 'bg-neutral-900/95 border-neutral-700/80 text-neutral-100 shadow-neutral-950/70'
            }`}
          >
            {/* Icon */}
            <div
              className={`p-2 rounded-xl flex-shrink-0 ${
                isAlert
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isSuccess
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              }`}
            >
              {isAlert ? (
                <Bell className="w-5 h-5 animate-bounce fill-amber-400/30" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5 fill-current" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <span>{toast.title}</span>
                {isAlert && (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded text-[9px] uppercase tracking-wide font-extrabold">
                    Mới
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed break-words">
                {toast.message}
              </p>

              {/* Action Button if specified */}
              {toast.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    toast.onAction?.();
                    onDismiss(toast.id);
                  }}
                  className="mt-2 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-1"
                >
                  <span>{toast.actionText || 'Xem kênh ngay'}</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition flex-shrink-0 -mr-1 -mt-1"
              title="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
