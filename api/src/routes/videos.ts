import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Video {
  id: string;
  title: string;
  url: string;
  category: string;
  notes: string;
  sort_order: number;
}

export async function handleVideos(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/videos
  if (path === '/api/videos' && method === 'GET') {
    const videos = await dbAll<Video>(env.DB, 'SELECT * FROM videos ORDER BY category, sort_order');
    return json(videos);
  }

  // POST /api/videos
  if (path === '/api/videos' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Video>>();
    if (!body.id || !body.title || !body.url) return json({ error: 'id, title, url required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO videos (id, title, url, category, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [body.id, body.title, body.url, body.category ?? '', body.notes ?? '', body.sort_order ?? 0]
    );
    return json(await dbFirst<Video>(env.DB, 'SELECT * FROM videos WHERE id = ?', [body.id]), 201);
  }

  // PUT /api/videos/:id
  if (path.match(/^\/api\/videos\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Video>>();
    if (!body.title || !body.url) return json({ error: 'title, url required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE videos SET title=?, url=?, category=?, notes=?, sort_order=? WHERE id=?',
      [body.title, body.url, body.category ?? '', body.notes ?? '', body.sort_order ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(await dbFirst<Video>(env.DB, 'SELECT * FROM videos WHERE id = ?', [id]));
  }

  // DELETE /api/videos/:id
  if (path.match(/^\/api\/videos\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM videos WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
