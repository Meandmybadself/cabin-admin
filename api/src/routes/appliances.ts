import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';
import { presignUpload, presignRead } from '../lib/r2';

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

interface ApplianceManual {
  id: string;
  appliance_id: string;
  name: string;
  url: string | null;
  r2_key: string | null;
  created_at: number;
}

function r2KeyForManual(applianceId: string, manualId: string): string {
  return `manuals/${applianceId}/${manualId}.pdf`;
}

async function resolveManualUrl(bucket: R2Bucket, manual: ApplianceManual): Promise<string> {
  if (manual.r2_key) return presignRead(bucket, manual.r2_key);
  return manual.url ?? '';
}

export async function handleAppliances(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/appliances
  if (path === '/api/appliances' && method === 'GET') {
    const appliances = await dbAll<Appliance>(env.DB, 'SELECT * FROM appliances ORDER BY sort_order, name');
    const events = await dbAll<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events ORDER BY date DESC, created_at DESC');
    const manuals = await dbAll<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals ORDER BY created_at ASC');

    const eventsByAppliance: Record<string, ApplianceEvent[]> = {};
    for (const e of events) {
      (eventsByAppliance[e.appliance_id] = eventsByAppliance[e.appliance_id] || []).push(e);
    }

    const manualsByAppliance: Record<string, ApplianceManual[]> = {};
    for (const m of manuals) {
      (manualsByAppliance[m.appliance_id] = manualsByAppliance[m.appliance_id] || []).push(m);
    }

    const result = await Promise.all(appliances.map(async a => ({
      ...a,
      events: eventsByAppliance[a.id] || [],
      manuals: await Promise.all((manualsByAppliance[a.id] || []).map(async m => ({
        ...m,
        url: await resolveManualUrl(env.PHOTOS, m),
      }))),
    })));

    return json(result);
  }

  // GET /api/appliances/:id
  if (path.match(/^\/api\/appliances\/[^/]+$/) && method === 'GET') {
    const id = path.split('/')[3];
    const appliance = await dbFirst<Appliance>(env.DB, 'SELECT * FROM appliances WHERE id = ?', [id]);
    if (!appliance) return json({ error: 'Not found' }, 404);
    const events = await dbAll<ApplianceEvent>(env.DB, 'SELECT * FROM appliance_events WHERE appliance_id = ? ORDER BY date DESC, created_at DESC', [id]);
    const manuals = await dbAll<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals WHERE appliance_id = ? ORDER BY created_at ASC', [id]);
    const resolvedManuals = await Promise.all(manuals.map(async m => ({
      ...m,
      url: await resolveManualUrl(env.PHOTOS, m),
    })));
    return json({ ...appliance, events, manuals: resolvedManuals });
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
    return json({ ...created!, events: [], manuals: [] }, 201);
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
    const manuals = await dbAll<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals WHERE appliance_id = ? ORDER BY created_at ASC', [id]);
    const resolvedManuals = await Promise.all(manuals.map(async m => ({
      ...m,
      url: await resolveManualUrl(env.PHOTOS, m),
    })));
    return json({ ...updated!, events, manuals: resolvedManuals });
  }

  // DELETE /api/appliances/:id
  if (path.match(/^\/api\/appliances\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    // Delete R2 objects for any uploaded manuals
    const manuals = await dbAll<ApplianceManual>(env.DB, 'SELECT r2_key FROM appliance_manuals WHERE appliance_id = ? AND r2_key IS NOT NULL', [id]);
    await Promise.all(manuals.map(m => env.PHOTOS.delete(m.r2_key!)));
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

  // POST /api/appliances/:id/manuals/presign  (PDF upload)
  if (path.match(/^\/api\/appliances\/[^/]+\/manuals\/presign$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const applianceId = path.split('/')[3];
    const appliance = await dbFirst<Appliance>(env.DB, 'SELECT id FROM appliances WHERE id = ?', [applianceId]);
    if (!appliance) return json({ error: 'Not found' }, 404);
    const body = await request.json<{ id?: string; name?: string }>();
    if (!body.id || !body.name) return json({ error: 'id and name required' }, 400);
    const r2_key = r2KeyForManual(applianceId, body.id);
    const upload_url = await presignUpload(env.PHOTOS, r2_key, 'application/pdf');
    return json({ upload_url, r2_key });
  }

  // POST /api/appliances/:id/manuals/confirm  (confirm after PDF upload)
  if (path.match(/^\/api\/appliances\/[^/]+\/manuals\/confirm$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const applianceId = path.split('/')[3];
    const body = await request.json<{ id?: string; name?: string; r2_key?: string }>();
    if (!body.id || !body.name || !body.r2_key) return json({ error: 'id, name, r2_key required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO appliance_manuals (id, appliance_id, name, url, r2_key) VALUES (?, ?, ?, NULL, ?)',
      [body.id, applianceId, body.name, body.r2_key]
    );
    const manual = await dbFirst<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals WHERE id = ?', [body.id]);
    return json({ ...manual!, url: await presignRead(env.PHOTOS, body.r2_key) }, 201);
  }

  // POST /api/appliances/:id/manuals  (external link)
  if (path.match(/^\/api\/appliances\/[^/]+\/manuals$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const applianceId = path.split('/')[3];
    const appliance = await dbFirst<Appliance>(env.DB, 'SELECT id FROM appliances WHERE id = ?', [applianceId]);
    if (!appliance) return json({ error: 'Not found' }, 404);
    const body = await request.json<{ id?: string; name?: string; url?: string }>();
    if (!body.id || !body.name || !body.url) return json({ error: 'id, name, url required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO appliance_manuals (id, appliance_id, name, url, r2_key) VALUES (?, ?, ?, ?, NULL)',
      [body.id, applianceId, body.name, body.url]
    );
    const manual = await dbFirst<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals WHERE id = ?', [body.id]);
    return json(manual, 201);
  }

  // DELETE /api/appliances/:id/manuals/:manual_id
  if (path.match(/^\/api\/appliances\/[^/]+\/manuals\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const parts = path.split('/');
    const manualId = parts[5];
    const manual = await dbFirst<ApplianceManual>(env.DB, 'SELECT * FROM appliance_manuals WHERE id = ?', [manualId]);
    if (!manual) return json({ error: 'Not found' }, 404);
    if (manual.r2_key) await env.PHOTOS.delete(manual.r2_key);
    await dbRun(env.DB, 'DELETE FROM appliance_manuals WHERE id = ?', [manualId]);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
