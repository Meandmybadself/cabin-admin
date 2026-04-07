import { Env, json } from '../index';
import { requireAuth } from '../middleware/auth';
import { dbAll, dbFirst, dbRun } from '../lib/db';

interface Todo {
  id: string;
  title: string;
  description: string;
  category: string;
  done: number;
  created_at: number;
}

interface TodoMedia {
  id: string;
  todo_id: string;
  r2_key: string;
  media_type: string;
  filename: string;
  created_at: number;
}

export async function handleTodos(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/todos
  if (path === '/api/todos' && method === 'GET') {
    const todos = await dbAll<Todo>(env.DB, 'SELECT * FROM todos ORDER BY created_at DESC');
    const allMedia = await dbAll<TodoMedia>(env.DB, 'SELECT * FROM todo_media ORDER BY created_at ASC');

    const mediaByTodo: Record<string, TodoMedia[]> = {};
    for (const m of allMedia) {
      (mediaByTodo[m.todo_id] = mediaByTodo[m.todo_id] || []).push(m);
    }

    const result = todos.map(t => ({
      ...t,
      media: (mediaByTodo[t.id] || []).map(m => ({
        ...m,
        url: `/api/todos/${t.id}/media/${m.id}/file`,
      })),
    }));

    return json(result);
  }

  // POST /api/todos
  if (path === '/api/todos' && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const body = await request.json<Partial<Todo>>();
    if (!body.id || !body.title) return json({ error: 'id and title required' }, 400);
    await dbRun(env.DB,
      'INSERT INTO todos (id, title, description, category, done) VALUES (?, ?, ?, ?, 0)',
      [body.id, body.title, body.description ?? '', body.category ?? 'General']
    );
    const created = await dbFirst<Todo>(env.DB, 'SELECT * FROM todos WHERE id = ?', [body.id]);
    return json({ ...created!, media: [] }, 201);
  }

  // DELETE /api/todos/completed — bulk delete; must come before /:id
  if (path === '/api/todos/completed' && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const mediaItems = await dbAll<TodoMedia>(env.DB,
      'SELECT tm.r2_key FROM todo_media tm JOIN todos t ON t.id = tm.todo_id WHERE t.done = 1', []);
    await Promise.all(mediaItems.map(m => env.PHOTOS.delete(m.r2_key)));
    await dbRun(env.DB, 'DELETE FROM todos WHERE done = 1', []);
    return new Response(null, { status: 204 });
  }

  // PUT /api/todos/:id
  if (path.match(/^\/api\/todos\/[^/]+$/) && method === 'PUT') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const body = await request.json<Partial<Todo>>();
    if (!body.title) return json({ error: 'title required' }, 400);
    const result = await dbRun(env.DB,
      'UPDATE todos SET title=?, description=?, category=?, done=? WHERE id=?',
      [body.title, body.description ?? '', body.category ?? 'General', body.done ?? 0, id]
    );
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    const updated = await dbFirst<Todo>(env.DB, 'SELECT * FROM todos WHERE id = ?', [id]);
    return json(updated);
  }

  // DELETE /api/todos/:id
  if (path.match(/^\/api\/todos\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const id = path.split('/')[3];
    const mediaItems = await dbAll<TodoMedia>(env.DB, 'SELECT r2_key FROM todo_media WHERE todo_id = ?', [id]);
    await Promise.all(mediaItems.map(m => env.PHOTOS.delete(m.r2_key)));
    const result = await dbRun(env.DB, 'DELETE FROM todos WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  // POST /api/todos/:id/media  — upload file directly through Worker
  if (path.match(/^\/api\/todos\/[^/]+\/media$/) && method === 'POST') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const todoId = path.split('/')[3];
    const todo = await dbFirst<Todo>(env.DB, 'SELECT id FROM todos WHERE id = ?', [todoId]);
    if (!todo) return json({ error: 'Not found' }, 404);
    const mediaId   = request.headers.get('X-Media-Id') || crypto.randomUUID();
    const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    const filename  = request.headers.get('X-Filename') || '';
    const mediaType = contentType.startsWith('image/') ? 'image' : 'video';
    const r2_key    = `todos/${todoId}/${mediaId}`;
    await env.PHOTOS.put(r2_key, request.body, { httpMetadata: { contentType } });
    await dbRun(env.DB,
      'INSERT INTO todo_media (id, todo_id, r2_key, media_type, filename) VALUES (?, ?, ?, ?, ?)',
      [mediaId, todoId, r2_key, mediaType, filename]
    );
    const media = await dbFirst<TodoMedia>(env.DB, 'SELECT * FROM todo_media WHERE id = ?', [mediaId]);
    return json({ ...media!, url: `/api/todos/${todoId}/media/${mediaId}/file` }, 201);
  }

  // GET /api/todos/:id/media/:mediaId/file  — serve file from R2
  if (path.match(/^\/api\/todos\/[^/]+\/media\/[^/]+\/file$/) && method === 'GET') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const parts   = path.split('/');
    const todoId  = parts[3];
    const mediaId = parts[5];
    const media   = await dbFirst<TodoMedia>(env.DB, 'SELECT * FROM todo_media WHERE id = ? AND todo_id = ?', [mediaId, todoId]);
    if (!media) return json({ error: 'Not found' }, 404);
    const object  = await env.PHOTOS.get(media.r2_key);
    if (!object) return json({ error: 'Not found' }, 404);
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  // DELETE /api/todos/:id/media/:media_id
  if (path.match(/^\/api\/todos\/[^/]+\/media\/[^/]+$/) && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
    const parts = path.split('/');
    const mediaId = parts[5];
    const media = await dbFirst<TodoMedia>(env.DB, 'SELECT * FROM todo_media WHERE id = ?', [mediaId]);
    if (!media) return json({ error: 'Not found' }, 404);
    await env.PHOTOS.delete(media.r2_key);
    await dbRun(env.DB, 'DELETE FROM todo_media WHERE id = ?', [mediaId]);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
