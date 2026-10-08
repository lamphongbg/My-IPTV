import type { DeviceInfo } from '../types/iptv';

/**
 * Checks whether the current user environment is running on the lightweight
 * browser intended for Nokia E72 (Symbian S60 / legacy feature phone) or
 * if the user has explicitly requested the Nokia E72 lightweight view.
 *
 * Returns:
 * - `true`: Lightweight browser for Nokia E72 (or legacy mode active) -> display CorePlayer
 * - `false`: Other browsers (modern mobile, tablet, desktop Chrome/Safari/Firefox/Edge) -> display VLC Player
 */
export function isNokiaLightweightBrowser(deviceInfo?: DeviceInfo | null): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check URL query override (?view=legacy vs ?view=modern)
  try {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam === 'legacy') return true;
    if (viewParam === 'modern') return false;
  } catch {
    // Ignore URL parse error in edge environments
  }

  // 2. Check cookie preference
  try {
    if (document.cookie.includes('iptv_view_mode=legacy')) return true;
    if (document.cookie.includes('iptv_view_mode=modern')) return false;
  } catch {
    // Ignore cookie error
  }

  // 3. Check server-provided device info if available
  if (deviceInfo) {
    if (deviceInfo.isNokiaS60 || deviceInfo.type === 'NOKIA_S60' || deviceInfo.recommendedView === 'legacy') {
      return true;
    }
  }

  // 4. Browser User-Agent sniffing for Nokia / Symbian / S60
  const ua = (navigator.userAgent || '').toLowerCase();

  // Desktop OS markers (Windows NT, Mac OS X, modern Linux, ChromeOS)
  // that do NOT contain Nokia/Symbian signatures
  const isModernDesktop =
    /(windows nt|macintosh|mac os x|linux x86_64|cros)/i.test(ua) &&
    !/symbian|s60|series\s?60|nokia/i.test(ua);

  if (isModernDesktop) {
    return false;
  }

  // Common modern mobile platforms
  if (/android|iphone|ipad|ipod/i.test(ua) && !/symbian|s60|nokia/i.test(ua)) {
    return false;
  }

  // Symbian OS or Series 60 detection
  const isSymbianOrS60 = /symbian|symbos|series\s?60|\bs60\b/i.test(ua);

  // Explicit Nokia brand detection
  const isNokiaBrand = /\bnokia\b|nokia[a-z0-9_-]/i.test(ua);

  // Specific Nokia / S60 models
  const isSpecificNokiaModel =
    /\b(e72|e71|e63|n95|n82|n8|c7|e5|5800|5230|c6|x6|n97|n85|n86|6120|e6)\b/i.test(ua);

  // Legacy feature phone browsers
  const isLegacyFeaturePhone =
    /opera mini|opera mobi|midp|cldc|netfront|ucweb/i.test(ua);

  return Boolean(isSymbianOrS60 || isNokiaBrand || isSpecificNokiaModel || isLegacyFeaturePhone);
}

/**
 * Returns the best deep-link URL to launch VLC Media Player based on current OS.
 * - Android: Android Intent targeting package `org.videolan.vlc`
 * - iOS: Custom scheme `vlc-x-callback://` or `vlc://`
 * - Desktop: `vlc://` protocol
 */
export function getVlcLaunchUrl(streamUrl: string): string {
  if (typeof window === 'undefined') return `vlc://${streamUrl}`;
  const ua = (navigator.userAgent || '').toLowerCase();
  const isAndroid = /android/i.test(ua);
  const isIos = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    // Official Android Intent scheme: directly opens installed VLC app and begins playback
    return `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;end`;
  }

  if (isIos) {
    // Official iOS VLC deep link
    return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;
  }

  // Windows, macOS, Linux
  return `vlc://${streamUrl}`;
}

/**
 * Returns the URL to launch CorePlayer on Symbian S60 / Nokia E72.
 * Points to the inline M3U stream endpoint which Symbian AppArc registers with CorePlayer.
 */
export function getCorePlayerLaunchUrl(channelId: string, streamUrl: string): string {
  // If explicitly requested, can also use scheme coreplayer://
  if (typeof window !== 'undefined' && window.location.search.includes('scheme=coreplayer')) {
    return `coreplayer://${streamUrl}`;
  }
  return `/open/${encodeURIComponent(channelId)}`;
}

/**
 * Automatically triggers VLC opening on the device.
 * - Android: Triggers Android Intent scheme to open package org.videolan.vlc
 * - iOS: Triggers vlc-x-callback:// deep link
 * - Desktop (Windows/macOS/Linux):
 *     1. Attempts to trigger custom URI scheme `vlc://<streamUrl>` using a hidden iframe
 *     2. Optionally triggers .m3u8/.m3u playlist download if requested
 */
export function launchVlcPlayer(streamUrl: string, channelId?: string, downloadM3u: boolean = false): void {
  if (typeof window === 'undefined') return;

  const ua = (navigator.userAgent || '').toLowerCase();
  const isAndroid = /android/i.test(ua);
  const isIos = /iphone|ipad|ipod/i.test(ua);

  if (isAndroid) {
    // Official Android Intent scheme: directly opens installed VLC app and begins playback
    const androidIntentUrl = `intent:${streamUrl}#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;end`;
    window.location.href = androidIntentUrl;
    return;
  }

  if (isIos) {
    // Official iOS VLC deep link
    const iosVlcUrl = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;
    window.location.href = iosVlcUrl;
    return;
  }

  // Desktop (Windows, macOS, Linux):
  // 1. Try launching vlc:// via a hidden iframe (doesn't break the page or block navigation)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `vlc://${streamUrl}`;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // ignore
      }
    }, 1500);
  } catch (err) {
    console.warn('Iframe scheme attempt failed:', err);
  }

  // 2. Trigger .m3u8 download only if explicitly requested
  if (downloadM3u && channelId) {
    const m3uUrl = `/api/channel/${encodeURIComponent(channelId)}/vlc.m3u8`;
    const link = document.createElement('a');
    link.href = m3uUrl;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        document.body.removeChild(link);
      } catch {
        // ignore
      }
    }, 500);
  }
}

