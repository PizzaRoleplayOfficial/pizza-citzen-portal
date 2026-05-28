// API for Timeline Comments (Replies) Management
// Path: functions/api/timeline-comments.ts
import { sendFcmNotificationToUser } from '../utils/fcm';

const ensureCommentsTable = async (db: any) => {
  console.log("Ensuring timeline comments database schema is up-to-date...");
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
    CREATE TABLE IF NOT EXISTS timeline_comment_likes (
      comment_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (comment_id, user_id)
    );
  `).run();
  console.log("Timeline comments database schema check complete.");
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId') || '';
  const userId = url.searchParams.get('userId') || '';

  if (!postId) {
    return new Response(JSON.stringify({ error: "Missing postId" }), { status: 400 });
  }

  try {
    await ensureCommentsTable(env.D1_DB);

    // Fetch replies with author details, likes_count, and whether the current user liked it
    const query = `
      SELECT 
        c.id, 
        c.post_id, 
        c.user_id, 
        c.content, 
        c.created_at,
        u.username as author_username,
        u.avatar as author_avatar,
        u.roblox_username as author_roblox_username,
        (SELECT COUNT(*) FROM timeline_comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
        (SELECT COUNT(*) FROM timeline_comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = ?) as is_liked
      FROM timeline_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `;

    const { results } = await env.D1_DB.prepare(query).bind(userId, postId).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  } catch (e: any) {
    console.error("Timeline Comments GET Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { postId, userId, content } = body;

    if (!postId || !userId || !content) {
      return new Response(JSON.stringify({ error: '投稿ID、ユーザーID、およびコメント内容は必須です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (content.length > 200) {
      return new Response(JSON.stringify({ error: 'コメントは最大200文字までです。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureCommentsTable(env.D1_DB);

    const id = crypto.randomUUID();
    
    await env.D1_DB.prepare(
      "INSERT INTO timeline_comments (id, post_id, user_id, content) VALUES (?, ?, ?, ?)"
    ).bind(id, postId, userId, content).run();

    try {
      // Send in-app & push notification to the author of the post (if not the same person)
      const post = await env.D1_DB.prepare("SELECT user_id, content FROM timeline_posts WHERE id = ?").bind(postId).first() as any;
      const commenter = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first() as any;
      if (post && commenter && post.user_id !== userId) {
        const preview = post.content.length > 20 ? post.content.substring(0, 20) + '...' : post.content;
        await sendFcmNotificationToUser(env, post.user_id, {
          title: '💬 タイムライン投稿への返信',
          body: `${commenter.username}さんがあなたの投稿「${preview}」に返信しました。`,
          channelId: 'timeline_comments_channel',
          data: { action: `timeline?postId=${postId}` }
        });
      }
    } catch (err) {
      console.error("Failed to send timeline reply notification:", err);
    }

    return new Response(JSON.stringify({ success: true, id }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Timeline Comments POST Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPatch = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { commentId, userId, action } = body;

    if (!commentId || !userId || !action) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    await ensureCommentsTable(env.D1_DB);

    if (action === 'like') {
      await env.D1_DB.prepare(
        "INSERT OR IGNORE INTO timeline_comment_likes (comment_id, user_id) VALUES (?, ?)"
      ).bind(commentId, userId).run();

      try {
        const comment = await env.D1_DB.prepare("SELECT user_id, content, post_id FROM timeline_comments WHERE id = ?").bind(commentId).first() as any;
        const liker = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first() as any;
        if (comment && liker && comment.user_id !== userId) {
          const preview = comment.content.length > 20 ? comment.content.substring(0, 20) + '...' : comment.content;
          await sendFcmNotificationToUser(env, comment.user_id, {
            title: '❤️ 返信コメントへのいいね',
            body: `${liker.username}さんがあなたの返信「${preview}」にいいねしました。`,
            channelId: 'timeline_likes_channel',
            data: { action: `timeline?postId=${comment.post_id}` }
          });
        }
      } catch (err) {
        console.error("Failed to send comment like notification:", err);
      }
    } else if (action === 'unlike') {
      await env.D1_DB.prepare(
        "DELETE FROM timeline_comment_likes WHERE comment_id = ? AND user_id = ?"
      ).bind(commentId, userId).run();
    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    console.error("Timeline Comments PATCH Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestDelete = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') || '';
  const userId = url.searchParams.get('userId') || '';

  if (!id || !userId) {
    return new Response(JSON.stringify({ error: "Missing comment ID or user ID" }), { status: 400 });
  }

  try {
    await ensureCommentsTable(env.D1_DB);

    const comment = await env.D1_DB.prepare("SELECT * FROM timeline_comments WHERE id = ?").bind(id).first() as any;
    if (!comment) {
      return new Response(JSON.stringify({ error: "Comment not found" }), { status: 404 });
    }

    const post = await env.D1_DB.prepare("SELECT user_id FROM timeline_posts WHERE id = ?").bind(comment.post_id).first() as any;
    const user = await env.D1_DB.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first() as any;

    const isCommentAuthor = comment.user_id === userId;
    const isPostAuthor = post && post.user_id === userId;
    const isAdmin = user && user.role === 'admin';

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    await env.D1_DB.prepare("DELETE FROM timeline_comments WHERE id = ?").bind(id).run();
    await env.D1_DB.prepare("DELETE FROM timeline_comment_likes WHERE comment_id = ?").bind(id).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    console.error("Timeline Comments DELETE Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
