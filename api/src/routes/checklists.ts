import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Checklist {
  id: string;
  name: string;
  sort_order: number;
}

export async function handleChecklists(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/checklists
  if (path === '/api/checklists' && method === 'GET') {
    const lists = await dbAll<Checklist>(env.DB, 'SELECT * FROM checklists ORDER BY sort_order, name');
    const counts = await dbAll<{ checklist_id: string; count: number }>(
      env.DB, 'SELECT checklist_id, COUNT(*) as count FROM checklist_items GROUP BY checklist_id'
    );
    const countMap = Object.fromEntries(counts.map(c => [c.checklist_id, c.count]));
    return json(lists.map(l => ({ ...l, item_count: countMap[l.id] ?? 0 })));
  }

  // POST /api/checklists
  if (path === '/api/checklists' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Checklist>>();
    if (!body.id || !body.name) return json({ error: 'id and name required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO checklists (id, name, sort_order) VALUES (?, ?, ?)',
      [body.id, body.name, body.sort_order ?? 0]
    );
    return json({ ...await dbFirst<Checklist>(env.DB, 'SELECT * FROM checklists WHERE id = ?', [body.id])!, item_count: 0 }, 201);
  }

  // PUT /api/checklists/:id
  if (path.match(/^\/api\/checklists\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Checklist>>();
    if (!body.name) return json({ error: 'name required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE checklists SET name=?, sort_order=? WHERE id=?',
      [body.name, body.sort_order ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(await dbFirst<Checklist>(env.DB, 'SELECT * FROM checklists WHERE id = ?', [id]));
  }

  // DELETE /api/checklists/:id
  if (path.match(/^\/api\/checklists\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    await dbRun(env.DB, 'DELETE FROM checklist_items WHERE checklist_id = ?', [id]);
    await dbRun(env.DB, 'DELETE FROM checklist_sessions WHERE checklist_id = ?', [id]);
    const result = await dbRun(env.DB, 'DELETE FROM checklists WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
