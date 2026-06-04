// API for Voting in Polls
// Path: functions/api/timeline/vote.ts
import { ensureTimelineTables } from '../timeline';

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const body = await request.json() as any;
    const { userId, postId, optionIndex } = body;

    if (!userId || !postId || optionIndex === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = env.D1_DB;
    await ensureTimelineTables(db);

    // 1. Check if poll exists and is not expired
    const poll = await db.prepare("SELECT expires_at FROM timeline_polls WHERE post_id = ?").bind(postId).first() as any;
    if (!poll) {
      return new Response(JSON.stringify({ error: 'アンケートが見つかりません。' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date().toISOString();
    if (poll.expires_at < now) {
      return new Response(JSON.stringify({ error: 'このアンケートの投票期限は終了しました。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Insert or replace vote
    await db.prepare(
      "INSERT OR REPLACE INTO timeline_poll_votes (user_id, post_id, option_index) VALUES (?, ?, ?)"
    ).bind(userId, postId, optionIndex).run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error("Timeline Vote Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
