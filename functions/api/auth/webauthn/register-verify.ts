import { verifyRegistrationResponse } from '@simplewebauthn/server';

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

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
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

  // 2. Read stored challenge
  const expectedChallenge = cookies['gv_passkey_reg_challenge'];
  if (!expectedChallenge) {
    return new Response(JSON.stringify({ error: "チャレンジ期限切れまたは無効なリクエストです" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json() as any;
    const credential = body.credential || body;
    const keyName = body.keyName || 'パスキー';

    const url = new URL(request.url);
    const rpID = url.hostname;
    const expectedOrigin = url.origin;

    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: decodeURIComponent(expectedChallenge),
      expectedOrigin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      const { id: credentialID, publicKey: credentialPublicKey, counter } = credential;

      // Convert Uint8Array public key to Base64 to store in SQLite D1
      const publicKeyBase64 = btoa(String.fromCharCode(...Array.from(credentialPublicKey)));

      await ensurePasskeysTable(env.D1_DB);

      // Insert new passkey linked to user ID
      await env.D1_DB.prepare(
        "INSERT INTO user_passkeys (credential_id, user_id, public_key, counter, key_name) VALUES (?, ?, ?, ?, ?)"
      ).bind(credentialID, sessionUser.id, publicKeyBase64, counter, keyName).run();

      // Clear registration challenge cookie
      const clearCookie = `gv_passkey_reg_challenge=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

      return new Response(JSON.stringify({ success: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookie
        }
      });
    } else {
      return new Response(JSON.stringify({ error: "パスキー登録の検証に失敗しました" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
