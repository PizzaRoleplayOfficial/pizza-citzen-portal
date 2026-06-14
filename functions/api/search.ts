// functions/api/search.ts
const getAdminStatus = (request: Request) => {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
    })) : {};
    const userCookie = cookies['gv_user'];
    if (!userCookie) return false;
    try {
        const user = JSON.parse(decodeURIComponent(userCookie));
        return user.role === 'admin';
    } catch {
        return false;
    }
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  if (!getAdminStatus(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized: Admins only" }), { status: 403 });
  }

  try {
    // Join vehicles with users to get latest discord names
    const query = `
      SELECT 
        v.*, 
        u.username as discord_username,
        u.avatar as discord_avatar,
        u.id as discord_id,
        COALESCE(u.roblox_username, v.roblox_username) as current_roblox_username
      FROM vehicles v
      LEFT JOIN users u ON v.owner_id = u.id
      WHERE v.status = 'approved'
      ORDER BY v.created_at DESC
    `;
    
    const { results } = await env.D1_DB.prepare(query).all();
    
    return new Response(JSON.stringify(results), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
