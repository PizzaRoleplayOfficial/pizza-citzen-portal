import { sendFcmNotificationToUser } from '../utils/fcm';

/**
 * Cloudflare D1: Ensure DM tables and indexes exist
 */
const ensureDmTables = async (db: any) => {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id TEXT PRIMARY KEY,
      user1_id TEXT NOT NULL,
      user2_id TEXT NOT NULL,
      last_message_text TEXT,
      last_message_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user1_id, user2_id)
    );
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_user1 ON dm_conversations(user1_id);
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_user2 ON dm_conversations(user2_id);
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_updated ON dm_conversations(updated_at);
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      content TEXT,
      image_data TEXT,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_msg_conv ON dm_messages(conversation_id, created_at);
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_msg_recipient_unread ON dm_messages(recipient_id, is_read);
  `).run();
};

/**
 * Helper to ensure a unique conversation pair (user1_id < user2_id)
 */
const getSortedUserPair = (u1: string, u2: string) => {
  return u1 < u2 ? [u1, u2] : [u2, u1];
};

export const onRequestGet = async ({ env, request }: { env: any, request: Request }) => {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'conversations';
  const userId = url.searchParams.get('userId') || '';

  if (!userId && action !== 'search_users') {
    return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // ensureDmTables skipped on GET for performance

    // 1. Get total unread count for badge
    if (action === 'unread_total') {
      const result = await env.D1_DB.prepare(
        "SELECT COUNT(*) as count FROM dm_messages WHERE recipient_id = ? AND is_read = 0"
      ).bind(userId).first() as any;

      return new Response(JSON.stringify({ unread_total: result?.count || 0 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2. Search users to start new DM
    if (action === 'search_users') {
      const query = (url.searchParams.get('query') || '').trim();
      const currentUserId = url.searchParams.get('currentUserId') || userId;
      if (!query) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const pattern = `%${query}%`;
      const { results } = await env.D1_DB.prepare(`
        SELECT id, username, roblox_username, avatar, role 
        FROM users 
        WHERE id != ? AND (username LIKE ? OR roblox_username LIKE ?) 
        ORDER BY username ASC 
        LIMIT 20
      `).bind(currentUserId, pattern, pattern).all();

      return new Response(JSON.stringify({ users: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Get or create conversation with a target user
    if (action === 'get_or_create') {
      const targetUserId = url.searchParams.get('targetUserId') || '';
      if (!targetUserId || targetUserId === userId) {
        return new Response(JSON.stringify({ error: 'Invalid targetUserId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const [u1, u2] = getSortedUserPair(userId, targetUserId);

      // Check if conversation exists
      let conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id, last_message_text, strftime('%Y-%m-%dT%H:%M:%SZ', last_message_at) as last_message_at, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) as updated_at FROM dm_conversations WHERE user1_id = ? AND user2_id = ?"
      ).bind(u1, u2).first() as any;

      if (!conv) {
        const id = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_conversations (id, user1_id, user2_id, last_message_text, last_message_at, updated_at)
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(id, u1, u2).run();

        conv = {
          id,
          user1_id: u1,
          user2_id: u2,
          last_message_text: null,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }

      // Fetch partner info
      const partner = await env.D1_DB.prepare(
        "SELECT id, username, roblox_username, avatar, role FROM users WHERE id = ?"
      ).bind(targetUserId).first() as any;

      return new Response(JSON.stringify({ conversation: conv, partner }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 4. Fetch all messages in a conversation
    if (action === 'messages') {
      const conversationId = url.searchParams.get('conversationId') || '';
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Verify user is in this conversation
      const conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv || (conv.user1_id !== userId && conv.user2_id !== userId)) {
        return new Response(JSON.stringify({ error: 'Conversation not found or unauthorized' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const partnerId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

      // Check if unread messages exist before running UPDATE queries
      const unreadRow = await env.D1_DB.prepare(
        "SELECT 1 FROM dm_messages WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0 LIMIT 1"
      ).bind(conversationId, userId).first();

      if (unreadRow) {
        await env.D1_DB.prepare(`
          UPDATE dm_messages 
          SET is_read = 1, read_at = CURRENT_TIMESTAMP 
          WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
        `).bind(conversationId, userId).run();

        await env.D1_DB.prepare(`
          UPDATE notifications 
          SET is_read = 1 
          WHERE user_id = ? AND is_read = 0 
            AND instr(link_action, ?) > 0
        `).bind(userId, conversationId).run().catch(() => {});
      }

      // Fetch partner profile
      const partner = await env.D1_DB.prepare(
        "SELECT id, username, roblox_username, avatar, role FROM users WHERE id = ?"
      ).bind(partnerId).first() as any;

      // Fetch messages (up to 500 latest messages, ordered chronologically from oldest to newest)
      const limitParam = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 1000);
      const beforeTimestamp = url.searchParams.get('before');

      let query = `
        SELECT id, conversation_id, sender_id, recipient_id, content, image_data, is_read, read_at, created_at
        FROM (
          SELECT id, conversation_id, sender_id, recipient_id, content, image_data, is_read, read_at, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) as created_at
          FROM dm_messages
          WHERE conversation_id = ?
          ${beforeTimestamp ? 'AND created_at < ?' : ''}
          ORDER BY created_at DESC, rowid DESC
          LIMIT ?
        )
        ORDER BY created_at ASC
      `;

      const bindings = beforeTimestamp
        ? [conversationId, beforeTimestamp, limitParam]
        : [conversationId, limitParam];

      const { results: rawMessages } = await env.D1_DB.prepare(query).bind(...bindings).all();

      return new Response(JSON.stringify({
        conversationId,
        partner,
        messages: rawMessages || []
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Default: Fetch conversations list for user
    const { results } = await env.D1_DB.prepare(`
      SELECT 
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_text,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.last_message_at) as last_message_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) as updated_at,
        CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as partner_id,
        u.username as partner_username,
        u.roblox_username as partner_roblox_username,
        u.avatar as partner_avatar,
        u.role as partner_role,
        (
          SELECT COUNT(*) 
          FROM dm_messages m 
          WHERE m.conversation_id = c.id AND m.recipient_id = ? AND m.is_read = 0
        ) as unread_count
      FROM dm_conversations c
      JOIN users u ON u.id = (CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END)
      WHERE c.user1_id = ? OR c.user2_id = ?
      ORDER BY c.updated_at DESC
    `).bind(userId, userId, userId, userId, userId).all();

    return new Response(JSON.stringify({ conversations: results || [] }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error("DM API GET Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPost = async ({ env, request }: { env: any, request: Request }) => {
  try {
    // ensureDmTables skipped on GET for performance

    const body = await request.json() as any;
    const { action = 'send', senderId, recipientId, content, imageData } = body;
    let { conversationId } = body;

    if (!senderId) {
      return new Response(JSON.stringify({ error: 'Missing senderId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 1: Mark messages in a conversation as read
    if (action === 'mark_read') {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      await env.D1_DB.prepare(`
        UPDATE dm_messages 
        SET is_read = 1, read_at = CURRENT_TIMESTAMP 
        WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
      `).bind(conversationId, senderId).run();

      // Also mark notifications in notification center as read for this conversation
      await env.D1_DB.prepare(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE user_id = ? AND is_read = 0 
          AND instr(link_action, ?) > 0
      `).bind(senderId, conversationId).run().catch(() => {});

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 2: Send message (or direct reply from push notification)
    if (!recipientId && !conversationId) {
      return new Response(JSON.stringify({ error: 'recipientId or conversationId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedContent = (content || '').trim();
    if (!trimmedContent && !imageData) {
      return new Response(JSON.stringify({ error: 'Message cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // If conversationId is not provided, look it up or create it
    let actualRecipientId = recipientId;
    if (!conversationId) {
      const [u1, u2] = getSortedUserPair(senderId, recipientId);
      let conv = await env.D1_DB.prepare(
        "SELECT id FROM dm_conversations WHERE user1_id = ? AND user2_id = ?"
      ).bind(u1, u2).first() as any;

      if (!conv) {
        conversationId = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_conversations (id, user1_id, user2_id, last_message_text, last_message_at, updated_at)
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).bind(conversationId, u1, u2).run();
      } else {
        conversationId = conv.id;
      }
    } else if (!actualRecipientId) {
      // Find recipient from conversation
      const conv = await env.D1_DB.prepare(
        "SELECT user1_id, user2_id FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
      }
      actualRecipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
    }

    const messageId = crypto.randomUUID();
    const previewText = trimmedContent 
      ? (trimmedContent.length > 60 ? trimmedContent.substring(0, 60) + '...' : trimmedContent)
      : '📷 [画像]';

    // Insert message
    await env.D1_DB.prepare(`
      INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, image_data, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).bind(messageId, conversationId, senderId, actualRecipientId, trimmedContent, imageData || null).run();

    // Update conversation metadata
    await env.D1_DB.prepare(`
      UPDATE dm_conversations 
      SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(previewText, conversationId).run();

    // Send FCM push notification with direct reply metadata & stacked message bundling
    try {
      const sender = await env.D1_DB.prepare(
        "SELECT username, avatar FROM users WHERE id = ?"
      ).bind(senderId).first() as any;

      if (sender && actualRecipientId) {
        // Query unread count and latest unread messages for push notification bundling
        const unreadCountRow = await env.D1_DB.prepare(`
          SELECT COUNT(*) as count FROM dm_messages 
          WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
        `).bind(conversationId, actualRecipientId).first() as any;
        const unreadCount = unreadCountRow?.count || 1;

        let notifTitle = `💬 ${sender.username}さんからの新着メッセージ`;
        let notifBody = previewText;

        const { results: unreadRows } = await env.D1_DB.prepare(`
          SELECT content, image_data FROM (
            SELECT content, image_data, created_at FROM dm_messages 
            WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0 
            ORDER BY created_at DESC 
            LIMIT 6
          ) ORDER BY created_at ASC
        `).bind(conversationId, actualRecipientId).all();

        if (unreadCount > 1 && unreadRows && unreadRows.length > 0) {
          notifTitle = `💬 ${sender.username}さんからの新着メッセージ (${unreadCount}件)`;
          const formatted = (unreadRows as any[]).map(r => {
            const txt = (r.content || '').trim();
            return txt ? (txt.length > 40 ? txt.substring(0, 40) + '...' : txt) : '📷 [画像]';
          });
          const slice = formatted.slice(-4);
          notifBody = slice.join('\n');
          if (unreadCount > 4) {
            notifBody = `...他${unreadCount - 4}件\n` + notifBody;
          }
        }

        const messagesData = (unreadRows && unreadRows.length > 0 ? unreadRows : [{ content: previewText }]).slice(-6).map((r: any) => ({
          text: (r.content || '').trim() || (r.image_data ? '📷 [画像]' : '...'),
          sender: sender.username
        }));

        await sendFcmNotificationToUser(env, actualRecipientId, {
          title: notifTitle,
          body: notifBody,
          channelId: 'dm_messages_channel',
          tag: `dm_${conversationId}`,
          notificationCount: unreadCount,
          data: {
            action: `dm?conversationId=${conversationId}&partnerId=${senderId}`,
            conversationId,
            partnerId: senderId,
            recipientId: actualRecipientId,
            senderUsername: sender.username,
            senderAvatar: sender.avatar || '',
            type: 'dm_message',
            canReply: 'true',
            messagesJson: JSON.stringify(messagesData),
            lastMessage: previewText
          }
        });
      }
    } catch (pushErr) {
      console.error("Failed to send DM push notification:", pushErr);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId,
      conversationId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error("DM API POST Error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
