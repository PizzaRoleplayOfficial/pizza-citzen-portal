// functions/api/profile.ts
const ensureProfileSchema = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS follows (
      follower_id TEXT,
      following_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (follower_id, following_id)
    );
  `).run();

  try {
    await db.prepare("ALTER TABLE users ADD COLUMN bio TEXT").run();
  } catch (e) {}
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const viewerId = url.searchParams.get('viewerId');
  const type = url.searchParams.get('type'); // 'following' or 'followers'

  if (!userId) {
    return new Response("Missing userId", { status: 400 });
  }

  try {
    const db = env.D1_DB;
    await ensureProfileSchema(db);

    if (type === 'following') {
      const query = `
        SELECT u.id, u.username, u.avatar, u.roblox_username 
        FROM follows f 
        JOIN users u ON f.following_id = u.id 
        WHERE f.follower_id = ?
        ORDER BY f.created_at DESC
      `;
      const { results } = await db.prepare(query).bind(userId).all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (type === 'followers') {
      const query = `
        SELECT u.id, u.username, u.avatar, u.roblox_username 
        FROM follows f 
        JOIN users u ON f.follower_id = u.id 
        WHERE f.following_id = ?
        ORDER BY f.created_at DESC
      `;
      const { results } = await db.prepare(query).bind(userId).all();
      return new Response(JSON.stringify(results), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Get Bio from users table
    const user = await db.prepare("SELECT bio FROM users WHERE id = ?").bind(userId).first();
    const bio = user ? (user.bio || null) : null;

    // 2. Get Following Count
    const { count: followingCount } = await db.prepare("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?").bind(userId).first() || { count: 0 };

    // 3. Get Follower Count
    const { count: followerCount } = await db.prepare("SELECT COUNT(*) as count FROM follows WHERE following_id = ?").bind(userId).first() || { count: 0 };

    // 4. Check if viewer is following this user
    let isFollowing = false;
    // 5. Check if user is following the viewer (isFollower)
    let isFollower = false;
    if (viewerId) {
      const followRecord = await db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?").bind(viewerId, userId).first();
      isFollowing = !!followRecord;

      const followerRecord = await db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?").bind(userId, viewerId).first();
      isFollower = !!followerRecord;
    }

    return new Response(JSON.stringify({
      bio,
      followingCount,
      followerCount,
      isFollowing,
      isFollower
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const db = env.D1_DB;
    await ensureProfileSchema(db);

    const body = await request.json() as any;
    const { action } = body;

    if (action === 'follow' || action === 'unfollow') {
      const { followerId, followingId } = body;
      if (!followerId || !followingId) {
        return new Response("Missing followerId or followingId", { status: 400 });
      }

      if (action === 'follow') {
        await db.prepare("INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)").bind(followerId, followingId).run();
        
        // Fetch follower's username to build notification body
        const follower = await db.prepare("SELECT username FROM users WHERE id = ?").bind(followerId).first();
        const followerName = follower ? follower.username : "新しい市民";

        // Insert notification record to database notifications table
        const notificationId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
        await db.prepare(`
          INSERT INTO notifications (id, user_id, title, body, type, link_action) 
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          notificationId,
          followingId, // The followed user receiving the notification
          "新しいフォロワー",
          `${followerName}さんにフォローされました！`,
          "follow",
          "timeline"
        ).run();
      } else {
        await db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?").bind(followerId, followingId).run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (action === 'update_bio') {
      const { userId, bio } = body;
      if (!userId) {
        return new Response("Missing userId", { status: 400 });
      }

      await db.prepare("UPDATE users SET bio = ? WHERE id = ?").bind(bio || null, userId).run();

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response("Invalid action", { status: 400 });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};
