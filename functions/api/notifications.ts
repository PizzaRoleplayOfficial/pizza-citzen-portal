// API for Notifications Management
// Path: functions/api/notifications.ts
import { ensureAllD1Indexes, getEdgeCachedJson, invalidateUserNotifCache } from '../utils/d1Optimizer';

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

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const session = getUserSession(request);
  const url = new URL(request.url);
  const userId = session?.id || url.searchParams.get('userId') || '';

  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing user ID or unauthorized" }), { status: 401, headers: NO_CACHE });
  }

  try {
    await ensureAllD1Indexes(env.D1_DB);

    const payload = await getEdgeCachedJson(`notifs:${userId}`, 15, async () => {
      // 1. Fetch latest 40 notifications using idx_notifications_user_created
      const { results: rawNotifications } = await env.D1_DB.prepare(`
        SELECT * FROM notifications 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 40
      `).bind(userId).all();

      const notifications: any[] = Array.isArray(rawNotifications) ? [...rawNotifications] : [];

      // 2. Only check pending vehicles if there are actually unread vehicle admin notifications
      const unreadVehicleNotifs = notifications.filter((n: any) =>
        n.is_read === 0 &&
        (n.type === 'admin_notifications_channel' ||
         n.type === 'admin_edit_notifications_channel' ||
         (n.title && (
           n.title.includes('新規車両登録') ||
           n.title.includes('新規トレーラー') ||
           n.title.includes('車両編集') ||
           n.title.includes('トレーラー編集')
         )))
      );

      if (unreadVehicleNotifs.length > 0) {
        try {
          const { results: pendingRows } = await env.D1_DB.prepare(
            "SELECT REPLACE(REPLACE(LOWER(TRIM(plate)), ' ', ''), '-', '') as p FROM vehicles WHERE status = 'pending'"
          ).all();
          const pendingSet = new Set((pendingRows || []).map((r: any) => r.p));

          const handledIds: string[] = [];
          for (const row of unreadVehicleNotifs) {
            const m = (row.body || '').match(/ナンバー[:：]\s*([^)）]+)[)）]/);
            if (m) {
              const cleanPlate = m[1].replace(/[\s\-]/g, '').toLowerCase().trim();
              if (!pendingSet.has(cleanPlate)) {
                handledIds.push(row.id);
                row.is_read = 1;
              }
            }
          }

          if (handledIds.length > 0) {
            const placeholders = handledIds.map(() => '?').join(',');
            await env.D1_DB.prepare(
              `UPDATE notifications SET is_read = 1 WHERE id IN (${placeholders})`
            ).bind(...handledIds).run();
          }
        } catch (cleanErr) {
          console.error("Auto-mark handled vehicle notifications failed:", cleanErr);
        }
      }

      // 3. Only check DM unread state if there is actually an unread dm_messages_channel notification
      const hasUnreadDmNotif = notifications.some(
        (n: any) => n.is_read === 0 && n.type === 'dm_messages_channel'
      );

      if (hasUnreadDmNotif) {
        try {
          const hasUnreadDmMsg = await env.D1_DB.prepare(
            "SELECT 1 FROM dm_messages WHERE recipient_id = ? AND is_read = 0 LIMIT 1"
          ).bind(userId).first();

          if (!hasUnreadDmMsg) {
            await env.D1_DB.prepare(
              "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0 AND type = 'dm_messages_channel'"
            ).bind(userId).run();
            for (const n of notifications) {
              if (n.type === 'dm_messages_channel') n.is_read = 1;
            }
          }
        } catch (dmSyncErr) {
          console.error("Auto-sync DM notifications read state failed:", dmSyncErr);
        }
      }

      // 4. Compute unreadCount without extra query when total notifications < 40
      let unreadCount = 0;
      if (notifications.length < 40) {
        unreadCount = notifications.filter((n: any) => n.is_read === 0).length;
      } else {
        const unread = await env.D1_DB.prepare(
          "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0"
        ).bind(userId).first() as any;
        unreadCount = unread?.count || 0;
      }

      return {
        notifications,
        unreadCount
      };
    });

    return new Response(JSON.stringify(payload), { headers: NO_CACHE });
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

    if (markAll) {
      await env.D1_DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0"
      ).bind(userId).run();
    } else if (id) {
      await env.D1_DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
      ).bind(id, userId).run();
    } else {
      return new Response(JSON.stringify({ error: "Missing parameter 'id' or 'markAll'" }), { status: 400, headers: NO_CACHE });
    }

    await invalidateUserNotifCache(userId);

    return new Response(JSON.stringify({ success: true }), { headers: NO_CACHE });
  } catch (e: any) {
    console.error("Notifications POST/Patch Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};
