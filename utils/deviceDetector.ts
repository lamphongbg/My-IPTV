import type { DeviceInfo, DeviceType } from '../src/types/iptv.js';

/**
 * Device Detector specialized in Symbian S60 / Nokia devices,
 * as well as modern mobile, tablet, and desktop environments.
 */
export function detectDevice(
  userAgent: string = '',
  viewOverride?: string,
  cookiePreference?: string,
  headers?: Record<string, string | string[] | undefined>
): DeviceInfo {
  const ua = userAgent || '';
  const operaPhoneUa = headers && typeof headers['x-operamini-phone-ua'] === 'string' ? headers['x-operamini-phone-ua'] : '';
  const hasOperaHeaders = Boolean(
    headers && (headers['x-operamini-features'] || headers['x-operamini-phone-ua'])
  );

  // 1. Precise Symbian OS or Series 60 detection:
  const isSymbianOrS60 = /symbian|symbos|series\s?60|\bs60\b/i.test(ua) || /symbian|series\s?60|\bs60\b/i.test(operaPhoneUa);

  // 2. Explicit Nokia brand detection:
  const isNokiaBrand = /\bnokia\b|nokia[a-z0-9_-]/i.test(ua) || /nokia/i.test(operaPhoneUa);

  // 3. Specific Symbian phone models with word boundaries or preceded by Nokia:
  const isSpecificNokiaModel =
    /\b(e72|e71|e63|n95|n82|n8|c7|e5|5800|5230|c6-00|c6-01|n97|n85|n86|6120)\b/i.test(ua) ||
    /nokia[-_\s]?(e72|e71|e63|n95|n82|n8|c7|e5|5800|5230|c6|x6|n97|n85|n86|6120|e6)/i.test(ua) ||
    /e72|e71|e63|n95|n82|n8|c7|e5/i.test(operaPhoneUa);

  // 4. Opera Mini detection:
  const isOperaMini =
    /opera mini|opera mobi/i.test(ua) ||
    hasOperaHeaders ||
    /operamini/i.test(ua);

  // 5. Legacy mobile browsers associated with S60 / feature phones:
  const isLegacyMobileBrowser =
    isOperaMini ||
    /profile\/midp|configuration\/cldc|\bmidp\b|\bcldc\b|\bwap\b|netfront|ucweb/i.test(ua);

  // Exclude modern desktop/mobile from legacy browser flags if they happen to contain partial strings
  const isModernDesktopOs = /windows nt|macintosh|mac os x|linux x86_64|cros/i.test(ua) && !isSymbianOrS60 && !isNokiaBrand;

  const isNokiaOrSymbian =
    !isModernDesktopOs &&
    (isSymbianOrS60 ||
      isNokiaBrand ||
      isSpecificNokiaModel ||
      (isLegacyMobileBrowser && !/android|iphone|ipad/i.test(ua)));

  // Tablets
  const isTablet = !isNokiaOrSymbian && /ipad|tablet|(android(?!.*mobile))/i.test(ua);

  // Modern Mobile (Android / iPhone / Windows Phone)
  const isModernMobile =
    !isNokiaOrSymbian &&
    !isTablet &&
    /iphone|ipod|android.*mobile|windows phone|blackberry|mobile/i.test(ua);

  // Desktop
  const isDesktop = !isNokiaOrSymbian && !isTablet && !isModernMobile;

  let type: DeviceType = 'UNKNOWN';
  if (isNokiaOrSymbian) {
    type = 'NOKIA_S60';
  } else if (isTablet) {
    type = 'TABLET';
  } else if (isModernMobile) {
    type = 'MOBILE_MODERN';
  } else if (isDesktop) {
    type = 'DESKTOP';
  }

  // Determine recommended view:
  // Default is 'legacy' for Nokia E72 / Symbian / Opera Mini, and 'modern' for modern mobile & desktop.
  let recommendedView: 'legacy' | 'modern' = (type === 'NOKIA_S60' || isOperaMini) ? 'legacy' : 'modern';

  // Explicit user preference from query string (?view=legacy or ?view=modern) takes top priority
  if (viewOverride === 'legacy' || viewOverride === 'modern') {
    recommendedView = viewOverride;
  } else if (cookiePreference === 'legacy' || cookiePreference === 'modern') {
    recommendedView = cookiePreference;
  }

  return {
    type,
    isNokiaS60: isNokiaOrSymbian,
    isOperaMini,
    isMobile: isNokiaOrSymbian || isModernMobile || isOperaMini,
    userAgent: ua,
    recommendedView,
  };
}
