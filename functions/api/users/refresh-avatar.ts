// functions/api/users/refresh-avatar.ts

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: "Missing userId" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { DISCORD_BOT_TOKEN } = env;

  if (!DISCORD_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: "DISCORD_BOT_TOKEN not configured" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. Fetch latest user profile from Discord API using Bot Token
    const discordResponse = await fetch(`https://discord.com/api/v10/users/${userId}`, {
      headers: {
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      return new Response(JSON.stringify({ error: `Discord API returned ${discordResponse.status}: ${errorText}` }), { 
        status: discordResponse.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userData = await discordResponse.json() as any;

    // 2. Generate avatar URL
    let avatarUrl = '';
    if (userData.avatar) {
      avatarUrl = `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`;
    } else {
      const defaultIndex = userData.discriminator && userData.discriminator !== '0'
        ? (parseInt(userData.discriminator) % 5)
        : Number((BigInt(userData.id) >> 22n) % 6n);
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
    }

    // 3. Update database with new avatar (and username if it changed)
    const username = userData.global_name || userData.username;
    
    // Check if user exists in our DB first
    const dbUser = await env.D1_DB.prepare("SELECT id FROM users WHERE id = ?").bind(userId).first();
    
    if (dbUser) {
      await env.D1_DB.prepare("UPDATE users SET avatar = ?, username = ? WHERE id = ?")
        .bind(avatarUrl, username, userId)
        .run();
    }

    return new Response(JSON.stringify({ avatar: avatarUrl, username }), {
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ error: `Failed to refresh avatar: ${e.message}` }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
