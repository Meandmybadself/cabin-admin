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

export async function handleTodos(request: Request, env: Env, path: string): Promise<Response> {
  const method = request.method;

  // GET /api/todos
  if (path === '/api/todos' && method === 'GET') {
    const todos = await dbAll<Todo>(env.DB, 'SELECT * FROM todos ORDER BY created_at DESC');
    return json(todos);
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
    return json(created, 201);
  }

  // DELETE /api/todos/completed — bulk delete; must come before /:id
  if (path === '/api/todos/completed' && method === 'DELETE') {
    const authErr = await requireAuth(request, env);
    if (authErr) return authErr;
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
    const result = await dbRun(env.DB, 'DELETE FROM todos WHERE id = ?', [id]);
    if (result.meta.changes === 0) return json({ error: 'Not found' }, 404);
    return new Response(null, { status: 204 });
  }

  return json({ error: 'Not found' }, 404);
}
