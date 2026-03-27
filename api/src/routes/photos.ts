import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';
import { r2KeyForPhoto, presignUpload, presignRead } from '../lib/r2';

interface PhotoRow {
  id: string;
  category_id: string;
  category_label: string;
  session_id: string | null;
  r2_key: string;
  taken_at: number;
  notes: string | null;
}

export async function handlePhotos(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);

  // GET /api/photos
  if (path === '/api/photos' && method === 'GET') {
    const conditions: string[] = [];
    const params: unknown[] = [];

    const categoryId = url.searchParams.get('category_id');
    const sessionId = url.searchParams.get('session_id');
    const before = url.searchParams.get('before');
    const after = url.searchParams.get('after');

    if (categoryId) { conditions.push('p.category_id = ?'); params.push(categoryId); }
    if (sessionId) { conditions.push('p.session_id = ?'); params.push(sessionId); }
    if (before) { conditions.push('p.taken_at < ?'); params.push(Number(before)); }
    if (after) { conditions.push('p.taken_at > ?'); params.push(Number(after)); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await dbAll<PhotoRow>(
      env.DB,
      `SELECT p.id, p.category_id, pc.label as category_label, p.session_id,
              p.r2_key, p.taken_at, p.notes
       FROM photos p
       JOIN photo_categories pc ON pc.id = p.category_id
       ${where}
       ORDER BY p.taken_at DESC`,
      params
    );

    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        url: await presignRead(env.PHOTOS, row.r2_key),
      }))
    );
    return json(withUrls);
  }

  // POST /api/photos/presign
  if (path === '/api/photos/presign' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{
      id?: string;
      category_id?: string;
      session_id?: string | null;
      taken_at?: number;
      content_type?: string;
    }>();
    if (!body.id || !body.category_id || !body.taken_at || !body.content_type) {
      return json({ error: 'id, category_id, taken_at, content_type required' }, 400);
    }
    const r2_key = r2KeyForPhoto(body.taken_at, body.category_id, body.id);
    const upload_url = await presignUpload(env.PHOTOS, r2_key, body.content_type);
    return json({ upload_url, r2_key });
  }

  // POST /api/photos/confirm
  if (path === '/api/photos/confirm' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<{
      id?: string;
      category_id?: string;
      session_id?: string | null;
      r2_key?: string;
      taken_at?: number;
      notes?: string | null;
    }>();
    if (!body.id || !body.category_id || !body.r2_key || !body.taken_at) {
      return json({ error: 'id, category_id, r2_key, taken_at required' }, 400);
    }
    await dbRun(env.DB,
      'INSERT INTO photos (id, category_id, session_id, r2_key, taken_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [body.id, body.category_id, body.session_id ?? null, body.r2_key, body.taken_at, body.notes ?? null]
    );
    const row = await dbFirst<PhotoRow>(
      env.DB,
      `SELECT p.id, p.category_id, pc.label as category_label, p.session_id,
              p.r2_key, p.taken_at, p.notes
       FROM photos p
       JOIN photo_categories pc ON pc.id = p.category_id
       WHERE p.id = ?`,
      [body.id]
    );
    const url = await presignRead(env.PHOTOS, row!.r2_key);
    return json({ ...row, url }, 201);
  }

  // DELETE /api/photos/:id
  if (path.match(/^\/api\/photos\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const row = await dbFirst<{ r2_key: string }>(env.DB, 'SELECT r2_key FROM photos WHERE id = ?', [id]);
    if (!row) return json({ error: 'Not found' }, 404);
    await env.PHOTOS.delete(row.r2_key);
    await dbRun(env.DB, 'DELETE FROM photos WHERE id = ?', [id]);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
