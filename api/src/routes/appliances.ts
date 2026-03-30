import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Appliance {
  id: string;
  name: string;
  model: string;
  notes: string;
  sort_order: number;
}

interface ApplianceEvent {
  id: string;
  appliance_id: string;
  date: string;
  description: string;
  created_at: number;
}

export async function handleAppliances(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/appliances
  if (path === '/api/appliances' && method === 'GET') {
    const appliances = await dbAll<Appliance>(env.DB, 'SELECT * FROM appliances ORDER BY sort_order, name');
    const events = await dbAll<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events ORDER BY date DESC, created_at DESC');
    const eventsByAppliance: Record<string, ApplianceEvent[]> = {};
    for (const e of events) {
      (eventsByAppliance[e.appliance_id] = eventsByAppliance[e.appliance_id] || []).push(e);
    }
    return json(appliances.map(a => ({ ...a, events: eventsByAppliance[a.id] || [] })));
  }

  // GET /api/appliances/:id
  if (path.match(/^\/api\/appliances\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    const appliance = await dbFirst<Appliance>(env.DB, 'SELECT * FROM appliances WHERE id = ?', [id]);
    if (!appliance) return json({ error: 'Not found' }, 404);
    const events = await dbAll<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events WHERE appliance_id = ? ORDER BY date DESC, created_at DESC', [id]);
    return json({ ...appliance, events });
  }

  // POST /api/appliances
  if (path === '/api/appliances' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Appliance>>();
    if (!body.id || !body.name) return json({ error: 'id and name required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO appliances (id, name, model, notes, sort_order) VALUES (?, ?, ?, ?, ?)',
      [body.id, body.name, body.model ?? '', body.notes ?? '', body.sort_order ?? 0]
    );
    const created = await dbFirst<Appliance>(env.DB, 'SELECT * FROM appliances WHERE id = ?', [body.id]);
    return json({ ...created!, events: [] }, 201);
  }

  // PUT /api/appliances/:id
  if (path.match(/^\/api\/appliances\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Appliance>>();
    if (!body.name) return json({ error: 'name required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE appliances SET name=?, model=?, notes=?, sort_order=? WHERE id=?',
      [body.name, body.model ?? '', body.notes ?? '', body.sort_order ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const updated = await dbFirst<Appliance>(env.DB, 'SELECT * FROM appliances WHERE id = ?', [id]);
    const events = await dbAll<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events WHERE appliance_id = ? ORDER BY date DESC, created_at DESC', [id]);
    return json({ ...updated!, events });
  }

  // DELETE /api/appliances/:id
  if (path.match(/^\/api\/appliances\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const result = await dbRun(env.DB, 'DELETE FROM appliances WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  // POST /api/appliances/:id/events
  if (path.match(/^\/api\/appliances\/[^/]+\/events$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const applianceId = path.split('/')[3];
    const appliance = await dbFirst<Appliance>(env.DB, 'SELECT id FROM appliances WHERE id = ?', [applianceId]);
    if (!appliance) return json({ error: 'Not found' }, 404);
    const body = await request.json<Partial<ApplianceEvent>>();
    if (!body.id || !body.date || !body.description) return json({ error: 'id, date, description required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO appliance_events (id, appliance_id, date, description) VALUES (?, ?, ?, ?)',
      [body.id, applianceId, body.date, body.description]
    );
    const created = await dbFirst<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events WHERE id = ?', [body.id]);
    return json(created, 201);
  }

  // DELETE /api/appliances/:id/events/:event_id
  if (path.match(/^\/api\/appliances\/[^/]+\/events\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const parts = path.split('/');
    const eventId = parts[5];
    const result = await dbRun(env.DB, 'DELETE FROM appliance_events WHERE id = ?', [eventId]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
