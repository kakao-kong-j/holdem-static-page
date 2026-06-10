import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildAuthUrl, codeChallengeS256, getRedirectUri, randomString } from '../_lib/google';
import {
  appendCookie,
  isSecure,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  serializeCookie,
} from '../_lib/session';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_ID is not set' });
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
