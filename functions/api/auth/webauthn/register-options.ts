import { generateRegistrationOptions } from '@simplewebauthn/server';

const ensurePasskeysTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      key_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `).run();

  try {
    await db.prepare("ALTER TABLE user_passkeys ADD COLUMN key_name TEXT").run();
  } catch (e) {}
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  // 1. Get logged-in user
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const userCookie = cookies['gv_user'];
  if (!userCookie) {
    return new Response(JSON.stringify({ error: "ログインが必要です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  let sessionUser;
  try {
    sessionUser = JSON.parse(decodeURIComponent(userCookie));
  } catch (e) {
    return new Response(JSON.stringify({ error: "セッションが無効です" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const url = new URL(request.url);
    const rpID = url.hostname;
    const rpName = "Pizza Citizen Portal";

    await ensurePasskeysTable(env.D1_DB);
    const { results: existingKeys } = await env.D1_DB.prepare(
      "SELECT credential_id FROM user_passkeys WHERE user_id = ?"
    ).bind(sessionUser.id).all();

    const excludeCredentials = existingKeys.map((k: any) => ({
      id: k.credential_id,
      type: 'public-key' as const,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new TextEncoder().encode(sessionUser.id),
      userName: sessionUser.username,
      userDisplayName: sessionUser.username,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      excludeCredentials,
      attestationType: 'none',
    });

    // Store the challenge in a temporary cookie (valid for 2 minutes)
    const challengeCookie = `gv_passkey_reg_challenge=${encodeURIComponent(options.challenge)}; Path=/; Max-Age=120; HttpOnly; SameSite=Lax`;

    return new Response(JSON.stringify(options), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': challengeCookie
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
