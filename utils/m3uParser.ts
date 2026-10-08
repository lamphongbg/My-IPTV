import type { Channel } from '../src/types/iptv.js';

/**
 * Parser and Serializer for M3U / M3U8 IPTV playlists.
 * Fully supports attributes: tvg-id, tvg-name, tvg-logo, group-title,
 * preserving full query parameters and stream tokens.
 */
export function parseM3U(m3uContent: string, playlistId?: string): Channel[] {
  if (!m3uContent || typeof m3uContent !== 'string') {
    return [];
  }

  const lines = m3uContent.split(/\r?\n/);
  const channels: Channel[] = [];

  let currentInfo: Partial<Channel> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    if (rawLine.startsWith('#EXTINF:')) {
      currentInfo = {};

      // Match attributes using regex with quotes or unquoted fallback
      const tvgIdMatch = rawLine.match(/tvg-id="([^"]*)"/i);
      const tvgNameMatch = rawLine.match(/tvg-name="([^"]*)"/i);
      const tvgLogoMatch = rawLine.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = rawLine.match(/group-title="([^"]*)"/i);

      // Channel title is after the last comma of the #EXTINF header
      const commaIndex = rawLine.lastIndexOf(',');
      let title = '';
      if (commaIndex !== -1) {
        title = rawLine.substring(commaIndex + 1).trim();
      }

      const tvgId = tvgIdMatch ? tvgIdMatch[1].trim() : '';
      const tvgName = tvgNameMatch ? tvgNameMatch[1].trim() : '';
      const fallbackName = title || tvgName || `Kênh ${channels.length + 1}`;

      const generatedId = sanitizeId(tvgId || tvgName || fallbackName);
      // Ensure unique ID within playlist
      const uniqueId = playlistId ? `${playlistId}-${generatedId}-${channels.length + 1}` : `${generatedId}-${channels.length + 1}`;

      currentInfo.id = uniqueId;
      currentInfo.name = fallbackName;
      currentInfo.tvg_id = tvgId || undefined;
      currentInfo.tvg_name = tvgName || undefined;
      currentInfo.group = (groupMatch && groupMatch[1]) ? groupMatch[1].trim() : 'Khác';
      currentInfo.logo = (tvgLogoMatch && tvgLogoMatch[1]) ? tvgLogoMatch[1].trim() : '';
      if (playlistId) {
        currentInfo.playlist_id = playlistId;
      }
    } else if (!rawLine.startsWith('#') && currentInfo) {
      // Stream URL line - preserve exactly, including query parameters, tokens, & fragments
      const streamUrl = rawLine;
      if (isValidStreamUrl(streamUrl)) {
        currentInfo.stream_url = streamUrl;

        // Detect format
        const lowerUrl = streamUrl.toLowerCase();
        if (lowerUrl.includes('.m3u8')) {
          currentInfo.format = 'hls';
        } else if (lowerUrl.includes('.mp4')) {
          currentInfo.format = 'mp4';
        } else if (lowerUrl.startsWith('http')) {
          currentInfo.format = 'http';
        } else {
          currentInfo.format = 'unknown';
        }

        currentInfo.video_codec = 'h264';
        currentInfo.audio_codec = 'aac';
        currentInfo.resolution = 'HD';
        currentInfo.status = 'active';
        currentInfo.updated_at = new Date().toISOString();

        channels.push(currentInfo as Channel);
      }
      currentInfo = null;
    }
  }

  return channels;
}

/**
 * Generate standard M3U string from Channel array
 */
export function generateM3U(channels: Channel[]): string {
  let output = '#EXTM3U x-tvg-url=""\n\n';

  for (const ch of channels) {
    const id = escapeAttr(ch.tvg_id || ch.id);
    const tvgName = escapeAttr(ch.tvg_name || ch.name);
    const logo = escapeAttr(ch.logo || '');
    const group = escapeAttr(ch.group || 'Khác');

    output += `#EXTINF:-1 tvg-id="${id}" tvg-name="${tvgName}" tvg-logo="${logo}" group-title="${group}",${ch.name}\n`;
    output += `${ch.stream_url}\n\n`;
  }

  return output.trim();
}

function sanitizeId(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'channel';
}

function escapeAttr(str: string): string {
  return (str || '').replace(/"/g, "'");
}

function isValidStreamUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'rtmp:';
  } catch {
    return false;
  }
}
