import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Business {
  id: string;
  name: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  hours: string;         // JSON string in DB
  closed_months: string; // JSON string in DB
  tags: string;          // JSON string in DB
  closures: string;      // JSON string in DB — specific closed dates ["YYYY-MM-DD",...]
  sort_order: number;
}

export async function handleBusinesses(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/businesses
  if (path === '/api/businesses' && method === 'GET') {
    const rows = await dbAll<Business>(env.DB, 'SELECT * FROM businesses ORDER BY category, sort_order');
    return json(rows.map(parse));
  }

  // GET /api/businesses/:id
  if (path.match(/^\/api\/businesses\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    const row = await dbFirst<Business>(env.DB, 'SELECT * FROM businesses WHERE id = ?', [id]);
    if (!row) return json({ error: 'Not found' }, 404);
    return json(parse(row));
  }

  // POST /api/businesses
  if (path === '/api/businesses' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Business> & { hours?: unknown; closed_months?: unknown; tags?: unknown; closures?: unknown }>();
    if (!body.id || !body.name) return json({ error: 'id and name required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO businesses (id, name, category, description, address, phone, website, hours, closed_months, tags, closures, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        body.id, body.name,
        body.category ?? '',
        body.description ?? '',
        body.address ?? '',
        body.phone ?? '',
        body.website ?? '',
        typeof body.hours === 'string' ? body.hours : JSON.stringify(body.hours ?? {}),
        typeof body.closed_months === 'string' ? body.closed_months : JSON.stringify(body.closed_months ?? []),
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags ?? []),
        typeof body.closures === 'string' ? body.closures : JSON.stringify(body.closures ?? []),
        body.sort_order ?? 0,
      ]
    );
    return json(parse((await dbFirst<Business>(env.DB, 'SELECT * FROM businesses WHERE id = ?', [body.id]))!), 201);
  }

  // PUT /api/businesses/:id
  if (path.match(/^\/api\/businesses\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Business> & { hours?: unknown; closed_months?: unknown; tags?: unknown; closures?: unknown }>();
    if (!body.name) return json({ error: 'name required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE businesses SET name=?, category=?, description=?, address=?, phone=?, website=?, hours=?, closed_months=?, tags=?, closures=?, sort_order=? WHERE id=?',
      [
        body.name,
        body.category ?? '',
        body.description ?? '',
        body.address ?? '',
        body.phone ?? '',
        body.website ?? '',
        typeof body.hours === 'string' ? body.hours : JSON.stringify(body.hours ?? {}),
        typeof body.closed_months === 'string' ? body.closed_months : JSON.stringify(body.closed_months ?? []),
        typeof body.tags === 'string' ? body.tags : JSON.stringify(body.tags ?? []),
        typeof body.closures === 'string' ? body.closures : JSON.stringify(body.closures ?? []),
        body.sort_order ?? 0,
        id,
      ]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(parse((await dbFirst<Business>(env.DB, 'SELECT * FROM businesses WHERE id = ?', [id]))!));
  }

  // DELETE /api/businesses/:id
  if (path.match(/^\/api\/businesses\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM businesses WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  // PATCH /api/businesses/reorder
  if (path === '/api/businesses/reorder' && method === 'PATCH') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{ order: { id: string; sort_order: number }[] }>();
    if (!Array.isArray(body.order)) return json({ error: 'order array required' }, 400);
    const stmts = body.order.map(({ id, sort_order }) =>
      env.DB.prepare('UPDATE businesses SET sort_order=? WHERE id=?').bind(sort_order, id)
    );
    await env.DB.batch(stmts);
    return json({ updated: body.order.length });
  }

  return json({ error: 'Not found' }, 404);
}

function parse(row: Business) {
  return {
    ...row,
    hours: typeof row.hours === 'string' ? JSON.parse(row.hours || '{}') : row.hours,
    closed_months: typeof row.closed_months === 'string' ? JSON.parse(row.closed_months || '[]') : row.closed_months,
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags || '[]') : (row.tags ?? []),
    closures: typeof row.closures === 'string' ? JSON.parse(row.closures || '[]') : (row.closures ?? []),
  };
}
