import type { Request } from 'express';

/**
 * Robust URL & Host resolver for deployment on Render.com, Cloud Run, Reverse Proxies & Local LAN.
 *
 * Handles:
 * - X-Forwarded-Host & Host headers on Render (e.g. your-app.onrender.com)
 * - X-Forwarded-Proto (https on public web vs http internally)
 * - RENDER_EXTERNAL_URL / RENDER_EXTERNAL_HOSTNAME environment variables injected by Render
 * - Custom LAN IP/Host (e.g. 192.168.1.15:8080) for Nokia E72 CorePlayer local playback
 * - Protocol enforcement (HTTP strictly required for CorePlayer to avoid Symbian SSL handshake failure)
 */

export interface ResolvedServerInfo {
  host: string;
  proto: 'http' | 'https';
  baseUrl: string;
  isRender: boolean;
  rawHostname: string;
}

/**
 * Returns the effective external host (domain and optional port) for the incoming request.
 */
export function getEffectiveHost(req: Request, fallbackHost = '127.0.0.1:3000'): string {
  // 1. Check custom LAN query parameter (?host=... or ?ip=...)
  const queryHost = (req.query.host as string) || (req.query.ip as string) || (req.headers['x-custom-host'] as string);
  if (queryHost && queryHost.trim()) {
    return queryHost.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  }

  // 2. Check e72_host cookie
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/(?:^|;\s*)e72_host=([^;]+)/);
  if (match) {
    try {
      const decoded = decodeURIComponent(match[1]).trim();
      if (decoded) return decoded.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    } catch {
      if (match[1].trim()) return match[1].trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    }
  }

  // 3. Check X-Forwarded-Host (Standard Render reverse proxy header)
  const forwardedHost = req.headers['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
    // If multiple hosts comma separated, take the first (client facing)
    const firstHost = forwardedHost.split(',')[0].trim();
    if (firstHost) return firstHost;
  }

  // 4. Check standard Host header
  const reqHost = req.get('host');
  if (reqHost && reqHost.trim()) {
    return reqHost.trim();
  }

  // 5. Check Render environment variables
  if (process.env.RENDER_EXTERNAL_HOSTNAME) {
    return process.env.RENDER_EXTERNAL_HOSTNAME.trim();
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    try {
      const u = new URL(process.env.RENDER_EXTERNAL_URL);
      return u.host;
    } catch {
      // ignore
    }
  }

  return fallbackHost;
}

/**
 * Resolves the public protocol (http or https).
 * On Render, external traffic is HTTPS via Render's TLS termination proxy.
 */
export function getEffectiveProto(req: Request, forceHttpForLegacy = false): 'http' | 'https' {
  if (forceHttpForLegacy) {
    return 'http';
  }

  const queryProto = req.query.proto as string;
  if (queryProto === 'http' || queryProto === 'https') {
    return queryProto;
  }

  // Check X-Forwarded-Proto header (Render sets this to 'https')
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    const proto = forwardedProto.split(',')[0].trim().toLowerCase();
    if (proto === 'https' || proto === 'http') return proto;
  }

  if (process.env.RENDER_EXTERNAL_URL?.startsWith('https://')) {
    return 'https';
  }

  return req.protocol === 'https' ? 'https' : 'http';
}

/**
 * Resolves the full Base URL (e.g. "https://my-iptv.onrender.com" or "http://192.168.1.15:3000")
 */
export function getBaseUrl(req: Request, forceHttp = false): string {
  const host = getEffectiveHost(req);
  const proto = getEffectiveProto(req, forceHttp);
  return `${proto}://${host}`;
}

/**
 * Determines whether this deployment is running in Render cloud environment
 */
export function isRenderEnvironment(): boolean {
  return Boolean(process.env.RENDER || process.env.RENDER_SERVICE_ID || process.env.RENDER_EXTERNAL_HOSTNAME);
}
