import { Env } from '../index';

export async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const token = header.slice(7);
  const valid = await verifyJwt(token, env.JWT_SECRET);
  if (!valid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

export async function signJwt(secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iat: now, exp: now + 30 * 24 * 60 * 60 };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = await hmacSign(secret, data);
  return `${data}.${sig}`;
}

export async function verifyJwt(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [header, body, sig] = parts;
  const expected = await hmacSign(secret, `${header}.${body}`);
  if (!timingSafeEqual(sig, expected)) return false;
  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')));
  return payload.exp > Math.floor(Date.now() / 1000);
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return b64url(sig);
}

function b64url(input: string | ArrayBuffer): string {
  let bytes: Uint8Array;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else {
    bytes = new Uint8Array(input);
  }
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
