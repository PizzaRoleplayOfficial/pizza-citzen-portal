// Endpoint for Uploading Large Media Files (Videos/Images) to Cloudflare R2
// Path: functions/api/upload-media.ts
import { getAuthenticatedUser } from '../utils/auth';

interface Env {
  R2_BUCKET: any;
  SESSION_SECRET?: string;
}

const ALLOWED_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'png', 'jpg', 'jpeg', 'webp', 'gif']);
const ALLOWED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif'
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Limit

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  const { request, env } = context;

  if (!env.R2_BUCKET) {
    return new Response(JSON.stringify({ error: "R2 bucket binding (R2_BUCKET) is not configured on Cloudflare." }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 1. Authentication Check: User must be logged in to upload media
  const authUser = await getAuthenticatedUser(request, env);
  if (!authUser || !authUser.id) {
    return new Response(JSON.stringify({ error: "Unauthorized: Please log in to upload media." }), {
      status: 401,
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

    // 2. File Size Enforcement
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "ファイルサイズが制限(25MB)を超えています。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Extension & MIME Whitelist Validation
    const rawExtension = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(rawExtension)) {
      return new Response(JSON.stringify({ error: "許可されていないファイル形式です。(対応: mp4, webm, mov, png, jpg, webp, gif)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const mimeType = (file.type || '').toLowerCase();
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return new Response(JSON.stringify({ error: "無効なMIMEタイプです。" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. Generate a unique, safe key for the R2 object
    const uuid = crypto.randomUUID();
    const prefix = mimeType.startsWith('image/') ? 'img' : 'video';
    const key = `${prefix}-${uuid}.${rawExtension}`;

    // Read the file stream as ArrayBuffer to put in R2
    const fileBuffer = await file.arrayBuffer();

    // Store in R2 bucket
    await env.R2_BUCKET.put(key, fileBuffer, {
      httpMetadata: {
        contentType: mimeType || (prefix === 'image' ? 'image/jpeg' : 'video/mp4'),
        cacheControl: 'public, max-age=31536000, immutable'
      }
    });

    return new Response(JSON.stringify({ success: true, key }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    console.error("Media upload error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
