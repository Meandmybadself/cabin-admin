import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface PhotoCategory {
  id: string;
  label: string;
  sort_order: number;
}

export async function handlePhotoCategories(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  if (path === '/api/photo-categories' && method === 'GET') {
    const cats = await dbAll<PhotoCategory>(env.DB, 'SELECT * FROM photo_categories ORDER BY sort_order');
    return json(cats);
  }

  if (path === '/api/photo-categories' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<PhotoCategory>>();
    if (!body.id || !body.label) return json({ error: 'id and label required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO photo_categories (id, label, sort_order) VALUES (?, ?, ?)',
      [body.id, body.label, body.sort_order ?? 0]
    );
    return json(await dbFirst<PhotoCategory>(env.DB, 'SELECT * FROM photo_categories WHERE id = ?', [body.id]), 201);
  }

  if (path === '/api/photo-categories/reorder' && method === 'PATCH') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{ order: { id: string; sort_order: number }[] }>();
    if (!Array.isArray(body.order)) return json({ error: 'order array required' }, 400);
    const stmts = body.order.map(({ id, sort_order }) =>
      env.DB.prepare('UPDATE photo_categories SET sort_order=? WHERE id=?').bind(sort_order, id)
    );
    await env.DB.batch(stmts);
    return json({ updated: body.order.length });
  }

  if (path.match(/^\/api\/photo-categories\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<PhotoCategory>>();
    if (!body.label) return json({ error: 'label required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE photo_categories SET label=?, sort_order=? WHERE id=?',
      [body.label, body.sort_order ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(await dbFirst<PhotoCategory>(env.DB, 'SELECT * FROM photo_categories WHERE id = ?', [id]));
  }

  if (path.match(/^\/api\/photo-categories\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM photo_categories WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
