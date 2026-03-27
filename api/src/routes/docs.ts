import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Doc {
  id: string;
  slug: string;
  title: string;
  category: string;
  body: string;
  updated_at: number;
}

export async function handleDocs(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/docs
  if (path === '/api/docs' && method === 'GET') {
    const docs = await dbAll<Omit<Doc, 'body'>>(
      env.DB,
      'SELECT id, slug, title, category, updated_at FROM docs ORDER BY category, title'
    );
    return json(docs);
  }

  // GET /api/docs/:slug
  if (path.match(/^\/api\/docs\/[^/]+$/) && method === 'GET') {
    const slug = path.split('/')[3];
    const doc = await dbFirst<Doc>(env.DB, 'SELECT * FROM docs WHERE slug = ?', [slug]);
    if (!doc) return json({ error: 'Not found' }, 404);
    return json(doc);
  }

  // POST /api/docs
  if (path === '/api/docs' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Doc>>();
    if (!body.id || !body.slug || !body.title || !body.category || body.body == null) {
      return json({ error: 'id, slug, title, category, body required' }, 400);
    }
    const now = Math.floor(Date.now() / 1000);
    try {
      await dbRun(env.DB,
        'INSERT INTO docs (id, slug, title, category, body, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [body.id, body.slug, body.title, body.category, body.body, now]
      );
    } catch (e: any) {
      if (e?.message?.includes('UNIQUE')) return json({ error: 'slug already exists' }, 409);
      throw e;
    }
    const created = await dbFirst<Doc>(env.DB, 'SELECT * FROM docs WHERE id = ?', [body.id]);
    return json(created, 201);
  }

  // PUT /api/docs/:id
  if (path.match(/^\/api\/docs\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Doc>>();
    if (!body.slug || !body.title || !body.category || body.body == null) {
      return json({ error: 'slug, title, category, body required' }, 400);
    }
    const now = Math.floor(Date.now() / 1000);
    const result = await dbRun(env.DB,
      'UPDATE docs SET slug=?, title=?, category=?, body=?, updated_at=? WHERE id=?',
      [body.slug, body.title, body.category, body.body, now, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const updated = await dbFirst<Doc>(env.DB, 'SELECT * FROM docs WHERE id = ?', [id]);
    return json(updated);
  }

  // DELETE /api/docs/:id
  if (path.match(/^\/api\/docs\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM docs WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
