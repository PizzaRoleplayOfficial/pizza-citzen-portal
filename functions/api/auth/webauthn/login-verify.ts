import { verifyAuthenticationResponse } from '@simplewebauthn/server';

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
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader ? Object.fromEntries(cookieHeader.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  })) : {};
  const expectedChallenge = cookies['gv_passkey_login_challenge'];

  if (!expectedChallenge) {
    return new Response(JSON.stringify({ error: "チャレンジ期限切れまたは無効なリクエストです" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    const body = await request.json() as any;
    const credentialID = body.id;

    await ensurePasskeysTable(env.D1_DB);

    // Find the passkey in database
    const cred = await env.D1_DB.prepare(
      "SELECT credential_id, user_id, public_key, counter FROM user_passkeys WHERE credential_id = ?"
    ).bind(credentialID).first() as any;

    if (!cred) {
      return new Response(
        JSON.stringify({ error: "パスキーが登録されていません。プロフィール画面から登録してください。" }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(request.url);
    const rpID = url.hostname;

    // Decode clientDataJSON to extract the client origin (e.g. android:apk-key-hash)
    let clientOrigin = '';
    try {
      const clientDataJSONEncoded = body.response?.clientDataJSON;
      if (clientDataJSONEncoded) {
        const base64 = clientDataJSONEncoded.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(base64 + padding);
        clientOrigin = JSON.parse(decoded).origin;
      }
    } catch (e) {}

    const expectedOrigin = [url.origin];
    if (clientOrigin && clientOrigin.startsWith('android:apk-key-hash:')) {
      expectedOrigin.push(clientOrigin);
    }

    // Convert stored Base64 public key back to Uint8Array
    const publicKeyUint8 = new Uint8Array(
      atob(cred.public_key).split('').map(c => c.charCodeAt(0))
    );

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: decodeURIComponent(expectedChallenge),
      expectedOrigin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id,
        publicKey: publicKeyUint8,
        counter: cred.counter,
      },
      requireUserVerification: false,
    });

    if (verification.verified && verification.authenticationInfo) {
      const { newCounter } = verification.authenticationInfo;

      // Update the counter in database
      await env.D1_DB.prepare(
        "UPDATE user_passkeys SET counter = ? WHERE credential_id = ?"
      ).bind(newCounter, credentialID).run();

      // Fetch user profile
      const dbUser = await env.D1_DB.prepare("SELECT * FROM users WHERE id = ?").bind(cred.user_id).first() as any;

      if (!dbUser) {
        return new Response(JSON.stringify({ error: "ユーザーが見つかりません" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const user = {
        id: dbUser.id,
        username: dbUser.username,
        avatar: dbUser.avatar,
        role: dbUser.role
      };

      // Set user session cookie (gv_user) and clear login challenge cookie
      const sessionCookie = `gv_user=${encodeURIComponent(JSON.stringify(user))}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax`;
      const clearChallengeCookie = `gv_passkey_login_challenge=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;

      const headers = new Headers({
        'Content-Type': 'application/json'
      });
      headers.append('Set-Cookie', sessionCookie);
      headers.append('Set-Cookie', clearChallengeCookie);

      return new Response(JSON.stringify({ success: true, user }), { headers });
    } else {
      return new Response(JSON.stringify({ error: "パスキー認証の検証に失敗しました" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
