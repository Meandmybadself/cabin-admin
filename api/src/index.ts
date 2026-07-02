import { handleDocs } from './routes/docs';
import { handleContacts } from './routes/contacts';
import { handleChecklist } from './routes/checklist';
import { handlePhotos } from './routes/photos';
import { handlePhotoCategories } from './routes/photo-categories';
import { handleVideos } from './routes/videos';
import { handleBusinesses, handlePublicBusinesses } from './routes/businesses';
import { handleAppliances } from './routes/appliances';
import { handleChecklists } from './routes/checklists';
import { handleTodos } from './routes/todos';
import { validateBasicAuth } from './middleware/auth';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  PHOTOS: R2Bucket;
}

const ALLOWED_ORIGINS = [
  'https://admin.benwaldencab.in',
  'https://benwaldencab.in',
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Vary': 'Origin',
  };
}

function cors(res: Response, request: Request): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Public, unauthenticated read-only routes (available to benwaldencab.in).
    // Dispatched BEFORE the auth gate — do not add mutating routes here.
    if (path.startsWith('/api/public/')) {
      let response: Response;
      try {
        if (path.startsWith('/api/public/businesses')) {
          response = await handlePublicBusinesses(request, env, path);
        } else {
          response = json({ error: 'Not found' }, 404);
        }
      } catch (err) {
        console.error(err);
        response = json({ error: 'Internal server error' }, 500);
      }
      return cors(response, request);
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
        } else if (path.startsWith('/api/checklists')) {
          response = await handleChecklists(request, env, path);
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
        } else if (path.startsWith('/api/todos')) {
          response = await handleTodos(request, env, path);
        } else {
          response = json({ error: 'Not found' }, 404);
        }
      } catch (err) {
        console.error(err);
        response = json({ error: 'Internal server error' }, 500);
      }
      return cors(response, request);
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
