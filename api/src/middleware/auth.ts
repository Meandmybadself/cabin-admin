import { Env } from '../index';

export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  return validateBasicAuth(request, env);
}

export async function validateBasicAuth(request: Request, env: Env): Promise<Response | null> {
  const header = request.headers.get('Authorization');

  if (!header?.startsWith('Basic ')) {
    return unauthorized();
  }

  try {
    const decoded = atob(header.slice(6));
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return unauthorized();
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);

    const storedPassword = await env.KV.get(`auth:${username}`);
    if (!storedPassword || !timingSafeEqual(storedPassword, password)) {
      return unauthorized();
    }
  } catch {
    return unauthorized();
  }

  return null;
}

function unauthorized(): Response {
  return new Response('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Cabin OS"',
      'Content-Type': 'text/plain',
    },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
