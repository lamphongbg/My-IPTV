import React from 'react';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { Play, Star, Info, Smartphone, Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onPlay?: (channel: Channel, e: React.MouseEvent) => void;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  onOpenDetails: (channel: Channel, e: React.MouseEvent) => void;
  onScanChannel?: (channelId: string, e: React.MouseEvent) => void;
  isScanning?: boolean;
  isNokiaLightweight?: boolean;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isFavorite,
  onSelect,
  onPlay,
  onToggleFavorite,
  onOpenDetails,
  onScanChannel,
  isScanning = false,
  isNokiaLightweight,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  const isOffline = channel.status === 'offline';

  return (
    <div
      id={`channel-card-${channel.id}`}
      onClick={() => onSelect(channel)}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
        isActive
          ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
          : isOffline
          ? 'bg-rose-950/15 hover:bg-rose-950/25 border-rose-900/50 hover:border-rose-800'
          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Logo / Thumbnail with status indicator */}
        <div className="relative w-12 h-12 bg-neutral-950 rounded-lg p-1 border border-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:border-neutral-700 transition">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className={`w-full h-full object-contain ${isOffline ? 'opacity-60 grayscale' : ''}`}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs font-bold text-neutral-500 uppercase">
              {channel.group.substring(0, 3)}
            </span>
          )}

          {/* Corner status dot */}
          <span
            className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
              isOffline ? 'bg-rose-500 shadow-sm shadow-rose-500/50' : 'bg-emerald-400'
            }`}
            title={isOffline ? 'Kênh không khả dụng (Offline)' : 'Kênh khả dụng (Online)'}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className={`text-sm font-semibold truncate leading-tight ${
              isActive
                ? 'text-amber-400'
                : isOffline
                ? 'text-neutral-300'
                : 'text-neutral-200'
            }`}>
              {channel.name}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[11px] font-medium text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
              {channel.group}
            </span>
            <span className="text-[10px] text-neutral-400">
              {channel.resolution || 'HD'}
            </span>

            {/* Availability Badge */}
            {isOffline ? (
              <span
                className="text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded flex items-center gap-1"
                title={channel.description || 'Kênh hiện không phát được / Link bị gián đoạn'}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span>Không khả dụng</span>
              </span>
            ) : (
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Khả dụng</span>
              </span>
            )}
          </div>

          {/* Offline Reason or Diagnostic note */}
          {isOffline && channel.description && (
            <p className="text-[10px] text-rose-300/80 mt-1 truncate max-w-full font-mono" title={channel.description}>
              {channel.description}
            </p>
          )}
        </div>

        {/* Favorite Button */}
        <button
          type="button"
          onClick={(e) => onToggleFavorite(channel.id, e)}
          className="absolute top-3 right-3 text-neutral-500 hover:text-amber-400 transition p-1"
          title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
        >
          <Star
            className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'}`}
          />
        </button>
      </div>

      {/* Bottom Bar: Action buttons */}
      <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs text-neutral-400">
        <span className="text-[11px] font-mono text-neutral-400 uppercase">
          {channel.format}
        </span>

        <div className="flex items-center gap-1.5">
          {/* Quick single-channel probe button */}
          {onScanChannel && (
            <button
              type="button"
              onClick={(e) => onScanChannel(channel.id, e)}
              disabled={isScanning}
              className="p-1 text-neutral-400 hover:text-emerald-400 rounded hover:bg-neutral-800 transition"
              title="Rà soát tính khả dụng kênh này ngay (Probe)"
            >
              <Activity className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => onOpenDetails(channel, e)}
            className="p-1 hover:text-white rounded hover:bg-neutral-800 transition"
            title={isNokia ? "Xem chi tiết & link CorePlayer" : "Xem chi tiết & link phát"}
          >
            <Info className="w-3.5 h-3.5" />
          </button>

          {isNokia ? (
            <a
              href={`/open/${channel.id}`}
              onClick={(e) => e.stopPropagation()}
              className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-950/40 transition"
              title="Tự động khởi chạy CorePlayer (Nokia E72)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </a>
          ) : (
            <a
              href={getVlcLaunchUrl(channel.stream_url)}
              onClick={(e) => {
                e.stopPropagation();
                launchVlcPlayer(channel.stream_url, channel.id);
              }}
              className="p-1 text-orange-400 hover:text-orange-300 rounded hover:bg-orange-950/40 transition"
              title="Xem trên VLC player (tự động mở ứng dụng)"
            >
              <Play className="w-3.5 h-3.5 fill-orange-400/20" />
            </a>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onPlay) onPlay(channel, e);
              else onSelect(channel);
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition shadow-sm ${
              isActive
                ? 'bg-amber-500 text-neutral-950 ring-2 ring-amber-500/40 hover:bg-amber-400 scale-105'
                : isOffline
                ? 'bg-rose-950 text-rose-300 hover:bg-rose-600 hover:text-white'
                : 'bg-neutral-800 text-neutral-300 hover:bg-amber-500 hover:text-neutral-950 group-hover:bg-amber-500/80 group-hover:text-neutral-950'
            }`}
            title={isOffline ? 'Kênh báo lỗi - Bấm để thử phát lại' : 'Phát kênh này ngay'}
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
