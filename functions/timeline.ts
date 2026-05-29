// Dynamic OGP (Open Graph Protocol) Injection Middleware for Timeline Posts
// Path: functions/timeline.ts

interface Env {
  D1_DB: any;
  ASSETS: {
    fetch: typeof fetch;
  };
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');

  let response: Response;
  try {
    // Fetch the built index.html from Cloudflare Pages Assets
    response = await env.ASSETS.fetch(new URL('/index.html', request.url));
  } catch (err) {
    // Local dev or fallback fetch
    response = await fetch(new URL('/index.html', request.url));
  }

  let html = await response.text();

  if (postId) {
    try {
      // Query the post content and the author's username from the D1 SQLite database
      const query = `
        SELECT p.content, u.username as author_username
        FROM timeline_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `;
      const post = await env.D1_DB.prepare(query).bind(postId).first() as {
        content: string;
        author_username?: string;
      } | null;

      if (post) {
        const username = post.author_username || '市民';
        const content = post.content || '';
        
        // Escape characters to prevent HTML/meta attribute breaking
        const cleanContent = content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\n/g, ' ') // Keep it single line for meta tags
          .substring(0, 200); // Truncate long posts to fit description limits

        const cleanUsername = username
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

        const ogTitle = `${cleanUsername}さんの投稿 - ぴっざぁポータル`;
        const ogDescription = cleanContent || 'ぴっざぁ市民のひとりごとや写真を共有しよう。';

        // 1. Replace the static <title> tag
        html = html.replace(/<title>.*?<\/title>/gi, `<title>${ogTitle}</title>`);
        
        // 2. Replace static og:title
        html = html.replace(/<meta property="og:title" content=".*?"\s*\/?>/gi, `<meta property="og:title" content="${ogTitle}" />`);
        
        // 3. Replace static og:description
        html = html.replace(/<meta property="og:description" content=".*?"\s*\/?>/gi, `<meta property="og:description" content="${ogDescription}" />`);
        
        // 4. Replace static description meta tag
        html = html.replace(/<meta name="description" content=".*?"\s*\/?>/gi, `<meta name="description" content="${ogDescription}" />`);
        
        // 5. Update og:url
        const ogUrl = `${url.origin}/timeline?postId=${postId}`;
        html = html.replace(/<meta property="og:url" content=".*?"\s*\/?>/gi, `<meta property="og:url" content="${ogUrl}" />`);
      }
    } catch (e: any) {
      console.error("Error generating dynamic OGP:", e.message);
    }
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
  });
};
