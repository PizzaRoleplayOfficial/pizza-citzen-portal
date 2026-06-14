// functions/api/auth/webauthn/keys.ts

const ensurePasskeysTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      key_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `).run();

  try {
    await db.prepare("ALTER TABLE user_passkeys ADD COLUMN key_name TEXT").run();
  } catch (e) {}
};

// GET /api/auth/webauthn/keys -> list all passkeys for the logged-in user
export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const userCookie = cookies['gv_user'];

  if (!userCookie) {
    return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let sessionUser;
  try {
    sessionUser = JSON.parse(decodeURIComponent(userCookie));
  } catch (e) {
    return new Response(JSON.stringify({ error: "セッションが無効です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await ensurePasskeysTable(env.D1_DB);

    const { results } = await env.D1_DB.prepare(
      "SELECT credential_id, key_name, created_at FROM user_passkeys WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(sessionUser.id).all();

    return new Response(JSON.stringify(results || []), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// DELETE /api/auth/webauthn/keys?id=xxx -> delete a passkey
export const onRequestDelete = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const userCookie = cookies['gv_user'];

  if (!userCookie) {
    return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let sessionUser;
  try {
    sessionUser = JSON.parse(decodeURIComponent(userCookie));
  } catch (e) {
    return new Response(JSON.stringify({ error: "セッションが無効です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const url = new URL(request.url);
  const credentialID = url.searchParams.get('id');

  if (!credentialID) {
    return new Response(JSON.stringify({ error: "パスキーIDが必要です" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    await ensurePasskeysTable(env.D1_DB);

    // Verify if key belongs to user
    const cred = await env.D1_DB.prepare(
      "SELECT user_id FROM user_passkeys WHERE credential_id = ?"
    ).bind(credentialID).first();

    if (!cred) {
      return new Response(JSON.stringify({ error: "パスキーが見つかりません" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (cred.user_id !== sessionUser.id) {
      return new Response(JSON.stringify({ error: "権限がありません" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await env.D1_DB.prepare(
      "DELETE FROM user_passkeys WHERE credential_id = ?"
    ).bind(credentialID).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// PATCH /api/auth/webauthn/keys -> rename a passkey
export const onRequestPatch = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const userCookie = cookies['gv_user'];

  if (!userCookie) {
    return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let sessionUser;
  try {
    sessionUser = JSON.parse(decodeURIComponent(userCookie));
  } catch (e) {
    return new Response(JSON.stringify({ error: "セッションが無効です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json() as any;
    const { id: credentialID, name: keyName } = body;

    if (!credentialID || !keyName) {
      return new Response(JSON.stringify({ error: "必要なパラメータが不足しています" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await ensurePasskeysTable(env.D1_DB);

    const cred = await env.D1_DB.prepare(
      "SELECT user_id FROM user_passkeys WHERE credential_id = ?"
    ).bind(credentialID).first();

    if (!cred) {
      return new Response(JSON.stringify({ error: "パスキーが見つかりません" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (cred.user_id !== sessionUser.id) {
      return new Response(JSON.stringify({ error: "権限がありません" }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await env.D1_DB.prepare(
      "UPDATE user_passkeys SET key_name = ? WHERE credential_id = ?"
    ).bind(keyName, credentialID).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
