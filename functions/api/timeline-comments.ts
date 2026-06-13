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

  // Dynamically alter table to add columns if they don't exist
  try {
    const tableInfo = await db.prepare("PRAGMA table_info(timeline_comments)").all();
    const columns = tableInfo.results.map((col: any) => col.name);
    
    if (!columns.includes('parent_id')) {
      console.log("Adding parent_id column to timeline_comments table...");
      await db.prepare("ALTER TABLE timeline_comments ADD COLUMN parent_id TEXT").run();
    }
    if (!columns.includes('image_data')) {
      console.log("Adding image_data column to timeline_comments table...");
      await db.prepare("ALTER TABLE timeline_comments ADD COLUMN image_data TEXT").run();
    }
    if (!columns.includes('video_path')) {
      console.log("Adding video_path column to timeline_comments table...");
      await db.prepare("ALTER TABLE timeline_comments ADD COLUMN video_path TEXT").run();
    }
    if (!columns.includes('views_count')) {
      console.log("Adding views_count column to timeline_comments table...");
      await db.prepare("ALTER TABLE timeline_comments ADD COLUMN views_count INTEGER DEFAULT 0").run();
    }

    // Ensure no NULL views_count values exist (safely migrate any existing legacy rows)
    await db.prepare("UPDATE timeline_comments SET views_count = 0 WHERE views_count IS NULL").run();
  } catch (err: any) {
    console.error("Error checking/adding columns to timeline_comments:", err.message);
  }

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

    const query = `
      SELECT 
        c.id, 
        c.post_id, 
        c.user_id, 
        c.content, 
        c.created_at,
        c.parent_id,
        c.image_data,
        c.video_path,
        c.views_count,
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
    
    // Transform base64 image data to proxy URLs
    const optimizedResults = results.map((row: any) => {
      if (row.image_data) {
        try {
          const imgs = JSON.parse(row.image_data);
          if (Array.isArray(imgs)) {
            row.image_data = JSON.stringify(
              imgs.map((_, idx) => `/api/timeline-image?postId=${row.id}&index=${idx}`)
            );
          } else {
            row.image_data = JSON.stringify([`/api/timeline-image?postId=${row.id}&index=0`]);
          }
        } catch (e) {
          row.image_data = JSON.stringify([`/api/timeline-image?postId=${row.id}&index=0`]);
        }
      }
      return row;
    });
    
    return new Response(JSON.stringify(optimizedResults), {
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
    const { postId, userId, content, parentId, image_data, video_path } = body;

    if (!postId || !userId || (!content && !image_data && !video_path)) {
      return new Response(JSON.stringify({ error: '投稿ID、ユーザーID、およびコメント内容（またはメディア）は必須です。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (content && content.length > 200) {
      return new Response(JSON.stringify({ error: 'コメントは最大200文字までです。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await ensureCommentsTable(env.D1_DB);

    const id = crypto.randomUUID();
    
    await env.D1_DB.prepare(
      "INSERT INTO timeline_comments (id, post_id, user_id, content, parent_id, image_data, video_path) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, postId, userId, content || "", parentId || null, image_data || null, video_path || null).run();

    try {
      const commenter = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(userId).first() as any;
      if (commenter) {
        let notifiedUser = null;
        let notificationTitle = '💬 タイムライン投稿への返信';
        let notificationBody = '';

        if (parentId) {
          // If replying to a comment, notify the parent comment owner
          const parentComment = await env.D1_DB.prepare("SELECT user_id, content FROM timeline_comments WHERE id = ?").bind(parentId).first() as any;
          if (parentComment && parentComment.user_id !== userId) {
            notifiedUser = parentComment.user_id;
            notificationTitle = '💬 返信への新たな返信';
            const preview = parentComment.content.length > 20 ? parentComment.content.substring(0, 20) + '...' : parentComment.content;
            notificationBody = `${commenter.username}さんがあなたの返信「${preview}」に返信しました。`;
          }
        }

        // Fallback to post owner if first-level comment or parent comment author is themselves
        if (!notifiedUser) {
          const post = await env.D1_DB.prepare("SELECT user_id, content FROM timeline_posts WHERE id = ?").bind(postId).first() as any;
          if (post && post.user_id !== userId) {
            notifiedUser = post.user_id;
            const preview = post.content.length > 20 ? post.content.substring(0, 20) + '...' : post.content;
            notificationBody = `${commenter.username}さんがあなたの投稿「${preview}」に返信しました。`;
          }
        }

        if (notifiedUser) {
          await sendFcmNotificationToUser(env, notifiedUser, {
            title: notificationTitle,
            body: notificationBody,
            channelId: 'timeline_comments_channel',
            data: { action: `timeline?postId=${postId}` }
          });
        }
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
    } else if (action === 'view') {
      await env.D1_DB.prepare(
        "UPDATE timeline_comments SET views_count = COALESCE(views_count, 0) + 1 WHERE id = ?"
      ).bind(commentId).run();
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
