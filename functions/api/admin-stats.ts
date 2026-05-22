const getAdminStatus = async (request: Request) => {
    const cookieHeader = request.headers.get('Cookie');
    const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('='))) : {};
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
  if (!(await getAdminStatus(request))) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    // We do not need try-catch to ensure table exists because if vehicles/apps are missing, the system is fully empty
    const vRes = await env.D1_DB.prepare("SELECT COUNT(*) as c FROM vehicles WHERE status = 'pending'").first();
    const aRes = await env.D1_DB.prepare("SELECT COUNT(*) as c FROM applications WHERE status = 'pending'").first();
    
    return new Response(JSON.stringify({ 
      pendingVehicles: vRes?.c || 0,
      pendingApps: aRes?.c || 0,
      totalPending: (vRes?.c || 0) + (aRes?.c || 0)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(e.message, { status: 500 });
  }
};
