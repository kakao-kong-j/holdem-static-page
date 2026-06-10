import crypto from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomString(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}

export function codeChallengeS256(verifier: string): string {
  return base64url(crypto.createHash('sha256').update(verifier).digest());
}

export function getRedirectUri(req: VercelRequest): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim() || 'https';
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  return `${proto}://${host}/api/auth/google/callback`;
}

export function buildAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: opts.state,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleIdClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export async function exchangeCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<GoogleIdClaims> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: opts.codeVerifier,
    }),
  });
  if (!res.ok) {
    throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error('no id_token in token response');
  return decodeIdToken(data.id_token);
}

/**
 * Decode the id_token payload. The token comes directly from Google's token
 * endpoint over server-to-server TLS, so we trust it without re-verifying the
 * signature and read only the identity claims we need.
 */
function decodeIdToken(idToken: string): GoogleIdClaims {
  const segment = idToken.split('.')[1];
  if (!segment) throw new Error('malformed id_token');
  const json = Buffer.from(segment.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const claims = JSON.parse(json) as Record<string, unknown>;
  if (typeof claims.sub !== 'string') throw new Error('id_token missing sub');
  return {
    sub: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}
