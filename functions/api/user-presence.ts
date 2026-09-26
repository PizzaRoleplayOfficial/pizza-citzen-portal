// Path: functions/api/user-presence.ts
// Handles real-time active device presence (PC/Web vs Mobile) to avoid redundant push notifications

const NO_CACHE = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

const ensurePresenceTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      last_active_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, platform)
    );
  `).run();
};

export const onRequestPost = async ({ env, request }: { env: any; request: Request }) => {
  try {
    const body = await request.json().catch(() => ({})) as any;
    const { userId, platform = 'web', status = 'online' } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), { status: 400, headers: NO_CACHE });
    }

    // ensurePresenceTable skipped on ping for performance

    if (status === 'offline') {
      // Mark as inactive immediately
      await env.D1_DB.prepare(`
        INSERT INTO user_presence (user_id, platform, last_active_at)
        VALUES (?, ?, datetime('now', '-10 minutes'))
        ON CONFLICT(user_id, platform) DO UPDATE SET last_active_at = datetime('now', '-10 minutes')
      `).bind(userId, platform).run();
    } else {
      // Mark active
      await env.D1_DB.prepare(`
        INSERT INTO user_presence (user_id, platform, last_active_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, platform) DO UPDATE SET last_active_at = CURRENT_TIMESTAMP
      `).bind(userId, platform).run();
    }

    return new Response(JSON.stringify({ success: true }), { headers: NO_CACHE });
  } catch (err: any) {
    console.error('user-presence error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: NO_CACHE });
  }
};
