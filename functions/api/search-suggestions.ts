// API for retrieving search autocomplete suggestions (Users & Keywords)
// Path: functions/api/search-suggestions.ts

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q') || '';

  if (!query || query.trim().length < 1) {
    return new Response(JSON.stringify({ users: [], keywords: [] }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
      }
    });
  }

  try {
    const db = env.D1_DB;
    const cleanQuery = `%${query.trim()}%`;

    // 1. Search matching users (citizens)
    const { results: users } = await db.prepare(
      "SELECT id, username, roblox_username, avatar FROM users WHERE username LIKE ? OR roblox_username LIKE ? LIMIT 5"
    ).bind(cleanQuery, cleanQuery).all();

    // 2. Search matching posts to suggest keywords/tags
    const { results: posts } = await db.prepare(
      "SELECT content FROM timeline_posts WHERE content LIKE ? LIMIT 10"
    ).bind(cleanQuery).all();

    // Extract suggested search terms from matching posts:
    const keywordsSet = new Set<string>();
    
    // Always include the query itself
    keywordsSet.add(query.trim());

    for (const post of posts as any[]) {
      // Find hashtags in content
      const hashtags = post.content.match(/#[^\s#]+/g);
      if (hashtags) {
        for (const tag of hashtags) {
          if (tag.toLowerCase().includes(query.toLowerCase())) {
            keywordsSet.add(tag);
          }
        }
      }
      
      // Extract short sentences/phrases (under 25 chars) that contain the query
      const sentences = post.content.split(/[。\n]/);
      for (const s of sentences) {
        const trimmed = s.trim();
        if (trimmed.length > query.length && trimmed.length < 25 && trimmed.toLowerCase().includes(query.toLowerCase())) {
          keywordsSet.add(trimmed);
        }
      }
    }

    const keywords = Array.from(keywordsSet).slice(0, 5);

    return new Response(JSON.stringify({ users, keywords }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10' // Slight caching to save D1 load
      }
    });
  } catch (e: any) {
    console.error("Search suggestions API error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
