// API to fetch a single vehicle's image data on demand
// This highly optimizes the main vehicle list API by avoiding loading megabytes of Base64 strings.
// Path: functions/api/vehicle-image.ts

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const high = url.searchParams.get('high') === 'true';
  const index = parseInt(url.searchParams.get('index') || '0', 10);
  const lowConnection = url.searchParams.get('lowConnection') === 'true';

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing vehicle ID" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const v = await env.D1_DB.prepare("SELECT image_data FROM vehicles WHERE id = ?").bind(id).first() as any;
    const rawImageData = v ? v.image_data : null;

    if (!rawImageData) {
      return new Response(JSON.stringify({ image_data: null }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse image_data safely
    let images: any[] = [];
    try {
      images = JSON.parse(rawImageData);
      if (!Array.isArray(images)) {
        images = [rawImageData];
      }
    } catch (e) {
      images = [rawImageData];
    }

    if (high) {
      // 1. Proxy Mode: Return high-resolution image as binary data
      if (images.length > index) {
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
                // Cache aggressively for 1 year since vehicle images rarely change
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            });
          }
        }
      }
      return new Response("Image not found or invalid format", { status: 404 });
    }

    // 2. Normal Mode: Return JSON structure optimized for connection speed
    let optimizedData = "";
    if (lowConnection) {
      // Return low-res thumbnail and proxy URL for high-res
      optimizedData = JSON.stringify(
        images.map((img, idx) => {
          if (typeof img === 'string') {
            return {
              low: img.startsWith('data:') ? img : '',
              highUrl: `/api/vehicle-image?id=${id}&index=${idx}&high=true`
            };
          } else {
            return {
              low: img.low || '',
              highUrl: `/api/vehicle-image?id=${id}&index=${idx}&high=true`
            };
          }
        })
      );
    } else {
      // Fast connection: Return full high-resolution base64 string directly
      optimizedData = JSON.stringify(
        images.map((img) => {
          if (typeof img === 'string') {
            return img;
          } else {
            return img.high || img.low || '';
          }
        })
      );
    }

    return new Response(JSON.stringify({ image_data: optimizedData }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=60'
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
