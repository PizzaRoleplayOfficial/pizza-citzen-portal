// functions/api/auth/me.ts
// functions/api/auth/me.ts
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

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('='))) : {};
  const userCookie = cookies['gv_user'];

  if (userCookie) {
    try {
      await ensureUserTable(env.D1_DB);
      const sessionUser = JSON.parse(decodeURIComponent(userCookie));
      
      // Fetch latest info from DB to get roblox_username and current role/username
      const dbUser = await env.D1_DB.prepare("SELECT * FROM users WHERE id = ?").bind(sessionUser.id).first() as any;
      
      const user = {
        id: sessionUser.id,
        username: dbUser?.username || sessionUser.username,
        avatar: dbUser?.avatar || sessionUser.avatar,
        role: dbUser?.role || sessionUser.role,
        roblox_username: dbUser?.roblox_username || ''
      };

      return new Response(JSON.stringify(user), {
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    } catch (e) {
      return new Response(null, { status: 401 });
    }
  }

  return new Response(null, { status: 401 });
};

export const onRequestPatch = async ({ env, request }: { env: any, request: Request }) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('='))) : {};
  const userCookie = cookies['gv_user'];

  if (!userCookie) return new Response("Unauthorized", { status: 401 });

  try {
    await ensureUserTable(env.D1_DB);
    const sessionUser = JSON.parse(decodeURIComponent(userCookie));
    const body = await request.json() as any;
    const { roblox_username } = body;

    await env.D1_DB.prepare("UPDATE users SET roblox_username = ? WHERE id = ?")
      .bind(roblox_username, sessionUser.id).run();

    return new Response(JSON.stringify({ success: true, roblox_username }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};
