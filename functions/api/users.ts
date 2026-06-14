// functions/api/users.ts
const ensureUserTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      roblox_username TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  // Migration: Add roblox_username column if missing
  try {
    await db.prepare("ALTER TABLE users ADD COLUMN roblox_username TEXT").run();
  } catch (e) {}
};

const getAdminStatus = async (request: Request) => {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
    })) : {};
    const userCookie = cookies['gv_user'];
    if (!userCookie) return false;
    try {
        const user = JSON.parse(decodeURIComponent(userCookie));
        return user.role === 'admin';
    } catch {
        return false;
    }
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  if (!(await getAdminStatus(request))) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    await ensureUserTable(env.D1_DB);
    const { results } = await env.D1_DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
    return new Response(JSON.stringify(results), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPatch = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const userCookieStr = cookies['gv_user'];
  
  if (!userCookieStr) return new Response("Unauthorized", { status: 401 });
  
  let callerInfo;
  try {
    callerInfo = JSON.parse(decodeURIComponent(userCookieStr));
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const isAdmin = callerInfo.role === 'admin';
  const body = await request.json() as any;
  const { id, role, roblox_username } = body;

  if (!id) return new Response("Missing id", { status: 400 });

  try {
    await ensureUserTable(env.D1_DB);

    if (role !== undefined) {
      if (!isAdmin) return new Response("Forbidden", { status: 403 });
      await env.D1_DB.prepare("UPDATE users SET role = ? WHERE id = ?").bind(role, id).run();
    }

    if (roblox_username !== undefined) {
      if (callerInfo.id !== id && !isAdmin) {
          return new Response("Forbidden", { status: 403 });
      }
      await env.D1_DB.prepare("UPDATE users SET roblox_username = ? WHERE id = ?").bind(roblox_username, id).run();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};
