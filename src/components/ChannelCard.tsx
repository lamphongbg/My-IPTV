import React from 'react';
import { Channel } from '../types/iptv';
import { isNokiaLightweightBrowser, getVlcLaunchUrl, launchVlcPlayer } from '../utils/deviceHelper';
import { Play, Star, Info, Smartphone, Bell } from 'lucide-react';

interface ChannelCardProps {
  channel: Channel;
  isActive: boolean;
  isFavorite: boolean;
  isReminded?: boolean;
  onSelect: (channel: Channel) => void;
  onPlay?: (channel: Channel, e: React.MouseEvent) => void;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  onToggleReminder?: (channel: Channel, e: React.MouseEvent) => void;
  onOpenDetails: (channel: Channel, e: React.MouseEvent) => void;
  isNokiaLightweight?: boolean;
}

export const ChannelCard: React.FC<ChannelCardProps> = ({
  channel,
  isActive,
  isFavorite,
  isReminded = false,
  onSelect,
  onPlay,
  onToggleFavorite,
  onToggleReminder,
  onOpenDetails,
  isNokiaLightweight,
}) => {
  const isNokia = isNokiaLightweight ?? isNokiaLightweightBrowser();
  return (
    <div
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
        <div className="flex-1 min-w-0 pr-14">
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
            {isReminded && (
              <span className="text-[9px] text-amber-400 font-bold bg-amber-500/20 px-1 py-0.2 rounded flex items-center gap-0.5" title="Đang bật thông báo nhắc nhở">
                <Bell className="w-2.5 h-2.5 fill-current" />
                <span>Nhắc nhở</span>
              </span>
            )}
          </div>
        </div>

        {/* Top Action Icons: Bell Reminder & Star Favorite */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
          {/* Bell Icon Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReminder?.(channel, e);
            }}
            className={`p-1.5 rounded-lg transition ${
              isReminded
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                : 'text-neutral-500 hover:text-amber-400 hover:bg-neutral-800'
            }`}
            title={
              isReminded
                ? `Đang bật thông báo cho "${channel.name}" & danh mục "${channel.group}" (Nhấn để tắt)`
                : `Bật nhắc nhở khi có kênh mới trong danh mục "${channel.group}"`
            }
            aria-label={isReminded ? 'Tắt nhắc nhở kênh' : 'Bật nhắc nhở kênh'}
          >
            <Bell
              className={`w-4 h-4 ${isReminded ? 'fill-amber-400 text-amber-400 animate-pulse' : 'text-neutral-500'}`}
            />
          </button>

          {/* Favorite Button */}
          <button
            type="button"
            onClick={(e) => onToggleFavorite(channel.id, e)}
            className="p-1.5 text-neutral-500 hover:text-amber-400 rounded-lg hover:bg-neutral-800 transition"
            title={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            aria-label={isFavorite ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
          >
            <Star
              className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : 'text-neutral-500'}`}
            />
          </button>
        </div>
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
