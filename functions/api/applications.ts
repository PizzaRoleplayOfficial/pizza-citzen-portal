// functions/api/applications.ts
// Citizen application submission, auto-scoring and Discord webhook notifications
import { sendFcmNotificationToUser, sendFcmNotificationToAdmins } from '../utils/fcm';

const getUserSession = (request: Request) => {
  const cookieHeader = request.headers.get('Cookie');
  const cookies = cookieHeader
    ? Object.fromEntries(cookieHeader.split(';').map(c => {
        const [k, ...v] = c.trim().split('=');
        return [k, v.join('=')];
      }))
    : {};
  const userCookie = cookies['gv_user'];
  if (!userCookie) return null;
  try {
    return JSON.parse(decodeURIComponent(userCookie));
  } catch {
    return null;
  }
};

const NO_CACHE = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, no-cache' };

const sendWebhook = async (url: string, content: object) => {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
  } catch (e) {
    console.error('Webhook send failed:', e);
  }
};

// Auto-grade answers (radio/checkbox). Returns { score, max }
const autoGrade = (questions: any[], answers: Record<string, any>) => {
  let score = 0;
  let max = 0;
  for (const q of questions) {
    if (q.type === 'text' || !q.answer) continue; // skip written questions
    max++;
    const correctRaw = JSON.parse(q.answer);
    const userAnswer = answers[q.id];
    if (q.type === 'checkbox') {
      // Both must be arrays with same sorted values
      const correct = Array.isArray(correctRaw) ? [...correctRaw].sort() : [correctRaw].sort();
      const user = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
      if (JSON.stringify(correct) === JSON.stringify(user)) score++;
    } else {
      if (String(userAnswer).trim() === String(correctRaw).trim()) score++;
    }
  }
  return { score, max };
};

// GET /api/applications
// - Regular user: returns own application
// - Admin: returns all applications
export const onRequestGet = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  try {
    const dbUser = await env.D1_DB.prepare('SELECT role FROM users WHERE id = ?').bind(session.id).first() as any;
    const isAdmin = dbUser?.role === 'admin';
    const url = new URL(request.url);
    const requireAll = url.searchParams.get('admin') === 'true';

    if (isAdmin && requireAll) {
      const { results } = await env.D1_DB
        .prepare('SELECT * FROM applications ORDER BY submitted_at DESC')
        .all();
      return new Response(JSON.stringify(results), { headers: NO_CACHE });
    } else {
      const app = await env.D1_DB
        .prepare('SELECT * FROM applications WHERE user_id = ?')
        .bind(session.id).first();
      return new Response(JSON.stringify(app || null), { headers: NO_CACHE });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

// POST /api/applications - submit new application
export const onRequestPost = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  try {
    const body = await request.json() as any;
    const { roblox_username, discord_username, answers } = body;

    if (!roblox_username || !discord_username || !answers) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: NO_CACHE });
    }

    // Fetch all active questions with answers for grading
    const { results: questions } = await env.D1_DB
      .prepare('SELECT * FROM questions WHERE is_active = 1 ORDER BY sort_order ASC')
      .all();

    const { score, max } = autoGrade(questions as any[], answers);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    // Upsert - one application per user (re-apply overwrites)
    await env.D1_DB.prepare(`
      INSERT INTO applications (id, user_id, roblox_username, discord_username, status, answers, auto_score, auto_score_max, submitted_at, reviewed_at, reviewed_by, reject_reason)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, NULL, NULL, NULL)
      ON CONFLICT(user_id) DO UPDATE SET
        id = excluded.id,
        roblox_username = excluded.roblox_username,
        discord_username = excluded.discord_username,
        status = 'pending',
        answers = excluded.answers,
        auto_score = excluded.auto_score,
        auto_score_max = excluded.auto_score_max,
        submitted_at = excluded.submitted_at,
        reviewed_at = NULL,
        reviewed_by = NULL,
        reject_reason = NULL
    `).bind(id, session.id, roblox_username, discord_username, JSON.stringify(answers), score, max, now).run();

    // Discord Webhook: new application notification
    if (env.DISCORD_WEBHOOK_APPLICATIONS) {
      const scoreText = max > 0 ? `📊 自動採点: **${score}/${max}** 問正解（筆記は別途確認）` : '';
      await sendWebhook(env.DISCORD_WEBHOOK_APPLICATIONS, {
        embeds: [{
          title: '📋 新規市民申請が届きました',
          color: 0x5865F2,
          fields: [
            { name: '👤 Discord', value: `@${discord_username}`, inline: true },
            { name: '🎮 Roblox', value: roblox_username, inline: true },
            { name: '📊 自動採点', value: max > 0 ? `${score}/${max} 問正解（筆記は別途確認）` : '採点不可', inline: false },
          ],
          footer: { text: '管理パネルで審査してください → https://gv-vehicle-registry.pages.dev' },
          timestamp: now,
        }],
      });
    }

    // Send Real-time Push Notification to Admins (FCM)
    await sendFcmNotificationToAdmins(env, {
      title: '📋 新規市民申請到着',
      body: `Discord: @${discord_username} / Roblox: ${roblox_username} から新規の市民申請が届きました。`,
      channelId: 'admin_notifications_channel',
      data: { action: 'admin', tab: 'applications' }
    }).catch(err => console.error('FCM admin notification failed:', err));

    return new Response(JSON.stringify({ ok: true, score, max }), { headers: NO_CACHE });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};

// PATCH /api/applications - approve or reject (admin only)
export const onRequestPatch = async ({ env, request }: { env: any; request: Request }) => {
  const session = getUserSession(request);
  if (!session) return new Response('Unauthorized', { status: 401 });

  const dbUser = await env.D1_DB.prepare('SELECT role, username FROM users WHERE id = ?').bind(session.id).first() as any;
  if (!dbUser || dbUser.role !== 'admin') return new Response('Forbidden', { status: 403 });

  try {
    const body = await request.json() as any;
    const { user_id, status, expected_status, reject_reason } = body;

    if (!user_id || !['approved', 'rejected'].includes(status) || !expected_status) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400, headers: NO_CACHE });
    }

    const now = new Date().toISOString();
    const result = await env.D1_DB.prepare(`
      UPDATE applications SET status = ?, reviewed_at = ?, reviewed_by = ?, reject_reason = ?
      WHERE user_id = ? AND status = ?
    `).bind(status, now, session.id, reject_reason || null, user_id, expected_status).run();

    if (result.meta && result.meta.changes === 0) {
      return new Response(JSON.stringify({ error: 'Conflict: Status modified by another admin.' }), { status: 409, headers: NO_CACHE });
    }

    // Fetch applicant info for webhook
    const app = await env.D1_DB
      .prepare('SELECT discord_username, roblox_username FROM applications WHERE user_id = ?')
      .bind(user_id).first() as any;

    // Discord Webhook: result notification
    if (env.DISCORD_WEBHOOK_RESULTS && app) {
      const isApproved = status === 'approved';
      await sendWebhook(env.DISCORD_WEBHOOK_RESULTS, {
        embeds: [{
          title: isApproved ? '✅ 市民申請が承認されました' : '❌ 市民申請が却下されました',
          color: isApproved ? 0x57F287 : 0xED4245,
          fields: [
            { name: '👤 Discord', value: `@${app.discord_username}`, inline: true },
            { name: '🎮 Roblox', value: app.roblox_username, inline: true },
            { name: isApproved ? '✅ 承認者' : '❌ 却下者', value: `@${dbUser.username}`, inline: false },
            ...((!isApproved && reject_reason) ? [{ name: '📝 却下理由', value: reject_reason, inline: false }] : []),
            ...(!isApproved ? [{ name: '🔄 再申請', value: '再申請は可能です。', inline: false }] : []),
          ],
          timestamp: now,
        }],
      });
    }

    // Send Real-time Push Notification (FCM)
    if (user_id) {
      const isApproved = status === 'approved';
      const title = isApproved ? '✅ 市民申請承認' : '❌ 市民申請却下';
      const bodyText = isApproved 
        ? '市民申請が承認されました！市民権が与えられたため、車両の新規登録が可能になりました。' 
        : `市民申請が却下されました。理由: ${reject_reason || 'なし'}`;

      await sendFcmNotificationToUser(env, user_id, {
        title,
        body: bodyText,
        channelId: 'application_results_channel',
        data: { 
          action: 'apply',
          updateType: 'citizen_application',
          status: status
        }
      }).catch(err => console.error('FCM send failure for citizen application:', err));
    }

    return new Response(JSON.stringify({ ok: true }), { headers: NO_CACHE });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: NO_CACHE });
  }
};
