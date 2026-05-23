// API to fetch a single vehicle's image data on demand
// This highly optimizes the main vehicle list API by avoiding loading megabytes of Base64 strings.

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing vehicle ID" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const v = await env.D1_DB.prepare("SELECT image_data FROM vehicles WHERE id = ?").bind(id).first() as any;
    const imageData = v ? v.image_data : null;
    
    return new Response(JSON.stringify({ image_data: imageData }), {
      headers: {
        'Content-Type': 'application/json',
        // Maximize performance with client-side caching (images rarely change)
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
