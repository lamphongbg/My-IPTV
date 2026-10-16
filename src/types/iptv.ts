export interface SubtitleTrackInfo {
  id?: string | number;
  name?: string;
  lang?: string;
  isDefault?: boolean;
  default?: boolean;
  autoSelect?: boolean;
  forced?: boolean;
  type?: 'vtt' | 'ass' | 'embedded' | 'cea608' | 'unknown' | string;
  uri?: string;
}

export interface Channel {
  id: string;
  playlist_id?: string;
  name: string;
  group: string;
  logo: string;
  stream_url: string;
  format: 'hls' | 'mp4' | 'http' | 'dash' | 'ts' | 'unknown';
  tvg_id?: string;
  tvg_name?: string;
  video_codec?: string;
  audio_codec?: string;
  resolution?: string;
  status?: 'active' | 'check' | 'offline';
  description?: string;
  has_subtitles?: boolean;
  subtitle_tracks?: SubtitleTrackInfo[];
  requires_vlc?: boolean;
  web_playable?: boolean;
  updated_at?: string;
}

export interface Playlist {
  id: string;
  name: string;
  type: 'url' | 'content';
  url?: string;
  content?: string;
  enabled: boolean;
  channel_count: number;
  last_updated: string;
  status: 'active' | 'error' | 'syncing';
  error_message?: string;
}

export interface StreamTestResult {
  url: string;
  status: 'online' | 'warning' | 'offline';
  http_status?: number;
  content_type?: string;
  is_https: boolean;
  response_time_ms: number;
  message: string;
}

export type DeviceType = 'NOKIA_S60' | 'MOBILE_MODERN' | 'TABLET' | 'DESKTOP' | 'UNKNOWN';

export interface DeviceInfo {
  type: DeviceType;
  isNokiaS60: boolean;
  isOperaMini?: boolean;
  isMobile: boolean;
  userAgent: string;
  recommendedView: 'legacy' | 'modern';
  clientIp?: string;
}

export interface AdminStats {
  totalPlaylists: number;
  activePlaylists: number;
  totalChannels: number;
  activeChannels: number;
  offlineChannels?: number;
  subtitlesChannels?: number;
  groups: string[];
}

export interface ChannelFilterOptions {
  group?: string;
  search?: string;
  status?: 'all' | 'active' | 'offline';
  hasSubtitles?: boolean;
}
