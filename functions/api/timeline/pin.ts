// API for Pinning/Unpinning posts to profile
// Path: functions/api/timeline/pin.ts
import { ensureTimelineTables } from '../timeline';

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { userId, postId, action } = body;

    if (!userId || !postId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.D1_DB;
    await ensureTimelineTables(db);

    if (action === 'pin') {
      // Authorization: Verify the post belongs to the user pinning it
      const post = await db.prepare("SELECT user_id FROM timeline_posts WHERE id = ?").bind(postId).first() as any;
      if (!post) {
        return new Response(JSON.stringify({ error: '投稿が見つかりません。' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (post.user_id !== userId) {
        return new Response(JSON.stringify({ error: '他人の投稿を固定することはできません。' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Pin the post (each user can have at most one pinned post, due to user_id being PRIMARY KEY)
      await db.prepare(
        "INSERT OR REPLACE INTO timeline_pins (user_id, post_id) VALUES (?, ?)"
      ).bind(userId, postId).run();

      return new Response(JSON.stringify({ success: true, pinned: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'unpin') {
      // Unpin the post
      await db.prepare(
        "DELETE FROM timeline_pins WHERE user_id = ? AND post_id = ?"
      ).bind(userId, postId).run();

      return new Response(JSON.stringify({ success: true, pinned: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e: any) {
    console.error("Timeline Pin Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
