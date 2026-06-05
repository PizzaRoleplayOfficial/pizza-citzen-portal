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
    
    // Ensure no NULL views_count values exist (safely migrate any existing legacy rows)
    await db.prepare("UPDATE timeline_posts SET views_count = 0 WHERE views_count IS NULL").run();

    const hasVideoPath = tableInfo.results.some((col: any) => col.name === 'video_path');
    if (!hasVideoPath) {
      console.log("Adding video_path column to timeline_posts table...");
      await db.prepare("ALTER TABLE timeline_posts ADD COLUMN video_path TEXT").run();
    }

    const hasRepostId = tableInfo.results.some((col: any) => col.name === 'repost_id');
    if (!hasRepostId) {
      console.log("Adding repost_id column to timeline_posts table...");
      await db.prepare("ALTER TABLE timeline_posts ADD COLUMN repost_id TEXT").run();
    }
  } catch (err: any) {
    console.error("Error checking/adding columns:", err.message);
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

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_polls (
      post_id TEXT PRIMARY KEY,
      options TEXT NOT NULL,
      expires_at DATETIME NOT NULL
    );
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_poll_votes (
      user_id TEXT,
      post_id TEXT,
      option_index INTEGER,
      PRIMARY KEY (user_id, post_id)
    );
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_pins (
      user_id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL
    );
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS timeline_bookmarks (
      user_id TEXT,
      post_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, post_id)
    );
  `).run();

  console.log("Timeline database schema check complete.");
};

export { ensureTimelineTables };

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId') || '';

  try {
    await ensureTimelineTables(env.D1_DB);

    const postId = url.searchParams.get('postId') || '';
    
    let query = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_data, 
        p.video_path,
        p.created_at,
        p.views_count,
        p.repost_id,
        u.username as author_username,
        u.avatar as author_avatar,
        u.roblox_username as author_roblox_username,
        -- Original post joined fields
        orig.content as orig_content,
        orig.image_data as orig_image_data,
        orig.video_path as orig_video_path,
        orig.created_at as orig_created_at,
        orig_u.id as orig_author_id,
        orig_u.username as orig_author_username,
        orig_u.avatar as orig_author_avatar,
        orig_u.roblox_username as orig_author_roblox_username,
        orig.views_count as orig_views_count,
        -- Counts and statuses (uses original post ID if it's a repost)
        (SELECT COUNT(*) FROM timeline_likes WHERE post_id = COALESCE(p.repost_id, p.id)) as likes_count,
        (SELECT COUNT(*) FROM timeline_comments WHERE post_id = COALESCE(p.repost_id, p.id)) as comments_count,
        (SELECT COUNT(*) FROM timeline_posts WHERE repost_id = COALESCE(p.repost_id, p.id)) as reposts_count,
        CASE WHEN EXISTS (
          SELECT 1 FROM timeline_likes WHERE post_id = COALESCE(p.repost_id, p.id) AND user_id = ?
        ) THEN 1 ELSE 0 END as is_liked,
        CASE WHEN EXISTS (
          SELECT 1 FROM timeline_posts WHERE repost_id = COALESCE(p.repost_id, p.id) AND user_id = ?
        ) THEN 1 ELSE 0 END as is_reposted,
        CASE WHEN EXISTS (
          SELECT 1 FROM timeline_bookmarks WHERE post_id = COALESCE(p.repost_id, p.id) AND user_id = ?
        ) THEN 1 ELSE 0 END as is_bookmarked,
        -- Pinned status
        CASE WHEN pin.post_id IS NOT NULL THEN 1 ELSE 0 END as is_pinned,
        -- Poll data
        poll.options as poll_options,
        poll.expires_at as poll_expires_at,
        (SELECT option_index FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id) AND user_id = ?) as user_voted_option,
        (SELECT COUNT(*) FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id)) as poll_total_votes,
        (SELECT COUNT(*) FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id) AND option_index = 0) as poll_option_0_votes,
        (SELECT COUNT(*) FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id) AND option_index = 1) as poll_option_1_votes,
        (SELECT COUNT(*) FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id) AND option_index = 2) as poll_option_2_votes,
        (SELECT COUNT(*) FROM timeline_poll_votes WHERE post_id = COALESCE(p.repost_id, p.id) AND option_index = 3) as poll_option_3_votes
      FROM timeline_posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN timeline_posts orig ON p.repost_id = orig.id
      LEFT JOIN users orig_u ON orig.user_id = orig_u.id
      LEFT JOIN timeline_pins pin ON pin.post_id = p.id AND pin.user_id = p.user_id
      LEFT JOIN timeline_polls poll ON poll.post_id = COALESCE(p.repost_id, p.id)
    `;

    const feed = url.searchParams.get('feed') || 'all';
    
    const conditions: string[] = [];
    const bindParams: any[] = [userId, userId, userId, userId];

    if (postId) {
      conditions.push("p.id = ?");
      bindParams.push(postId);
    } else if (feed === 'following') {
      conditions.push("p.user_id IN (SELECT following_id FROM follows WHERE follower_id = ?)");
      bindParams.push(userId);
    } else if (feed === 'bookmarks') {
      conditions.push("p.id IN (SELECT post_id FROM timeline_bookmarks WHERE user_id = ?)");
      bindParams.push(userId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY p.created_at DESC";

    const stmt = await env.D1_DB.prepare(query).bind(...bindParams).all();
    const results = stmt.results;
    
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
    const { userId, content, image_data, video_path, repostId, poll } = body;

    if (!userId || (!content && !repostId)) {
      return new Response(JSON.stringify({ error: 'ユーザーIDと投稿内容、またはリポスト対象IDが必要です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (content && content.length > 280) {
      return new Response(JSON.stringify({ error: '投稿内容は最大280文字までです。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureTimelineTables(env.D1_DB);

    const id = crypto.randomUUID();
    const initialViews = 0; // Starts with 0 views
    
    await env.D1_DB.prepare(
      "INSERT INTO timeline_posts (id, user_id, content, image_data, views_count, video_path, repost_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, userId, content || "", image_data || null, initialViews, video_path || null, repostId || null).run();

    // Insert poll if option data is provided
    if (poll && Array.isArray(poll.options) && poll.options.length >= 2) {
      const durationMinutes = poll.durationMinutes || 1440; // Default 1 day (1440 mins)
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
      const optionsArray = poll.options.map((opt: string) => ({ text: opt }));
      
      await env.D1_DB.prepare(
        "INSERT INTO timeline_polls (post_id, options, expires_at) VALUES (?, ?, ?)"
      ).bind(id, JSON.stringify(optionsArray), expiresAt).run();
    }

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
    await env.D1_DB.prepare("DELETE FROM timeline_polls WHERE post_id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_poll_votes WHERE post_id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_pins WHERE post_id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_bookmarks WHERE post_id = ?").bind(id).run();

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
      // Check if this user has already viewed this post
      const existing = await env.D1_DB.prepare(
        "SELECT 1 FROM timeline_views WHERE post_id = ? AND user_id = ?"
      ).bind(postId, userId).first();

      if (!existing) {
        // Insert view record uniquely
        await env.D1_DB.prepare(
          "INSERT OR IGNORE INTO timeline_views (post_id, user_id) VALUES (?, ?)"
        ).bind(postId, userId).run();

        // Increment the post views count (safely using COALESCE)
        await env.D1_DB.prepare(
          "UPDATE timeline_posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ?"
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
