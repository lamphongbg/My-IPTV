import React from 'react';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { Play, Star, Info, Smartphone } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  onSelect: (channel: Channel) => void;
  onPlay?: (channel: Channel, e: React.MouseEvent) => void;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  onOpenDetails: (channel: Channel, e: React.MouseEvent) => void;
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
  isNokiaLightweight,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  return (
    <div
      id={`channel-card-${channel.id}`}
      onClick={() => onSelect(channel)}
      className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
        isActive
          ? 'bg-amber-950/20 border-amber-500/60 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
          : 'bg-neutral-900/80 hover:bg-neutral-850 border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Logo / Thumbnail */}
        <div className="w-12 h-12 bg-neutral-950 rounded-lg p-1 border border-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden group-hover:border-neutral-700 transition">
          {channel.logo ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs font-bold text-neutral-500 uppercase">
              {channel.group.substring(0, 3)}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-amber-400' : 'text-neutral-200'}`}>
            {channel.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[11px] font-medium text-amber-500/80 bg-amber-500/10 px-1.5 py-0.5 rounded">
              {channel.group}
            </span>
            <span className="text-[10px] text-neutral-400">
              {channel.resolution || 'HD'}
            </span>
          </div>
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
                : 'bg-neutral-800 text-neutral-300 hover:bg-amber-500 hover:text-neutral-950 group-hover:bg-amber-500/80 group-hover:text-neutral-950'
            }`}
            title="Phát kênh này ngay"
          >
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
