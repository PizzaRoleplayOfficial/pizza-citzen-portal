// Timeline Post Image Proxy Endpoint for Dynamic OGP Previews
// Path: functions/api/timeline-image.ts

interface Env {
  D1_DB: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId');
  const index = parseInt(url.searchParams.get('index') || '0', 10);

  if (!postId) {
    return new Response("Missing postId", { status: 400 });
  }

  try {
    // 1. Fetch image_data from timeline_posts table in D1 DB
    let post = await env.D1_DB.prepare(
      "SELECT image_data FROM timeline_posts WHERE id = ?"
    ).bind(postId).first() as { image_data?: string | null } | null;

    // Fallback: Check in timeline_comments table
    if (!post || !post.image_data) {
      post = await env.D1_DB.prepare(
        "SELECT image_data FROM timeline_comments WHERE id = ?"
      ).bind(postId).first() as { image_data?: string | null } | null;
    }

    if (post && post.image_data) {
      // 2. image_data is stored as a JSON stringified array of base64 data URLs
      let images: any[] = [];
      try {
        images = JSON.parse(post.image_data);
      } catch (err) {
        // Fallback in case of raw base64 string
        if (typeof post.image_data === 'string' && post.image_data.startsWith('data:image')) {
          images = [post.image_data];
        }
      }

      if (Array.isArray(images) && images.length > index) {
        let base64DataUrl = images[index];
        if (base64DataUrl && typeof base64DataUrl === 'object') {
          base64DataUrl = base64DataUrl.high || base64DataUrl.low || '';
        }

        if (typeof base64DataUrl === 'string' && base64DataUrl.startsWith('data:image')) {
          const matches = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
          
          if (matches && matches.length === 3) {
            const contentType = matches[1];
            const base64Content = matches[2];
            
            // Decode the base64 content to standard binary byte data
            const binaryString = atob(base64Content);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            return new Response(bytes.buffer, {
              headers: {
                'Content-Type': contentType,
                // Cache aggressively so scrapers load it fast and save DB queries
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.error("Error decoding or serving timeline OGP image:", err.message);
  }

  // Fallback: Redirect to default pizza icon if no image is attached
  return Response.redirect(`${url.origin}/pizza.png`, 302);
};
