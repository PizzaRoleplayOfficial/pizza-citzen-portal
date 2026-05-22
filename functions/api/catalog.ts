interface Env {
  D1_DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const db = context.env.D1_DB;

  try {
    const stmt = db.prepare('SELECT data, updated_at FROM vehicle_catalog WHERE id = ?').bind('latest');
    const row = await stmt.first<{ data: string; updated_at: string }>();

    if (!row) {
      return new Response(JSON.stringify({ error: 'Catalog not found', carModels: {}, carTrims: {}, carColors: {} }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(row.data, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const db = context.env.D1_DB;

  try {
    const cookieHeader = context.request.headers.get('Cookie');
    const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('='))) : {};
    const userCookieStr = cookies['gv_user'];
    
    if (!userCookieStr) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    
    let callerInfo;
    try {
      callerInfo = JSON.parse(decodeURIComponent(userCookieStr));
    } catch {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    if (callerInfo.role !== 'admin') {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    let reqData = {};
    try {
      reqData = await context.request.json();
    } catch(e) {}
    
    // We expect { carModels: {}, carTrims: {}, carColors: {} }
    const stringified = JSON.stringify(reqData);

    const stmt = db.prepare(`
      INSERT INTO vehicle_catalog (id, data, updated_at) 
      VALUES ('latest', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=CURRENT_TIMESTAMP
    `).bind(stringified);

    await stmt.run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: {'Content-Type': 'application/json'} });
  }
};
