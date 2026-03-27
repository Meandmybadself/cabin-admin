import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Contact {
  id: string;
  name: string;
  role: string;
  phone: string;
  notes: string;
  sort_order: number;
}

export async function handleContacts(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/contacts
  if (path === '/api/contacts' && method === 'GET') {
    const contacts = await dbAll<Contact>(env.DB, 'SELECT * FROM contacts ORDER BY sort_order');
    return json(contacts);
  }

  // POST /api/contacts
  if (path === '/api/contacts' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Contact>>();
    if (!body.id || !body.name) return json({ error: 'id and name required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO contacts (id, name, role, phone, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [body.id, body.name, body.role ?? '', body.phone ?? '', body.notes ?? '', body.sort_order ?? 0]
    );
    const created = await dbFirst<Contact>(env.DB, 'SELECT * FROM contacts WHERE id = ?', [body.id]);
    return json(created, 201);
  }

  // PATCH /api/contacts/reorder
  if (path === '/api/contacts/reorder' && method === 'PATCH') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{ order: { id: string; sort_order: number }[] }>();
    if (!Array.isArray(body.order)) return json({ error: 'order array required' }, 400);
    const stmts = body.order.map(({ id, sort_order }) =>
      env.DB.prepare('UPDATE contacts SET sort_order=? WHERE id=?').bind(sort_order, id)
    );
    await env.DB.batch(stmts);
    return json({ updated: body.order.length });
  }

  // PUT /api/contacts/:id
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Contact>>();
    if (!body.name) return json({ error: 'name required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE contacts SET name=?, role=?, phone=?, notes=?, sort_order=? WHERE id=?',
      [body.name, body.role ?? '', body.phone ?? '', body.notes ?? '', body.sort_order ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const updated = await dbFirst<Contact>(env.DB, 'SELECT * FROM contacts WHERE id = ?', [id]);
    return json(updated);
  }

  // DELETE /api/contacts/:id
  if (path.match(/^\/api\/contacts\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM contacts WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
