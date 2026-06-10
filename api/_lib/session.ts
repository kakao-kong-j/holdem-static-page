import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'session';
export const OAUTH_STATE_COOKIE = 'oauth_state';
export const OAUTH_VERIFIER_COOKIE = 'oauth_verifier';

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
}

function getSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, email: user.email, picture: user.picture })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());
}

export function parseCookies(req: VercelRequest): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

interface CookieOptions {
  maxAge?: number;
  path?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Lax' | 'Strict' | 'None';
}

export function serializeCookie(name: string, value: string, opts: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

export function appendCookie(res: VercelResponse, cookie: string): void {
  const prev = res.getHeader('Set-Cookie');
  const arr = Array.isArray(prev) ? prev.slice() : prev != null ? [String(prev)] : [];
  arr.push(cookie);
  res.setHeader('Set-Cookie', arr);
}

/** Requests reaching the function over https get Secure cookies; localhost (vercel dev, http) does not. */
export function isSecure(req: VercelRequest): boolean {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? '';
  return proto.split(',')[0].trim() === 'https';
}

export function setSessionCookie(req: VercelRequest, res: VercelResponse, token: string): void {
  appendCookie(res, serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'Lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  }));
}

export function clearSessionCookie(req: VercelRequest, res: VercelResponse): void {
  appendCookie(res, serializeCookie(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  }));
}

export function clearCookie(req: VercelRequest, res: VercelResponse, name: string): void {
  appendCookie(res, serializeCookie(name, '', {
    httpOnly: true,
    secure: isSecure(req),
    sameSite: 'Lax',
    maxAge: 0,
    path: '/',
  }));
}

export async function getSessionUser(req: VercelRequest): Promise<SessionUser | null> {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}
