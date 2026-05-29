// API for Timeline (Twitter-like SNS) Management
// Path: functions/api/timeline.ts
import { sendFcmNotificationToUser } from '../utils/fcm';

const ensureTimelineTables = async (db: any) => {
  console.log("Ensuring timeline database schema is up-to-date...");
  
  // 1. Create tables if they do not exist
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      image_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  // Dynamically add views_count column if it doesn't exist
  try {
    const tableInfo = await db.prepare("PRAGMA table_info(timeline_posts)").all();
    const hasViewsCount = tableInfo.results.some((col: any) => col.name === 'views_count');
    if (!hasViewsCount) {
      console.log("Adding views_count column to timeline_posts table...");
      await db.prepare("ALTER TABLE timeline_posts ADD COLUMN views_count INTEGER DEFAULT 0").run();
    }
  } catch (err: any) {
    console.error("Error checking/adding views_count column:", err.message);
  }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_likes (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_views (
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
  `).run();

  console.log("Timeline database schema check complete.");
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '';

  try {
    await ensureTimelineTables(env.D1_DB);

    // Fetch posts with author info, views_count and likes stats
    // We join with the users table to get the up-to-date avatar, username, and roblox_username.
    const query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_data, 
        p.created_at,
        p.views_count,
        u.username as author_username,
        u.avatar as author_avatar,
        u.roblox_username as author_roblox_username,
        (SELECT COUNT(*) FROM timeline_likes WHERE post_id = p.id) as likes_count,
        (SELECT COUNT(*) FROM timeline_comments WHERE post_id = p.id) as comments_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM timeline_likes WHERE post_id = p.id AND user_id = ?
        ) THEN 1 ELSE 0 END as is_liked
      FROM timeline_posts p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `;

    const { results } = await env.D1_DB.prepare(query).bind(userId).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e: any) {
    console.error("Timeline GET Error:", e.message);
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { userId, content, image_data } = body;

    if (!userId || !content) {
      return new Response(JSON.stringify({ error: 'ユーザーIDと投稿内容は必須です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (content.length > 280) {
      return new Response(JSON.stringify({ error: '投稿内容は最大280文字までです。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureTimelineTables(env.D1_DB);

    const id = crypto.randomUUID();
    const initialViews = Math.floor(Math.random() * 40) + 12; // 12 to 51 random views
    
    await env.D1_DB.prepare(
      "INSERT INTO timeline_posts (id, user_id, content, image_data, views_count) VALUES (?, ?, ?, ?, ?)"
    ).bind(id, userId, content, image_data || null, initialViews).run();

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Timeline POST Error:", e.message);
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const userId = url.searchParams.get('userId');

  if (!id || !userId) {
    return new Response(JSON.stringify({ error: "Missing ID or user ID" }), { status: 400 });
  }

  try {
    await ensureTimelineTables(env.D1_DB);

    // Authorization check: Must be the post author or an administrator
    const post = await env.D1_DB.prepare("SELECT user_id FROM timeline_posts WHERE id = ?").bind(id).first() as any;
    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), { status: 404 });
    }

    const user = await env.D1_DB.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first() as any;
    const isAdmin = user && user.role === 'admin';
    const isAuthor = post.user_id === userId;

    if (!isAuthor && !isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // Delete post, its likes and its comments cascade-style (since we manage it manually)
    await env.D1_DB.prepare("DELETE FROM timeline_posts WHERE id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_likes WHERE post_id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_comments WHERE post_id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Timeline DELETE Error:", e.message);
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPatch = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { postId, userId, action } = body;

    if (!postId || !userId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureTimelineTables(env.D1_DB);

    if (action === 'like') {
      await env.D1_DB.prepare(
        "INSERT OR IGNORE INTO timeline_likes (post_id, user_id) VALUES (?, ?)"
      ).bind(postId, userId).run();

      try {
        // Send in-app & push notification to the author of the post (if not the same person)
        const post = await env.D1_DB.prepare("SELECT user_id, content FROM timeline_posts WHERE id = ?").bind(postId).first() as any;
        const liker = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first() as any;
        if (post && liker && post.user_id !== userId) {
          const preview = post.content.length > 20 ? post.content.substring(0, 20) + '...' : post.content;
          await sendFcmNotificationToUser(env, post.user_id, {
            title: '❤️ タイムライン投稿へのいいね',
            body: `${liker.username}さんがあなたの投稿「${preview}」にいいねしました。`,
            channelId: 'timeline_likes_channel',
            data: { action: `timeline?postId=${postId}` }
          });
        }
      } catch (err) {
        console.error("Failed to send timeline like notification:", err);
      }
    } else if (action === 'unlike') {
      await env.D1_DB.prepare(
        "DELETE FROM timeline_likes WHERE post_id = ? AND user_id = ?"
      ).bind(postId, userId).run();
    } else if (action === 'view') {
      const result = await env.D1_DB.prepare(
        "INSERT OR IGNORE INTO timeline_views (post_id, user_id) VALUES (?, ?)"
      ).bind(postId, userId).run();
      
      if (result.meta?.changes > 0) {
        await env.D1_DB.prepare(
          "UPDATE timeline_posts SET views_count = views_count + 1 WHERE id = ?"
        ).bind(postId).run();
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Timeline PATCH (Like) Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
