import { handleDocs } from './routes/docs';
import { handleContacts } from './routes/contacts';
import { handleChecklist } from './routes/checklist';
import { handlePhotos } from './routes/photos';
import { handlePhotoCategories } from './routes/photo-categories';
import { handleVideos } from './routes/videos';
import { handleBusinesses } from './routes/businesses';
import { handleAppliances } from './routes/appliances';
import { validateBasicAuth } from './middleware/auth';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  PHOTOS: R2Bucket;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://admin.benwaldencab.in',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function cors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Global auth gate
    const authErr = await validateBasicAuth(request, env);
    if (authErr) return authErr;

    // API routes
    if (path.startsWith('/api/')) {
      let response: Response;
      try {
        if (path.startsWith('/api/docs')) {
          response = await handleDocs(request, env, path);
        } else if (path.startsWith('/api/contacts')) {
          response = await handleContacts(request, env, path);
        } else if (path.startsWith('/api/checklist')) {
          response = await handleChecklist(request, env, path);
        } else if (path.startsWith('/api/photo-categories')) {
          response = await handlePhotoCategories(request, env, path);
        } else if (path.startsWith('/api/photos')) {
          response = await handlePhotos(request, env, path);
        } else if (path.startsWith('/api/videos')) {
          response = await handleVideos(request, env, path);
        } else if (path.startsWith('/api/businesses')) {
          response = await handleBusinesses(request, env, path);
        } else if (path.startsWith('/api/appliances')) {
          response = await handleAppliances(request, env, path);
        } else {
          response = json({ error: 'Not found' }, 404);
        }
      } catch (err) {
        console.error(err);
        response = json({ error: 'Internal server error' }, 500);
      }
      return cors(response);
    }

    // Static frontend — proxy to GitHub Pages origin
    const proxyReq = new Request(request.url, {
      method: request.method,
      headers: (() => {
        const h = new Headers(request.headers);
        h.delete('Authorization');
        return h;
      })(),
      body: request.body,
      redirect: 'follow',
    });
    return fetch(proxyReq);
  },
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
