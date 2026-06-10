import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSessionUser } from '../_lib/session.js';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ authenticated: false });
    return;
  }
  res.status(200).json({ authenticated: true, user });
}
