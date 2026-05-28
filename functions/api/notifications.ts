// API for Notifications Management
// Path: functions/api/notifications.ts

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

const NO_CACHE = { 
  'Content-Type': 'application/json', 
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' 
};

const ensureNotificationsTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      link_action TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const session = getUserSession(request);
  const url = new URL(request.url);
  const userId = session?.id || url.searchParams.get('userId') || '';

  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing user ID or unauthorized" }), { status: 401, headers: NO_CACHE });
  }

  try {
    await ensureNotificationsTable(env.D1_DB);

    // Fetch latest 50 notifications
    const notificationsQuery = `
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `;
    const { results: notifications } = await env.D1_DB.prepare(notificationsQuery).bind(userId).all();

    // Fetch unread count
    const countQuery = `
      SELECT COUNT(*) as count FROM notifications 
      WHERE user_id = ? AND is_read = 0
    `;
    const unread = await env.D1_DB.prepare(countQuery).bind(userId).first() as any;

    return new Response(JSON.stringify({
      notifications: notifications || [],
      unreadCount: unread?.count || 0
    }), { headers: NO_CACHE });
  } catch (e: any) {
    console.error("Notifications GET Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  const session = getUserSession(request);
  const url = new URL(request.url);
  
  try {
    const body = await request.json() as any;
    const { id, markAll } = body;
    const userId = session?.id || body.userId || url.searchParams.get('userId') || '';

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user ID or unauthorized" }), { status: 401, headers: NO_CACHE });
    }

    await ensureNotificationsTable(env.D1_DB);

    if (markAll) {
      // Mark all notifications as read for this user
      await env.D1_DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ?"
      ).bind(userId).run();
    } else if (id) {
      // Mark specific notification as read
      await env.D1_DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
      ).bind(id, userId).run();
    } else {
      return new Response(JSON.stringify({ error: "Missing parameter 'id' or 'markAll'" }), { status: 400, headers: NO_CACHE });
    }

    return new Response(JSON.stringify({ success: true }), { headers: NO_CACHE });
  } catch (e: any) {
    console.error("Notifications POST/Patch Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};
