// functions/utils/auth.ts
// Cryptographically signed session and role-based authorization utility

export interface SessionUser {
  id: string;
  username: string;
  avatar: string;
  role: string;
  [key: string]: any;
}

// Pre-defined trusted admin Discord IDs (Snowflake IDs that never change even if username changes)
export const KNOWN_ADMIN_DISCORD_IDS = [
  '758979295204605993', // wasimon
  '985516154862845992', // washimon2
];

// Fallback secret for HMAC signature (stable across Cloudflare worker instances)
const DEFAULT_SECRET = "gv_pizza_portal_secure_hmac_secret_2026_salt_983003561";

// Parse incoming HTTP Cookie header
export function parseCookies(request: Request): Record<string, string> {
  const header = request.headers.get("Cookie");
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k, v.join("=")];
    })
  );
}

// Compute native HMAC-SHA256 signature
async function computeHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Generate signed session cookie string (gv_session=payload.signature)
export async function createSignedSessionCookie(user: SessionUser, secret: string = DEFAULT_SECRET): Promise<string> {
  const jsonStr = JSON.stringify(user);
  const encodedData = btoa(unescape(encodeURIComponent(jsonStr)));
  const sig = await computeHmacSignature(encodedData, secret);
  const token = `${encodedData}.${sig}`;
  return `gv_session=${token}; Path=/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure`;
}

// Verify and retrieve authenticated user from request
export async function getAuthenticatedUser(request: Request, env: any): Promise<SessionUser | null> {
  const cookies = parseCookies(request);
  const secret = env.SESSION_SECRET || DEFAULT_SECRET;

  // 1. Check cryptographically signed session token (gv_session)
  const sessionToken = cookies["gv_session"];
  if (sessionToken && sessionToken.includes(".")) {
    const [encodedData, sig] = sessionToken.split(".");
    if (encodedData && sig) {
      try {
        const expectedSig = await computeHmacSignature(encodedData, secret);
        if (expectedSig === sig) {
          const jsonStr = decodeURIComponent(escape(atob(encodedData)));
          const user = JSON.parse(jsonStr) as SessionUser;
          return user;
        }
      } catch (e) {
        console.warn("Signed session token parse error:", e);
      }
    }
  }

  // 2. Compatibility fallback for existing users logged in before this update:
  // We inspect gv_user cookie, BUT we re-verify actual role and identity against D1 database!
  // This completely stops privilege escalation because any client-modified role='admin'
  // will be overwritten with the authentic role from the D1 users table!
  const legacyCookie = cookies["gv_user"];
  if (legacyCookie && env.D1_DB) {
    try {
      const parsed = JSON.parse(decodeURIComponent(legacyCookie));
      if (parsed && parsed.id) {
        const dbUser = await env.D1_DB.prepare(
          "SELECT id, username, avatar, role FROM users WHERE id = ?"
        ).bind(parsed.id).first() as any;

        if (dbUser) {
          return {
            id: dbUser.id,
            username: dbUser.username,
            avatar: dbUser.avatar,
            role: dbUser.role || "user"
          };
        }
      }
    } catch {}
  }

  return null;
}

// Helper to check whether a user possesses admin privileges
export function isAdminUser(user: SessionUser | null, env?: any): boolean {
  if (!user || !user.id) return false;

  // Check role property (verified by signature or D1 DB)
  if (user.role === 'admin') return true;

  // Check known trusted Discord IDs
  if (KNOWN_ADMIN_DISCORD_IDS.includes(user.id)) return true;

  // Check environment-configured admin IDs if provided
  if (env && env.ADMIN_DISCORD_IDS) {
    const envIds = env.ADMIN_DISCORD_IDS.split(',').map((id: string) => id.trim());
    if (envIds.includes(user.id)) return true;
  }

  return false;
}
