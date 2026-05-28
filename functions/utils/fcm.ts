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
export async function sendFcmNotification(
  env: any,
  token: string,
  payload: { title: string; body: string; channelId?: string; data?: Record<string, string> }
): Promise<boolean> {
  try {
    const serviceAccountJson = env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      console.warn('FIREBASE_SERVICE_ACCOUNT environment variable is not set. Skipping FCM push notification.');
      return false;
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
            sound: 'default'
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
      
      // トークンが失効している（UNREGISTEREDなど）場合は、呼び出し元でDBから削除できるように通知
      if (res.status === 404 || res.status === 410) {
        return false;
      }
      return false;
    }

    const resData = await res.json();
    console.log(`FCM send success:`, resData);
    return true;
  } catch (err) {
    console.error('Failed to send FCM notification:', err);
    return false;
  }
}

async function saveInAppNotification(
  db: any,
  userId: string,
  payload: { title: string; body: string; channelId?: string; data?: Record<string, string> }
) {
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

    const id = crypto.randomUUID();
    const type = payload.channelId || 'general';
    const linkAction = payload.data?.action || null;

    await db.prepare(`
      INSERT INTO notifications (id, user_id, title, body, type, link_action)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, userId, payload.title, payload.body, type, linkAction).run();
    console.log(`Saved in-app notification for user ${userId}: ${payload.title}`);
  } catch (err) {
    console.error('Failed to save in-app notification in DB:', err);
  }
}

/**
 * データベースの指定したユーザーIDに紐づくすべての端末トークンを取得して、通知を送信します。
 */
export async function sendFcmNotificationToUser(
  env: any,
  userId: string,
  payload: { title: string; body: string; channelId?: string; data?: Record<string, string> }
): Promise<number> {
  try {
    if (!env.D1_DB) {
      console.warn('D1_DB binding not found. Cannot fetch push tokens.');
      return 0;
    }

    // Automatically record in-app notification
    await saveInAppNotification(env.D1_DB, userId, payload);

    // チャンネル種別に応じて購読トグルのフィルタリングを変更 (v2.2.2)
    const isChannelAdmin = payload.channelId === 'admin_notifications_channel';
    const isChannelAdminEdit = payload.channelId === 'admin_edit_notifications_channel';
    const isTimelineLike = payload.channelId === 'timeline_likes_channel';
    const isTimelineComment = payload.channelId === 'timeline_comments_channel';
    const isTimelineNewPost = payload.channelId === 'timeline_new_posts_channel';
    
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
    }

    // 1. D1からユーザーのトークンリストを取得
    const { results } = await env.D1_DB.prepare(query).bind(userId).all();

    if (!results || results.length === 0) {
      console.log(`No registered push tokens found for user: ${userId}`);
      return 0;
    }

    console.log(`Found ${results.length} token(s) for user: ${userId}. Sending FCM push notifications...`);

    let successCount = 0;
    
    // 全トークンに並列で通知を送信
    const promises = results.map(async (row: any) => {
      const success = await sendFcmNotification(env, row.token, payload);
      if (success) {
        successCount++;
      } else {
        // トークンが無効な場合（FCMからアンレジスターされたなど）、クリーンアップ処理を行う
        console.log(`FCM token expired or invalid. Removing from DB: ${row.token}`);
        await env.D1_DB.prepare(
          "DELETE FROM user_push_tokens WHERE user_id = ? AND token = ?"
        ).bind(userId, row.token).run().catch((e: any) => {
          console.error('Failed to delete invalid token from DB:', e);
        });
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
  payload: { title: string; body: string; channelId?: string; data?: Record<string, string> }
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
