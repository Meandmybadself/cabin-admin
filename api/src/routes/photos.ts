import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';
import { r2KeyForPhoto } from '../lib/r2';

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

    const withUrls = rows.map((row) => ({
      ...row,
      url: `/api/photos/${row.id}/file`,
    }));
    return json(withUrls);
  }

  // POST /api/photos/upload  — upload photo directly through Worker (streamed into R2)
  if (path === '/api/photos/upload' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = request.headers.get('X-Photo-Id') || crypto.randomUUID();
    const categoryId = request.headers.get('X-Category-Id') || '';
    const sessionIdHeader = request.headers.get('X-Session-Id');
    const sessionId = sessionIdHeader && sessionIdHeader !== 'null' ? sessionIdHeader : null;
    const takenAt = Number(request.headers.get('X-Taken-At'));
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    const notesHeader = request.headers.get('X-Notes');
    const notes = notesHeader ? decodeURIComponent(notesHeader) : null;
    if (!categoryId || !takenAt) {
      return json({ error: 'X-Category-Id and X-Taken-At required' }, 400);
    }
    const r2_key = r2KeyForPhoto(takenAt, categoryId, id);
    await env.PHOTOS.put(r2_key, request.body, { httpMetadata: { contentType } });
    await dbRun(env.DB,
      'INSERT INTO photos (id, category_id, session_id, r2_key, taken_at, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [id, categoryId, sessionId, r2_key, takenAt, notes]
    );
    const row = await dbFirst<PhotoRow>(
      env.DB,
      `SELECT p.id, p.category_id, pc.label as category_label, p.session_id,
              p.r2_key, p.taken_at, p.notes
       FROM photos p
       JOIN photo_categories pc ON pc.id = p.category_id
       WHERE p.id = ?`,
      [id]
    );
    return json({ ...row, url: `/api/photos/${id}/file` }, 201);
  }

  // GET /api/photos/:id/file  — serve photo from R2
  if (path.match(/^\/api\/photos\/[^/]+\/file$/) && method === 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const row = await dbFirst<{ r2_key: string }>(env.DB, 'SELECT r2_key FROM photos WHERE id = ?', [id]);
    if (!row) return json({ error: 'Not found' }, 404);
    const object = await env.PHOTOS.get(row.r2_key);
    if (!object) return json({ error: 'Not found' }, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
      },
    });
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
