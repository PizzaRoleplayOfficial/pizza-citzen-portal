import { generateAuthenticationOptions } from '@simplewebauthn/server';

const ensurePasskeysTable = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_passkeys (
      credential_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      public_key TEXT NOT NULL,
      counter INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `).run();
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  try {
    const url = new URL(request.url);
    const rpID = url.hostname;

    await ensurePasskeysTable(env.D1_DB);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    // Store challenge in temporary cookie
    const challengeCookie = `gv_passkey_login_challenge=${encodeURIComponent(options.challenge)}; Path=/; Max-Age=120; HttpOnly; Secure; SameSite=Lax`;

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
