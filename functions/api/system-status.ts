// Path: functions/api/system-status.ts
// Handles system status, including Maintenance Mode for large updates

const NO_CACHE = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

const DEFAULT_MAINTENANCE = {
  enabled: false,
  title: '大規模システムメンテナンス実施中',
  message: '現在、新機能追加およびシステム最適化の作業を行っております。完了まで今しばらくお待ちください。',
  estimatedEnd: '',
  discordUrl: 'https://discord.gg/RruM8Gqc4m',
  updatedAt: null
};

const ensureSettingsTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `).run();
};

const getAdminStatus = async (env: any, request: Request, adminIdFallback?: string) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader
    ? Object.fromEntries(cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      }))
    : {};
  const userCookie = cookies['gv_user'];
  let userId = '';
  if (userCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(userCookie));
      if (parsed.role === 'admin') return true;
      userId = parsed.id;
    } catch {}
  }
  if (!userId && adminIdFallback) {
    userId = adminIdFallback;
  }
  if (userId) {
    const user = await env.D1_DB.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first() as any;
    return user?.role === 'admin';
  }
  return false;
};

export const onRequestGet = async ({ env }: { env: any }) => {
  try {
    const row = await env.D1_DB.prepare("SELECT value, updated_at FROM system_settings WHERE key = 'maintenance'").first() as any;
    let maintenance = DEFAULT_MAINTENANCE;
    if (row && row.value) {
      try {
        maintenance = { ...DEFAULT_MAINTENANCE, ...JSON.parse(row.value), updatedAt: row.updated_at };
      } catch {}
    }
    return new Response(JSON.stringify({ maintenance }), { headers: NO_CACHE });
  } catch (err: any) {
    return new Response(JSON.stringify({ maintenance: DEFAULT_MAINTENANCE, error: err.message }), { headers: NO_CACHE });
  }
};

export const onRequestPost = async ({ env, request }: { env: any; request: Request }) => {
  try {
    const body = await request.json().catch(() => ({})) as any;
    const { action = 'update_maintenance', enabled, title, message, estimatedEnd, discordUrl, adminId } = body;

    const isAdmin = await getAdminStatus(env, request, adminId);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Admin role required.' }), { status: 403, headers: NO_CACHE });
    }

    await ensureSettingsTable(env.D1_DB);

    const current = await env.D1_DB.prepare("SELECT value FROM system_settings WHERE key = 'maintenance'").first() as any;
    let currObj = DEFAULT_MAINTENANCE;
    if (current && current.value) {
      try { currObj = { ...DEFAULT_MAINTENANCE, ...JSON.parse(current.value) }; } catch {}
    }

    const updatedObj = {
      enabled: typeof enabled === 'boolean' ? enabled : !currObj.enabled,
      title: title !== undefined ? title : currObj.title,
      message: message !== undefined ? message : currObj.message,
      estimatedEnd: estimatedEnd !== undefined ? estimatedEnd : currObj.estimatedEnd,
      discordUrl: discordUrl !== undefined ? discordUrl : currObj.discordUrl,
      updatedAt: new Date().toISOString()
    };

    await env.D1_DB.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('maintenance', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).bind(JSON.stringify(updatedObj)).run();

    return new Response(JSON.stringify({ success: true, maintenance: updatedObj }), { headers: NO_CACHE });
  } catch (err: any) {
    console.error('System status error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: NO_CACHE });
  }
};
