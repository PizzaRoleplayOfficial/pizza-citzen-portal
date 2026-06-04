// API for retrieving trending hashtags
// Path: functions/api/timeline/trends.ts
import { ensureTimelineTables } from '../timeline';

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const db = env.D1_DB;
    await ensureTimelineTables(db);

    // Fetch posts from the last 3 days (72 hours) to aggregate trends
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const query = "SELECT content FROM timeline_posts WHERE created_at > ? AND repost_id IS NULL";
    const { results } = await db.prepare(query).bind(threeDaysAgo).all();

    const counts: Record<string, number> = {};

    for (const post of results as any[]) {
      if (!post.content) continue;
      // Regex to match hashtags (starting with # followed by non-whitespace/non-hash chars)
      const hashtags = post.content.match(/#[^\s#]+/g);
      if (hashtags) {
        for (const tag of hashtags) {
          const cleanedTag = tag.trim();
          if (cleanedTag.length > 1) {
            counts[cleanedTag] = (counts[cleanedTag] || 0) + 1;
          }
        }
      }
    }

    // Sort trends and format output
    const trends = Object.entries(counts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return new Response(JSON.stringify(trends), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60' // Cache for 60 seconds
      }
    });
  } catch (e: any) {
    console.error("Timeline Trends Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
