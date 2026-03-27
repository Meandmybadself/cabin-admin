import { Env, json } from '../index';
import { signJwt } from '../middleware/auth';

export async function handleAuth(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = await request.json<{ password?: string }>();
  if (!body.password) return json({ error: 'password required' }, 400);

  if (body.password !== env.SHARED_PASSWORD) {
    return json({ error: 'Invalid password' }, 401);
  }

  const token = await signJwt(env.JWT_SECRET);
  return json({ token });
}
