// Endpoint for Uploading Large Media Files (Videos/Images) to Cloudflare R2
// Path: functions/api/upload-media.ts

interface Env {
  R2_BUCKET: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  if (!env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: "R2 bucket binding (R2_BUCKET) is not configured on Cloudflare." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file was uploaded." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Generate a unique, safe key for the R2 object
    const fileExtension = file.name.split('.').pop() || 'mp4';
    const uuid = crypto.randomUUID();
    const key = `video-${uuid}.${fileExtension}`;

    // Read the file stream as ArrayBuffer to put in R2
    const fileBuffer = await file.arrayBuffer();

    // Store in R2 bucket
    await env.R2_BUCKET.put(key, fileBuffer, {
      httpMetadata: {
        contentType: file.type || 'video/mp4',
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    return new Response(JSON.stringify({ success: true, key }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("Media upload error:", err.message);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
