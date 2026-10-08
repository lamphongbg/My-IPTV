import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const AUTH_SECRET = process.env.ADMIN_SECRET || 'my-iptv-secret-key-salt-change-in-prod';
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getAdminCredentials() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  return { username, password };
}

export function generateToken(username: string): string {
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS;
  const payload = `${username}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(tokenStr: string): { valid: boolean; username?: string } {
  try {
    const decoded = Buffer.from(tokenStr, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return { valid: false };

    const [username, expiresAtStr, signature] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    if (Date.now() > expiresAt) {
      return { valid: false };
    }

    const payload = `${username}:${expiresAtStr}`;
    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('hex');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return { valid: false };
    }

    return { valid: true, username };
  } catch {
    return { valid: false };
  }
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Check Authorization header or query token
  const authHeader = req.headers.authorization;
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Chưa đăng nhập. Vui lòng đăng nhập quyền quản trị.' });
  }

  const verified = verifyToken(token);
  if (!verified.valid) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ.' });
  }

  (req as any).adminUser = verified.username;
  next();
}
