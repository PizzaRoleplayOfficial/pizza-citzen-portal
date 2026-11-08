// functions/api/admin-stats.ts
import { getAuthenticatedUser, isAdminUser } from '../utils/auth';

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const user = await getAuthenticatedUser(request, env);
  if (!isAdminUser(user, env)) {
    return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), { 
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
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
    return new Response(JSON.stringify({ error: e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
