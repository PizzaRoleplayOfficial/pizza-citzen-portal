// API for Bookmarking timeline posts
// Path: functions/api/timeline/bookmark.ts
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

    if (action === 'bookmark') {
      await db.prepare(
        "INSERT OR IGNORE INTO timeline_bookmarks (user_id, post_id) VALUES (?, ?)"
      ).bind(userId, postId).run();

      return new Response(JSON.stringify({ success: true, bookmarked: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (action === 'unbookmark') {
      await db.prepare(
        "DELETE FROM timeline_bookmarks WHERE user_id = ? AND post_id = ?"
      ).bind(userId, postId).run();

      return new Response(JSON.stringify({ success: true, bookmarked: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (e: any) {
    console.error("Timeline Bookmark Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
