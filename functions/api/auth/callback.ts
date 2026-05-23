// functions/api/auth/callback.ts
export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  if (!code) {
    return new Response("Unauthorized: No code provided", { status: 401 });
  }

  const { DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI } = env;

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: DISCORD_REDIRECT_URI,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      return new Response(`Discord Token Error: ${JSON.stringify(errorData)}`, { status: 500 });
    }

    const { access_token } = await tokenResponse.json() as { access_token: string };

    // 2. Fetch user information
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userData = await userResponse.json() as any;

    // 3. Check/Create User in Database
    const ensureUserTable = async (db: any) => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          avatar TEXT,
          role TEXT DEFAULT 'user',
          roblox_username TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `).run();

      // Migration: Add roblox_username column if missing
      try {
        await db.prepare("ALTER TABLE users ADD COLUMN roblox_username TEXT").run();
      } catch (e) {}
    };

    await ensureUserTable(env.D1_DB);

    let dbUser = await env.D1_DB.prepare("SELECT * FROM users WHERE id = ?").bind(userData.id).first() as any;
    const username = userData.global_name || userData.username;
    
    let avatar = '';
    if (userData.avatar) {
      avatar = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    } else {
      const defaultIndex = userData.discriminator && userData.discriminator !== '0'
        ? (parseInt(userData.discriminator) % 5)
        : Number((BigInt(userData.id) >> 22n) % 6n);
      avatar = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }
    
    // FIRST ADMIN: wasimon
    let role = 'user';
    if (username.toLowerCase() === 'wasimon') {
      role = 'admin';
    }

    if (!dbUser) {
      await env.D1_DB.prepare("INSERT INTO users (id, username, avatar, role) VALUES (?, ?, ?, ?)")
        .bind(userData.id, username, avatar, role).run();
    } else {
      // Keep existing role but update metadata
      role = dbUser.role;
      // Re-force admin if wasimon (in case they were changed)
      if (username.toLowerCase() === 'wasimon') role = 'admin';
      
      await env.D1_DB.prepare("UPDATE users SET username = ?, avatar = ?, role = ? WHERE id = ?")
        .bind(username, avatar, role, userData.id).run();
    }

    // 4. Create user session object
    const user = {
      id: userData.id,
      username,
      avatar,
      role
    };

    // 4. Set Cookie and Redirect to Garage
    // For simplicity, we are storing user info directly in cookie. 
    // In a real app, use a session token or JWT.
    const cookie = `gv_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
    
    if (state === 'app') {
      const appRedirectUrl = `pizzaportal://auth-callback?user=${encodeURIComponent(JSON.stringify(user))}`;
      return new Response(null, {
        status: 302,
        headers: {
          'Location': appRedirectUrl,
          'Set-Cookie': cookie
        }
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': cookie
      }
    });

  } catch (e: any) {
    return new Response(`Auth Callback Error: ${e.message}`, { status: 500 });
  }
};
