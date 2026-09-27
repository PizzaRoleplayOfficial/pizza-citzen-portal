import * as jose from 'jose';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/**
 * Service AccountのJSONをもとにGoogle OAuth 2.0アクセストークンを取得します。
 */
async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa: ServiceAccount = JSON.parse(serviceAccountJson);

  // private_keyの改行文字を適切にパース
  const privateKey = sa.private_key.replace(/\\n/g, '\n');

  // PKCS8形式の秘密鍵をjoseにロード
  const alg = 'RS256';
  const privateKeyObj = await jose.importPKCS8(privateKey, alg);

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  })
    .setProtectedHeader({ alg })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setExpirationTime(now + 3600)
    .setIssuedAt(now)
    .sign(privateKeyObj);

  // トークンエンドポイントへリクエスト
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to get OAuth token from Google: ${errText}`);
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  return tokenData.access_token;
}

/**
 * 指定したトークン宛てにFCMプッシュ通知を送信します。
 */
export interface FcmNotificationPayload {
  title: string;
  body: string;
  channelId?: string;
  tag?: string;
  notificationCount?: number;
  data?: Record<string, string>;
}

export interface FcmSendResult {
  success: boolean;
  expired?: boolean;
}

export async function sendFcmNotification(
  env: any,
  token: string,
  payload: FcmNotificationPayload
): Promise<FcmSendResult> {
  try {
    const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not set. Skipping FCM push notification.');
      return { success: false, expired: false };
    }

    const sa: ServiceAccount = JSON.parse(serviceAccountJson);
    const projectId = sa.project_id;

    // 1. Google API用のアクセストークンを取得
    const accessToken = await getAccessToken(serviceAccountJson);

    // 2. FCM v1 APIのメッセージ構築
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const message = {
      message: {
        token: token,
        notification: {
          title: payload.title,
          body: payload.body
        },
        data: payload.data || undefined, // data属性を追加 (v2.0.3)
        android: {
          notification: {
            channel_id: payload.channelId || 'application_results_channel',
            sound: 'default',
            tag: payload.tag || (payload.channelId === 'dm_messages_channel' && payload.data?.conversationId ? `dm_${payload.data.conversationId}` : undefined),
            notification_count: payload.notificationCount || undefined,
            click_action: payload.channelId === 'dm_messages_channel' ? 'DM_REPLY_ACTION' : undefined
          }
        }
      }
    };

    // 3. FCM v1 APIへリクエスト送信
    const res = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`FCM send failed: ${errText}`);
      
      // トークンが失効している（404, 410, UNREGISTEREDなど）場合のみ expired: true を返して安全にDBクリーンアップ
      const isExpired = res.status === 404 || res.status === 410 || 
                        errText.includes('UNREGISTERED') || 
                        errText.includes('NOT_FOUND') ||
                        errText.includes('registration-token-not-registered');
      return { success: false, expired: isExpired };
    }

    const resData = await res.json();
    console.log(`FCM send success:`, resData);
    return { success: true, expired: false };
  } catch (err) {
    console.error('Failed to send FCM notification:', err);
    return { success: false, expired: false };
  }
}

async function saveInAppNotification(
  db: any,
  userId: string,
  payload: FcmNotificationPayload
): Promise<boolean> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT NOT NULL,
        link_action TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `).run();

    // 1. DM Notifications Bundling: If an unread DM notification for this conversation already exists, update & bundle it
    if (payload.channelId === 'dm_messages_channel' && payload.data?.conversationId) {
      const convId = payload.data.conversationId;
      const existingUnread = await db.prepare(`
        SELECT id FROM notifications 
        WHERE user_id = ? AND type = 'dm_messages_channel' 
          AND link_action LIKE ? AND is_read = 0 
        ORDER BY created_at DESC LIMIT 1
      `).bind(userId, `%conversationId=${convId}%`).first();

      if (existingUnread) {
        console.log(`[DM Bundling] Updating existing unread notification ${existingUnread.id} for user ${userId}: ${payload.title}`);
        await db.prepare(`
          UPDATE notifications 
          SET title = ?, body = ?, created_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(payload.title, payload.body, existingUnread.id).run();
        return true;
      }
    }

    // 2. Deduplication check: drop duplicate identical notification if created within last 5 minutes
    const recent = await db.prepare(`
      SELECT id FROM notifications 
      WHERE user_id = ? AND title = ? AND body = ? AND created_at > datetime('now', '-5 minutes')
      LIMIT 1
    `).bind(userId, payload.title, payload.body).first();

    if (recent) {
      console.log(`[Deduplication] Dropping duplicate in-app notification for user ${userId}: ${payload.title}`);
      return false;
    }

    const id = crypto.randomUUID();
    const type = payload.channelId || 'general';
    const linkAction = payload.data?.action || null;

    await db.prepare(`
      INSERT INTO notifications (id, user_id, title, body, type, link_action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, userId, payload.title, payload.body, type, linkAction).run();
    console.log(`Saved in-app notification for user ${userId}: ${payload.title}`);
    return true;
  } catch (err) {
    console.error('Failed to save in-app notification in DB:', err);
    return false;
  }
}

/**
 * データベースの指定したユーザーIDに紐づくすべての端末トークンを取得して、通知を送信します。
 */
export async function sendFcmNotificationToUser(
  env: any,
  userId: string,
  payload: FcmNotificationPayload
): Promise<number> {
  try {
    if (!env.D1_DB) {
      console.warn('D1_DB binding not found. Cannot fetch push tokens.');
      return 0;
    }

    // Automatically record in-app notification (with 5-minute deduplication)
    const saved = await saveInAppNotification(env.D1_DB, userId, payload);
    if (!saved) {
      console.log(`[Deduplication] Dropping FCM push notification because it is a duplicate: ${payload.title}`);
      return 0;
    }

    // PC/Web active check: If recipient is actively using PC/Web (active within last 45s), suppress mobile push
    try {
      const webActive = await env.D1_DB.prepare(`
        SELECT 1 FROM user_presence 
        WHERE user_id = ? 
          AND platform = 'web' 
          AND last_active_at > datetime('now', '-45 seconds')
        LIMIT 1
      `).bind(userId).first();

      if (webActive) {
        console.log(`[FCM] Suppressed mobile push notification for user ${userId} because user is actively using PC/Web.`);
        return 0;
      }
    } catch (presenceErr) {
      // Table might not exist yet or minor error, proceed normally
    }

    // チャンネル種別に応じて購読トグルのフィルタリングを変更 (v2.2.2)
    const isChannelAdmin = payload.channelId === 'admin_notifications_channel';
    const isChannelAdminEdit = payload.channelId === 'admin_edit_notifications_channel';
    const isTimelineLike = payload.channelId === 'timeline_likes_channel';
    const isTimelineComment = payload.channelId === 'timeline_comments_channel';
    const isTimelineNewPost = payload.channelId === 'timeline_new_posts_channel';
    const isDmMessage = payload.channelId === 'dm_messages_channel';
    
    let query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND results_enabled = 1";
    if (isChannelAdmin) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND admin_enabled = 1";
    } else if (isChannelAdminEdit) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND admin_edit_enabled = 1";
    } else if (isTimelineLike) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND timeline_like_enabled = 1";
    } else if (isTimelineComment) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND timeline_comment_enabled = 1";
    } else if (isTimelineNewPost) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ? AND timeline_new_post_enabled = 1";
    } else if (isDmMessage) {
      query = "SELECT token FROM user_push_tokens WHERE user_id = ?";
    }

    // 1. D1からユーザーのトークンリストを取得
    const { results } = await env.D1_DB.prepare(query).bind(userId).all();

    if (!results || results.length === 0) {
      console.log(`No registered push tokens found for user: ${userId}`);
      return 0;
    }

    console.log(`Found ${results.length} token(s) for user: ${userId}. Sending FCM push notifications...`);

    let successCount = 0;
    
    // 全トークンに並列で通知を送信（複数端末すべてに一斉配信）
    const promises = results.map(async (row: any) => {
      const sendRes = await sendFcmNotification(env, row.token, payload);
      if (sendRes.success) {
        successCount++;
      } else if (sendRes.expired) {
        // トークンが失効している（アプリ削除・再インストール等）場合のみ安全にDBからクリーンアップ
        console.log(`FCM token expired or invalid. Removing from DB: ${row.token}`);
        await env.D1_DB.prepare(
          "DELETE FROM user_push_tokens WHERE user_id = ? AND token = ?"
        ).bind(userId, row.token).run().catch((e: any) => {
          console.error('Failed to delete invalid token from DB:', e);
        });
      } else {
        console.warn(`FCM temporary error for token ${row.token}. Retaining token in DB.`);
      }
    });

    await Promise.all(promises);
    return successCount;
  } catch (err) {
    console.error(`Failed to send FCM notification to user ${userId}:`, err);
    return 0;
  }
}

/**
 * データベースの role が 'admin' であるすべての管理者ユーザー宛てにプッシュ通知を一括送信します。
 */
export async function sendFcmNotificationToAdmins(
  env: any,
  payload: FcmNotificationPayload
): Promise<number> {
  try {
    if (!env.D1_DB) {
      console.warn('D1_DB binding not found. Cannot fetch admin push tokens.');
      return 0;
    }

    // 1. D1から管理者ユーザーのID一覧を取得
    const { results: admins } = await env.D1_DB.prepare(
      "SELECT id FROM users WHERE role = 'admin'"
    ).all();

    if (!admins || admins.length === 0) {
      console.log('No admin users found in database.');
      return 0;
    }

    console.log(`Found ${admins.length} admin user(s). Preparing to send admin push notifications...`);

    let totalNotificationCount = 0;
    
    // 各管理者に並行して送信
    const promises = (admins as any[]).map(async (admin) => {
      const count = await sendFcmNotificationToUser(env, admin.id, payload);
      totalNotificationCount += count;
    });

    await Promise.all(promises);
    return totalNotificationCount;
  } catch (err) {
    console.error('Failed to send FCM notification to admins:', err);
    return 0;
  }
}
