// API for registering and managing FCM Push Notification tokens

export const ensurePushTokenTable = async (db: any) => {
  // 1. Create table if not exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, token)
    );
  `).run();

  // 2. Automated Migration: Check and add missing columns
  try {
    const { results } = await db.prepare("PRAGMA table_info(user_push_tokens)").all();
    const cols = results as any[];
    
    if (!cols.some(c => c.name === 'results_enabled')) {
      console.log("Migration: Adding column 'results_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN results_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'admin_enabled')) {
      console.log("Migration: Adding column 'admin_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN admin_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'admin_edit_enabled')) {
      console.log("Migration: Adding column 'admin_edit_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN admin_edit_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'timeline_like_enabled')) {
      console.log("Migration: Adding column 'timeline_like_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN timeline_like_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'timeline_comment_enabled')) {
      console.log("Migration: Adding column 'timeline_comment_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN timeline_comment_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'timeline_new_post_enabled')) {
      console.log("Migration: Adding column 'timeline_new_post_enabled' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN timeline_new_post_enabled INTEGER DEFAULT 1").run();
    }
    if (!cols.some(c => c.name === 'device_id')) {
      console.log("Migration: Adding column 'device_id' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN device_id TEXT").run();
    }
    if (!cols.some(c => c.name === 'device_name')) {
      console.log("Migration: Adding column 'device_name' to 'user_push_tokens' table...");
      await db.prepare("ALTER TABLE user_push_tokens ADD COLUMN device_name TEXT").run();
    }
  } catch (e: any) {
    console.error("FCM Token table migration check failed:", e.message);
  }
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    await ensurePushTokenTable(env.D1_DB);

    if (userId) {
      const { results } = await env.D1_DB.prepare(`
        SELECT user_id, platform, device_id, device_name, updated_at,
               results_enabled, admin_enabled, admin_edit_enabled, 
               timeline_like_enabled, timeline_comment_enabled, timeline_new_post_enabled,
               substr(token, 1, 16) || '...' as token_preview
        FROM user_push_tokens
        WHERE user_id = ?
        ORDER BY updated_at DESC
      `).bind(userId).all();

      return new Response(JSON.stringify({ devices: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { results } = await env.D1_DB.prepare(`
      SELECT upt.user_id, u.username, u.roblox_username, u.role,
             upt.platform, upt.device_id, upt.device_name, upt.updated_at,
             upt.results_enabled, upt.admin_enabled, upt.admin_edit_enabled, 
             upt.timeline_like_enabled, upt.timeline_comment_enabled, upt.timeline_new_post_enabled,
             substr(upt.token, 1, 16) || '...' as token_preview
      FROM user_push_tokens upt
      LEFT JOIN users u ON upt.user_id = u.id
      ORDER BY upt.updated_at DESC
    `).all();

    return new Response(JSON.stringify({ devices: results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { 
      userId, 
      token, 
      platform, 
      deviceId,
      deviceName,
      resultsEnabled, 
      adminEnabled, 
      adminEditEnabled,
      timelineLikeEnabled,
      timelineCommentEnabled,
      timelineNewPostEnabled
    } = body;

    if (!userId || !token || !platform) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensurePushTokenTable(env.D1_DB);

    const rEnabled = resultsEnabled === undefined || resultsEnabled === null ? 1 : (resultsEnabled ? 1 : 0);
    const aEnabled = adminEnabled === undefined || adminEnabled === null ? 1 : (adminEnabled ? 1 : 0);
    const aeEnabled = adminEditEnabled === undefined || adminEditEnabled === null ? 1 : (adminEditEnabled ? 1 : 0);
    const tlEnabled = timelineLikeEnabled === undefined || timelineLikeEnabled === null ? 1 : (timelineLikeEnabled ? 1 : 0);
    const tcEnabled = timelineCommentEnabled === undefined || timelineCommentEnabled === null ? 1 : (timelineCommentEnabled ? 1 : 0);
    const tnEnabled = timelineNewPostEnabled === undefined || timelineNewPostEnabled === null ? 1 : (timelineNewPostEnabled ? 1 : 0);

    // デバイス重複の排除:
    // 同一端末 (deviceId) または同一トークン (token) の古いレコードを削除して1端末=1レコードを保証。
    // ※ 同一ユーザーであっても別々の端末 (deviceIdが異なる実機：スマホとタブレット等) は削除されず、
    //    複数端末でそれぞれ個別に区別・維持され、同時にプッシュ通知を受信できます。
    if (deviceId) {
      await env.D1_DB.prepare(
        "DELETE FROM user_push_tokens WHERE device_id = ? OR token = ?"
      ).bind(deviceId, token).run();
    } else {
      await env.D1_DB.prepare(
        "DELETE FROM user_push_tokens WHERE token = ?"
      ).bind(token).run();
    }

    await env.D1_DB.prepare(`
      INSERT OR REPLACE INTO user_push_tokens (
        user_id, token, platform, device_id, device_name,
        results_enabled, admin_enabled, admin_edit_enabled, 
        timeline_like_enabled, timeline_comment_enabled, timeline_new_post_enabled, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(userId, token, platform, deviceId || null, deviceName || null, rEnabled, aEnabled, aeEnabled, tlEnabled, tcEnabled, tnEnabled).run();

    return new Response(JSON.stringify({ success: true, message: 'Push token registered successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { userId, token, deviceId } = body;

    if (!userId || (!token && !deviceId)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensurePushTokenTable(env.D1_DB);

    if (deviceId) {
      await env.D1_DB.prepare(
        "DELETE FROM user_push_tokens WHERE user_id = ? AND device_id = ?"
      ).bind(userId, deviceId).run();
    } else {
      await env.D1_DB.prepare(
        "DELETE FROM user_push_tokens WHERE user_id = ? AND token = ?"
      ).bind(userId, token).run();
    }

    return new Response(JSON.stringify({ success: true, message: 'Push token unregistered successfully' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
