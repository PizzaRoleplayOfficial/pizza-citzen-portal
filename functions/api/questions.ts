// functions/api/questions.ts
// Admin-managed question bank for the citizen application form

const getUserSession = (request: Request) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader
    ? Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=')))
    : {};
  const userCookie = cookies['gv_user'];
  if (!userCookie) return null;
  try {
    return JSON.parse(decodeURIComponent(userCookie));
  } catch {
    return null;
  }
};

const NO_CACHE = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' };

// GET /api/questions         -> active questions for users (no answer key)
// GET /api/questions?admin=true -> all questions with answer key (admin only)
export const onRequestGet = async ({ env, request }: { env: any; request: Request }) => {
  const url = new URL(request.url);
  const isAdminRequest = url.searchParams.get('admin') === 'true';

  if (isAdminRequest) {
    const session = getUserSession(request);
    if (!session) return new Response('Unauthorized', { status: 401 });
    const dbUser = await env.D1_DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.id).first() as any;
    if (!dbUser || dbUser.role !== 'admin') return new Response('Forbidden', { status: 403 });
  }

  try {
    const whereClause = isAdminRequest ? '' : 'WHERE is_active = 1';
    const { results } = await env.D1_DB
      .prepare(`SELECT * FROM questions ${whereClause} ORDER BY sort_order ASC`)
      .all();

    // Strip answer key for non-admin requests
    const questions = isAdminRequest
      ? results
      : (results as any[]).map(({ answer: _answer, ...q }) => q);

    return new Response(JSON.stringify(questions), { headers: NO_CACHE });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

// POST /api/questions -> add new question (admin only)
export const onRequestPost = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const dbUser = await env.D1_DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.id).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return new Response('Forbidden', { status: 403 });

  try {
    const body = await request.json() as any;
    const { question, type, choices, answer, sort_order } = body;
    if (!question || !type) return new Response('Missing fields', { status: 400 });

    const id = crypto.randomUUID();
    await env.D1_DB.prepare(
      'INSERT INTO questions (id, sort_order, question, type, choices, answer, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      sort_order ?? 999,
      question,
      type,
      typeof choices === 'string' ? choices : (choices ? JSON.stringify(choices) : null),
      typeof answer === 'string' ? answer : (answer ? JSON.stringify(answer) : null),
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({ id }), { headers: NO_CACHE });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

// PATCH /api/questions -> update question (admin only)
export const onRequestPatch = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const dbUser = await env.D1_DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.id).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return new Response('Forbidden', { status: 403 });

  try {
    const body = await request.json() as any;
    const { id, question, type, choices, answer, sort_order, is_active } = body;
    if (!id) return new Response('Missing id', { status: 400 });

    const updates: string[] = [];
    const vals: any[] = [];

    if (question !== undefined) { updates.push('question = ?'); vals.push(question); }
    if (type !== undefined) { updates.push('type = ?'); vals.push(type); }
    if (choices !== undefined) { updates.push('choices = ?'); vals.push(typeof choices === 'string' ? choices : (choices ? JSON.stringify(choices) : null)); }
    if (answer !== undefined) { updates.push('answer = ?'); vals.push(typeof answer === 'string' ? answer : (answer ? JSON.stringify(answer) : null)); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); vals.push(sort_order); }
    if (is_active !== undefined) { updates.push('is_active = ?'); vals.push(is_active ? 1 : 0); }

    if (updates.length === 0) return new Response('Nothing to update', { status: 400 });

    updates.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(id);

    await env.D1_DB.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ?`).bind(...vals).run();
    return new Response(JSON.stringify({ ok: true }), { headers: NO_CACHE });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

// DELETE /api/questions?id=xxx -> soft delete (admin only)
export const onRequestDelete = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });
  const dbUser = await env.D1_DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.id).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return new Response('Forbidden', { status: 403 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  await env.D1_DB.prepare('UPDATE questions SET is_active = 0, updated_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), id).run();
  return new Response(JSON.stringify({ ok: true }), { headers: NO_CACHE });
};
