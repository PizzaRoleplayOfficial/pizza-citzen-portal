// API for registering and managing FCM Push Notification tokens

export const ensurePushTokenTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_push_tokens (
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      platform TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, token)
    );
  `).run();
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { userId, token, platform } = body;

    if (!userId || !token || !platform) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensurePushTokenTable(env.D1_DB);

    await env.D1_DB.prepare(
      "INSERT OR REPLACE INTO user_push_tokens (user_id, token, platform, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
    ).bind(userId, token, platform).run();

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
