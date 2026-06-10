import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildAuthUrl, codeChallengeS256, getRedirectUri, randomString } from '../_lib/google';
import {
  appendCookie,
  isSecure,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  serializeCookie,
} from '../_lib/session';

/** sha256 hex of the input, matching the legacy client-side password hash. */
function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function passwordOk(submitted: string): boolean {
  const expected = process.env.PAGE_PASSWORD_HASH;
  if (!expected || !submitted) return false;
  const got = sha256Hex(submitted);
  if (got.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not set' });
    return;
  }

  // Gate: the shared page password must be submitted (POST form) and valid.
  const submitted =
    req.method === 'POST' && req.body && typeof req.body === 'object'
      ? String((req.body as Record<string, unknown>).password ?? '')
      : '';
  if (!passwordOk(submitted)) {
    res.writeHead(302, { Location: '/?login_error=password' });
    res.end();
    return;
  }

  const state = randomString();
  const verifier = randomString();
  const challenge = codeChallengeS256(verifier);
  const redirectUri = getRedirectUri(req);
  const secure = isSecure(req);

  // Short-lived (10 min) cookies that carry the PKCE/CSRF state through the redirect.
  appendCookie(res, serializeCookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true, secure, sameSite: 'Lax', maxAge: 600, path: '/',
  }));
  appendCookie(res, serializeCookie(OAUTH_VERIFIER_COOKIE, verifier, {
    httpOnly: true, secure, sameSite: 'Lax', maxAge: 600, path: '/',
  }));

  res.writeHead(302, { Location: buildAuthUrl({ clientId, redirectUri, state, codeChallenge: challenge }) });
  res.end();
}
