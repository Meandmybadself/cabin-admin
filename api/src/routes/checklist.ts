import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface ChecklistItem {
  id: string;
  label: string;
  section: string;
  sort_order: number;
  photo_prompt: string | null;
}

interface ChecklistSession {
  id: string;
  started_at: number;
  completed_at: number | null;
  checked_ids: string[];
  notes: string | null;
}

interface ChecklistSessionRow {
  id: string;
  started_at: number;
  completed_at: number | null;
  checked_ids: string; // JSON string in DB
  notes: string | null;
}

function parseSession(row: ChecklistSessionRow): ChecklistSession {
  return { ...row, checked_ids: JSON.parse(row.checked_ids || '[]') };
}

export async function handleChecklist(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // --- Items ---

  if (path === '/api/checklist/items' && method === 'GET') {
    const items = await dbAll<ChecklistItem>(env.DB, 'SELECT * FROM checklist_items ORDER BY sort_order');
    return json(items);
  }

  if (path === '/api/checklist/items' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<ChecklistItem>>();
    if (!body.id || !body.label) return json({ error: 'id and label required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO checklist_items (id, label, section, sort_order, photo_prompt) VALUES (?, ?, ?, ?, ?)',
      [body.id, body.label, body.section ?? '', body.sort_order ?? 0, body.photo_prompt ?? null]
    );
    const created = await dbFirst<ChecklistItem>(env.DB, 'SELECT * FROM checklist_items WHERE id = ?', [body.id]);
    return json(created, 201);
  }

  if (path === '/api/checklist/items/reorder' && method === 'PATCH') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{ order: { id: string; sort_order: number }[] }>();
    if (!Array.isArray(body.order)) return json({ error: 'order array required' }, 400);
    const stmts = body.order.map(({ id, sort_order }) =>
      env.DB.prepare('UPDATE checklist_items SET sort_order=? WHERE id=?').bind(sort_order, id)
    );
    await env.DB.batch(stmts);
    return json({ updated: body.order.length });
  }

  if (path.match(/^\/api\/checklist\/items\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[4];
    const body = await request.json<Partial<ChecklistItem>>();
    if (!body.label) return json({ error: 'label required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE checklist_items SET label=?, section=?, sort_order=?, photo_prompt=? WHERE id=?',
      [body.label, body.section ?? '', body.sort_order ?? 0, body.photo_prompt ?? null, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return json(await dbFirst<ChecklistItem>(env.DB, 'SELECT * FROM checklist_items WHERE id = ?', [id]));
  }

  if (path.match(/^\/api\/checklist\/items\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[4];
    const result = await dbRun(env.DB, 'DELETE FROM checklist_items WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  // --- Sessions ---

  if (path === '/api/checklist/sessions' && method === 'GET') {
    const rows = await dbAll<ChecklistSessionRow>(
      env.DB, 'SELECT * FROM checklist_sessions ORDER BY started_at DESC'
    );
    return json(rows.map(parseSession));
  }

  if (path === '/api/checklist/sessions/active' && method === 'GET') {
    const row = await dbFirst<ChecklistSessionRow>(
      env.DB, 'SELECT * FROM checklist_sessions WHERE completed_at IS NULL ORDER BY started_at DESC LIMIT 1'
    );
    return json(row ? parseSession(row) : null);
  }

  if (path === '/api/checklist/sessions' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{ id?: string; started_at?: number }>();
    if (!body.id || !body.started_at) return json({ error: 'id and started_at required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO checklist_sessions (id, started_at, checked_ids) VALUES (?, ?, ?)',
      [body.id, body.started_at, '[]']
    );
    return json({ id: body.id, started_at: body.started_at, checked_ids: [], completed_at: null }, 201);
  }

  if (path.match(/^\/api\/checklist\/sessions\/[^/]+\/complete$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[4];
    const body = await request.json<{ completed_at?: number; notes?: string | null }>();
    if (!body.completed_at) return json({ error: 'completed_at required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE checklist_sessions SET completed_at=?, notes=? WHERE id=?',
      [body.completed_at, body.notes ?? null, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const row = await dbFirst<ChecklistSessionRow>(env.DB, 'SELECT * FROM checklist_sessions WHERE id = ?', [id]);
    return json(parseSession(row!));
  }

  if (path.match(/^\/api\/checklist\/sessions\/[^/]+$/) && method === 'PATCH') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[4];
    const body = await request.json<{ checked_ids?: string[]; notes?: string | null }>();
    if (!Array.isArray(body.checked_ids)) return json({ error: 'checked_ids array required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE checklist_sessions SET checked_ids=?, notes=? WHERE id=?',
      [JSON.stringify(body.checked_ids), body.notes ?? null, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const row = await dbFirst<ChecklistSessionRow>(env.DB, 'SELECT * FROM checklist_sessions WHERE id = ?', [id]);
    return json(parseSession(row!));
  }

  return json({ error: 'Not found' }, 404);
}
