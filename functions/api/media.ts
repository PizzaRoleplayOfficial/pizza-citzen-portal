// Streaming Proxy Endpoint for Cloudflare R2 Media Objects with HTTP Range support
// Path: functions/api/media.ts

interface Env {
  R2_BUCKET: any;
}

export const onRequestGet = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.searchParams.get("key");

  if (!env.R2_BUCKET) {
    return new Response("R2 storage not configured", { status: 500 });
  }

  if (!key) {
    return new Response("Missing media key", { status: 400 });
  }

  try {
    // Parse Range header to support seamless iOS/Safari and Chrome seeking (HTTP 206 Partial Content)
    const rangeHeader = request.headers.get("Range");
    
    // Retrieve the media object from R2 with range support if requested
    const object = await env.R2_BUCKET.get(key, {
      range: rangeHeader || undefined
    });

    if (!object) {
      return new Response("Media not found", { status: 404 });
    }

    const headers = new Headers();
    if (object.writeHttpMetadata) {
      object.writeHttpMetadata(headers);
    }
    if (object.httpEtag) {
      headers.set("etag", object.httpEtag);
    }
    
    // Set caching headers for premium loading speed
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    // If partial content was requested, respond with HTTP 206
    const status = rangeHeader ? 206 : 200;

    return new Response(object.body, {
      status,
      headers
    });
  } catch (err: any) {
    console.error("Error streaming R2 media:", err.message || err);
    return new Response(JSON.stringify({ error: err.message || err, stack: err.stack }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
