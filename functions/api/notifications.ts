// API for Notifications Management
// Path: functions/api/notifications.ts

const getUserSession = (request: Request) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader
    ? Object.fromEntries(cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      }))
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
    // ensureNotificationsTable skipped on GET for performance

    // Auto-mark handled vehicle application notifications as read (最適化済み: 全件スキャン排除)
    try {
      const { results: unreadVehicleNotifs } = await env.D1_DB.prepare(`
        SELECT id, body FROM notifications 
        WHERE user_id = ? AND is_read = 0 
          AND (type IN ('admin_notifications_channel', 'admin_edit_notifications_channel') 
               OR title LIKE '%新規車両登録%' OR title LIKE '%新規トレーラー%' OR title LIKE '%車両編集%' OR title LIKE '%トレーラー編集%')
        LIMIT 20
      `).bind(userId).all();

      if (unreadVehicleNotifs && unreadVehicleNotifs.length > 0) {
        // Query pending plates in 1 single fast query instead of looping table scans
        const { results: pendingRows } = await env.D1_DB.prepare(
          "SELECT REPLACE(REPLACE(LOWER(TRIM(plate)), ' ', ''), '-', '') as p FROM vehicles WHERE status = 'pending'"
        ).all();
        const pendingSet = new Set((pendingRows || []).map((r: any) => r.p));

        const handledIds: string[] = [];
        for (const row of unreadVehicleNotifs as any[]) {
          const m = (row.body || '').match(/ナンバー[:：]\s*([^)）]+)[)）]/);
          if (m) {
            const cleanPlate = m[1].replace(/[\s\-]/g, '').toLowerCase().trim();
            if (!pendingSet.has(cleanPlate)) {
              handledIds.push(row.id);
            }
          }
        }

        if (handledIds.length > 0) {
          const placeholders = handledIds.map(() => '?').join(',');
          await env.D1_DB.prepare(
            `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`
          ).bind(...handledIds).run();
        }
      }
    } catch (cleanErr) {
      console.error("Auto-mark handled vehicle notifications failed:", cleanErr);
    }

    // Auto-mark DM notifications as read if all DM messages are read
    try {
      const unreadDm = await env.D1_DB.prepare(
        "SELECT COUNT(*) as count FROM dm_messages WHERE recipient_id = ? AND is_read = 0"
      ).bind(userId).first() as any;

      if (unreadDm && unreadDm.count === 0) {
        await env.D1_DB.prepare(
          "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND type = 'dm_messages_channel'"
        ).bind(userId).run();
      }
    } catch (dmSyncErr) {
      console.error("Auto-sync DM notifications read state failed:", dmSyncErr);
    }

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

    // ensureNotificationsTable skipped on GET for performance

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
