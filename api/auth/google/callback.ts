import type { VercelRequest, VercelResponse } from '@vercel/node';
import { exchangeCode, getRedirectUri } from '../../_lib/google.js';
import {
  clearCookie,
  createSessionToken,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  parseCookies,
  setSessionCookie,
} from '../../_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const code = typeof req.query.code === 'string' ? req.query.code : undefined;
  const state = typeof req.query.state === 'string' ? req.query.state : undefined;
  const cookies = parseCookies(req);

  // Always clear the transient OAuth cookies on the way out.
  clearCookie(req, res, OAUTH_STATE_COOKIE);
  clearCookie(req, res, OAUTH_VERIFIER_COOKIE);

  if (!code || !state || state !== cookies[OAUTH_STATE_COOKIE] || !cookies[OAUTH_VERIFIER_COOKIE]) {
    res.writeHead(302, { Location: '/?login_error=state' });
    res.end();
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    res.writeHead(302, { Location: '/?login_error=config' });
    res.end();
    return;
  }

  try {
    const claims = await exchangeCode({
      code,
      clientId,
      clientSecret,
      redirectUri: getRedirectUri(req),
      codeVerifier: cookies[OAUTH_VERIFIER_COOKIE],
    });
    const token = await createSessionToken({
      sub: claims.sub,
      name: claims.name,
      email: claims.email,
      picture: claims.picture,
    });
    setSessionCookie(req, res, token);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err) {
    console.error('[auth] callback failed:', err);
    res.writeHead(302, { Location: '/?login_error=exchange' });
    res.end();
  }
}
