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
  } catch (e: any) {
    console.error("FCM Token table migration check failed:", e.message);
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

    // デバイス重複の排除 (同じデバイスID、または古いトークンのレコードを事前削除)
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
        user_id, token, platform, device_id,
        results_enabled, admin_enabled, admin_edit_enabled, 
        timeline_like_enabled, timeline_comment_enabled, timeline_new_post_enabled, 
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(userId, token, platform, deviceId || null, rEnabled, aEnabled, aeEnabled, tlEnabled, tcEnabled, tnEnabled).run();

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
    const { userId, token } = body;

    if (!userId || !token) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensurePushTokenTable(env.D1_DB);

    await env.D1_DB.prepare(
      "DELETE FROM user_push_tokens WHERE user_id = ? AND token = ?"
    ).bind(userId, token).run();

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
