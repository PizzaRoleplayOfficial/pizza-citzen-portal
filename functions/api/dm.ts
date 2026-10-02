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
      is_group INTEGER DEFAULT 0,
      name TEXT,
      icon TEXT,
      owner_id TEXT,
      UNIQUE(user1_id, user2_id)
    );
  `).run().catch(() => {});

  // Add columns if table already existed without them
  try { await db.prepare("ALTER TABLE dm_conversations ADD COLUMN is_group INTEGER DEFAULT 0").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE dm_conversations ADD COLUMN name TEXT").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE dm_conversations ADD COLUMN icon TEXT").run(); } catch (e) {}
  try { await db.prepare("ALTER TABLE dm_conversations ADD COLUMN owner_id TEXT").run(); } catch (e) {}

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_user1 ON dm_conversations(user1_id);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_user2 ON dm_conversations(user2_id);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_conv_updated ON dm_conversations(updated_at);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_conversation_members (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      joined_at TEXT DEFAULT (datetime('now')),
      role TEXT DEFAULT 'member',
      last_read_at TEXT DEFAULT (datetime('now')),
      is_left INTEGER DEFAULT 0,
      left_at TEXT,
      UNIQUE(conversation_id, user_id)
    );
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_members_user ON dm_conversation_members(user_id, is_left);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_members_conv ON dm_conversation_members(conversation_id, is_left);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      content TEXT,
      image_data TEXT,
      reply_to_id TEXT,
      is_read INTEGER DEFAULT 0,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_msg_conv ON dm_messages(conversation_id, created_at);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_msg_recipient_unread ON dm_messages(recipient_id, is_read);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_reactions (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(message_id, user_id, emoji)
    );
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_reactions_msg ON dm_reactions(message_id);
  `).run().catch(() => {});

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_dm_reactions_conv ON dm_reactions(conversation_id);
  `).run().catch(() => {});
};

/**
 * Helper to ensure a unique conversation pair (user1_id < user2_id) for 1-on-1
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
    // 1. Get total unread count for badge (1-on-1 + group unread count)
    if (action === 'unread_total') {
      const oneOnOneRow = await env.D1_DB.prepare(
        "SELECT COUNT(*) as count FROM dm_messages WHERE recipient_id = ? AND is_read = 0"
      ).bind(userId).first() as any;

      const groupRow = await env.D1_DB.prepare(`
        SELECT COUNT(*) as count
        FROM dm_messages m
        JOIN dm_conversation_members cm ON m.conversation_id = cm.conversation_id
        WHERE cm.user_id = ? AND cm.is_left = 0
          AND m.recipient_id = 'group'
          AND m.created_at > COALESCE(cm.last_read_at, '1970-01-01')
          AND m.sender_id != ?
      `).bind(userId, userId).first() as any;

      const totalUnread = (oneOnOneRow?.count || 0) + (groupRow?.count || 0);

      return new Response(JSON.stringify({ unread_total: totalUnread }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1.5 Ultra-lightweight conversation update check (single-row index lookup, CPU < 0.5ms)
    if (action === 'check_updates') {
      const conversationId = url.searchParams.get('conversationId') || '';
      const since = url.searchParams.get('since') || '';

      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Check conversation row
      const conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id, is_group, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) as updated_at, strftime('%Y-%m-%dT%H:%M:%SZ', last_message_at) as last_message_at FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Authorization check
      if (conv.is_group === 1) {
        const mem = await env.D1_DB.prepare(
          "SELECT 1 FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ? AND is_left = 0"
        ).bind(conversationId, userId).first();
        if (!mem) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
        }
      } else if (conv.user1_id !== userId && conv.user2_id !== userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
      }

      const latestStamp = conv.updated_at || conv.last_message_at || '';
      const hasUpdates = !since || !latestStamp || latestStamp > since;

      return new Response(JSON.stringify({
        has_updates: hasUpdates,
        updated_at: latestStamp
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // 2. Search users to start new DM or invite to group
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
        LIMIT 25
      `).bind(currentUserId, pattern, pattern).all();

      return new Response(JSON.stringify({ users: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 2.5 Get Group Members
    if (action === 'group_members') {
      const conversationId = url.searchParams.get('conversationId') || '';
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      const { results } = await env.D1_DB.prepare(`
        SELECT 
          cm.id as member_row_id,
          cm.user_id as id,
          cm.role,
          strftime('%Y-%m-%dT%H:%M:%SZ', cm.joined_at) as joined_at,
          u.username,
          u.roblox_username,
          u.avatar,
          u.role as user_role
        FROM dm_conversation_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.conversation_id = ? AND cm.is_left = 0
        ORDER BY CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END, u.username ASC
      `).bind(conversationId).all();

      return new Response(JSON.stringify({ members: results || [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Get or create conversation with a target user (1-on-1)
    if (action === 'get_or_create') {
      const targetUserId = url.searchParams.get('targetUserId') || '';
      if (!targetUserId || targetUserId === userId) {
        return new Response(JSON.stringify({ error: 'Invalid targetUserId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const [u1, u2] = getSortedUserPair(userId, targetUserId);

      // Check if 1-on-1 conversation exists
      let conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id, is_group, name, icon, last_message_text, strftime('%Y-%m-%dT%H:%M:%SZ', last_message_at) as last_message_at, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) as updated_at FROM dm_conversations WHERE user1_id = ? AND user2_id = ?"
      ).bind(u1, u2).first() as any;

      if (!conv) {
        const id = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_conversations (id, user1_id, user2_id, last_message_text, last_message_at, updated_at, is_group)
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        `).bind(id, u1, u2).run();

        conv = {
          id,
          user1_id: u1,
          user2_id: u2,
          is_group: 0,
          name: null,
          icon: null,
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

      // Verify conversation
      const conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id, is_group, name, icon, owner_id, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at) as updated_at, strftime('%Y-%m-%dT%H:%M:%SZ', last_message_at) as last_message_at FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let partner: any = null;
      let members: any[] = [];

      if (conv.is_group === 1) {
        // Verify group membership
        const membership = await env.D1_DB.prepare(
          "SELECT role, is_left FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ?"
        ).bind(conversationId, userId).first() as any;

        if (!membership || membership.is_left === 1) {
          return new Response(JSON.stringify({ error: 'You are not an active member of this group' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // Update last read time for this user in the group
        await env.D1_DB.prepare(`
          UPDATE dm_conversation_members
          SET last_read_at = CURRENT_TIMESTAMP
          WHERE conversation_id = ? AND user_id = ?
        `).bind(conversationId, userId).run().catch(() => {});

        // Fetch active members
        const { results: memberRows } = await env.D1_DB.prepare(`
          SELECT 
            cm.user_id as id,
            cm.role,
            strftime('%Y-%m-%dT%H:%M:%SZ', cm.joined_at) as joined_at,
            u.username,
            u.roblox_username,
            u.avatar,
            u.role as user_role
          FROM dm_conversation_members cm
          JOIN users u ON cm.user_id = u.id
          WHERE cm.conversation_id = ? AND cm.is_left = 0
          ORDER BY CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END, u.username ASC
        `).bind(conversationId).all();

        members = memberRows || [];

        partner = {
          id: conv.id,
          username: conv.name || 'グループチャット',
          roblox_username: null,
          avatar: conv.icon || '',
          role: 'group',
          is_group: true,
          owner_id: conv.owner_id,
          member_count: members.length
        };
      } else {
        // 1-on-1
        if (conv.user1_id !== userId && conv.user2_id !== userId) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        const partnerId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;

        // Mark 1-on-1 unread messages as read
        await env.D1_DB.prepare(`
          UPDATE dm_messages 
          SET is_read = 1, read_at = CURRENT_TIMESTAMP 
          WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
        `).bind(conversationId, userId).run().catch(() => {});

        partner = await env.D1_DB.prepare(
          "SELECT id, username, roblox_username, avatar, role FROM users WHERE id = ?"
        ).bind(partnerId).first() as any;

        if (partner) {
          partner.is_group = false;
        }
      }

      // Mark notifications in notification center as read
      await env.D1_DB.prepare(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE user_id = ? AND is_read = 0 
          AND instr(link_action, ?) > 0
      `).bind(userId, conversationId).run().catch(() => {});

      // Fetch messages with sender details (for group avatar & name display)
      const limitParam = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 1000);
      const beforeTimestamp = url.searchParams.get('before');

      let query = `
        SELECT 
          id, conversation_id, sender_id, recipient_id, content, image_data, is_read, read_at, created_at,
          reply_to_id, reply_content, reply_sender_id, reply_sender_name, reply_image,
          sender_username, sender_roblox_username, sender_avatar, sender_role
        FROM (
          SELECT 
            m.id, m.conversation_id, m.sender_id, m.recipient_id, m.content, m.image_data, m.is_read, m.read_at,
            strftime('%Y-%m-%dT%H:%M:%SZ', m.created_at) as created_at,
            m.reply_to_id,
            orig.content as reply_content,
            orig.sender_id as reply_sender_id,
            orig_user.username as reply_sender_name,
            orig.image_data as reply_image,
            u.username as sender_username,
            u.roblox_username as sender_roblox_username,
            u.avatar as sender_avatar,
            u.role as sender_role
          FROM dm_messages m
          LEFT JOIN dm_messages orig ON m.reply_to_id = orig.id
          LEFT JOIN users orig_user ON orig.sender_id = orig_user.id
          LEFT JOIN users u ON m.sender_id = u.id
          WHERE m.conversation_id = ?
          ${beforeTimestamp ? 'AND m.created_at < ?' : ''}
          ORDER BY m.created_at DESC, m.rowid DESC
          LIMIT ?
        )
        ORDER BY created_at ASC
      `;

      const bindings = beforeTimestamp
        ? [conversationId, beforeTimestamp, limitParam]
        : [conversationId, limitParam];

      const { results: rawMessages } = await env.D1_DB.prepare(query).bind(...bindings).all();

      // Fetch reactions for this conversation
      const { results: rawReactions } = await env.D1_DB.prepare(`
        SELECT r.id, r.message_id, r.user_id, r.emoji, u.username
        FROM dm_reactions r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.conversation_id = ?
      `).bind(conversationId).all().catch(() => ({ results: [] }));

      // Group reactions by message_id
      const reactionsByMsg: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }[]> = {};
      if (rawReactions && rawReactions.length > 0) {
        for (const item of rawReactions as any[]) {
          if (!reactionsByMsg[item.message_id]) {
            reactionsByMsg[item.message_id] = [];
          }
          let entry = reactionsByMsg[item.message_id].find(e => e.emoji === item.emoji);
          if (!entry) {
            entry = { emoji: item.emoji, count: 0, users: [], hasReacted: false };
            reactionsByMsg[item.message_id].push(entry);
          }
          entry.count += 1;
          entry.users.push(item.username || 'User');
          if (item.user_id === userId) {
            entry.hasReacted = true;
          }
        }
      }

      const messagesWithReactions = (rawMessages || []).map((m: any) => ({
        ...m,
        reactions: reactionsByMsg[m.id] || []
      }));

      return new Response(JSON.stringify({
        conversationId,
        partner,
        members,
        messages: messagesWithReactions,
        updatedAt: conv?.updated_at || conv?.last_message_at || new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. Default: Fetch conversations list for user (1-on-1 + Group chats)
    const { results } = await env.D1_DB.prepare(`
      SELECT 
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_text,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.last_message_at) as last_message_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) as updated_at,
        0 as is_group,
        NULL as group_name,
        NULL as group_icon,
        NULL as group_owner_id,
        0 as member_count,
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
      WHERE (c.is_group IS NULL OR c.is_group = 0) AND (c.user1_id = ? OR c.user2_id = ?)

      UNION ALL

      SELECT
        c.id,
        c.user1_id,
        c.user2_id,
        c.last_message_text,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.last_message_at) as last_message_at,
        strftime('%Y-%m-%dT%H:%M:%SZ', c.updated_at) as updated_at,
        1 as is_group,
        c.name as group_name,
        c.icon as group_icon,
        c.owner_id as group_owner_id,
        (SELECT COUNT(*) FROM dm_conversation_members m WHERE m.conversation_id = c.id AND m.is_left = 0) as member_count,
        c.id as partner_id,
        COALESCE(c.name, 'グループチャット') as partner_username,
        NULL as partner_roblox_username,
        c.icon as partner_avatar,
        'group' as partner_role,
        (
          SELECT COUNT(*)
          FROM dm_messages m
          WHERE m.conversation_id = c.id
            AND m.recipient_id = 'group'
            AND m.created_at > COALESCE((SELECT last_read_at FROM dm_conversation_members mem WHERE mem.conversation_id = c.id AND mem.user_id = ?), '1970-01-01')
            AND m.sender_id != ?
        ) as unread_count
      FROM dm_conversations c
      JOIN dm_conversation_members cm ON cm.conversation_id = c.id AND cm.user_id = ? AND cm.is_left = 0
      WHERE c.is_group = 1

      ORDER BY updated_at DESC
    `).bind(userId, userId, userId, userId, userId, userId, userId, userId).all();

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
    const body = await request.json() as any;
    const { action = 'send', senderId, content, imageData } = body;
    let { conversationId } = body;

    if (!senderId) {
      return new Response(JSON.stringify({ error: 'Missing senderId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 0: Toggle emoji reaction on a message
    if (action === 'toggle_reaction') {
      const messageId = body.messageId;
      const emoji = (body.emoji || '').trim();

      if (!messageId || !emoji || !senderId) {
        return new Response(JSON.stringify({ error: 'messageId, emoji, and senderId required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const msg = await env.D1_DB.prepare(
        "SELECT id, conversation_id FROM dm_messages WHERE id = ?"
      ).bind(messageId).first() as any;

      if (!msg) {
        return new Response(JSON.stringify({ error: 'Message not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const existing = await env.D1_DB.prepare(
        "SELECT id FROM dm_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?"
      ).bind(messageId, senderId, emoji).first() as any;

      let reactionResult = 'added';
      if (existing) {
        await env.D1_DB.prepare(
          "DELETE FROM dm_reactions WHERE id = ?"
        ).bind(existing.id).run();
        reactionResult = 'removed';
      } else {
        const reactionId = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_reactions (id, message_id, conversation_id, user_id, emoji, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(reactionId, messageId, msg.conversation_id, senderId, emoji).run();
        reactionResult = 'added';
      }

      // Touch conversation updated_at for instant adaptive sync
      await env.D1_DB.prepare(
        "UPDATE dm_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(msg.conversation_id).run().catch(() => {});

      return new Response(JSON.stringify({
        success: true,
        action: reactionResult,
        messageId,
        emoji
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 0.5: Create Group Chat
    if (action === 'create_group') {
      const groupName = (body.name || '').trim();
      const groupIcon = (body.icon || '').trim() || null;
      const memberIds = Array.isArray(body.memberIds) ? Array.from(new Set(body.memberIds.filter((id: any) => typeof id === 'string' && id && id !== senderId))) : [];

      if (!groupName) {
        return new Response(JSON.stringify({ error: 'グループ名を入力してください' }), { status: 400 });
      }

      if (memberIds.length === 0) {
        return new Response(JSON.stringify({ error: 'グループに招待するメンバーを1人以上選択してください' }), { status: 400 });
      }

      const newConvId = crypto.randomUUID();
      const creator = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(senderId).first() as any;
      const creatorName = creator?.username || 'ユーザー';

      // Insert conversation
      await env.D1_DB.prepare(`
        INSERT INTO dm_conversations (id, user1_id, user2_id, is_group, name, icon, owner_id, last_message_text, last_message_at, updated_at)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).bind(newConvId, senderId, `group_${newConvId}`, groupName, groupIcon, senderId, `${creatorName}がグループ「${groupName}」を作成しました`).run();

      // Add creator as owner
      const ownerMemberId = crypto.randomUUID();
      await env.D1_DB.prepare(`
        INSERT INTO dm_conversation_members (id, conversation_id, user_id, role, last_read_at)
        VALUES (?, ?, ?, 'owner', CURRENT_TIMESTAMP)
      `).bind(ownerMemberId, newConvId, senderId).run();

      // Add members
      for (const mId of memberIds) {
        const mRowId = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_conversation_members (id, conversation_id, user_id, role, last_read_at)
          VALUES (?, ?, ?, 'member', CURRENT_TIMESTAMP)
        `).bind(mRowId, newConvId, mId).run().catch(() => {});
      }

      // Initial system welcome message
      const sysMsgId = crypto.randomUUID();
      await env.D1_DB.prepare(`
        INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, is_read, created_at)
        VALUES (?, ?, ?, 'group', ?, 1, CURRENT_TIMESTAMP)
      `).bind(sysMsgId, newConvId, senderId, `${creatorName}がグループ「${groupName}」を作成しました`).run();

      // Send push notification to all initial members
      for (const mId of memberIds) {
        sendFcmNotificationToUser(env, mId as string, {
          title: `👥 新しいグループ「${groupName}」`,
          body: `${creatorName}さんがあなたをグループに招待しました`,
          channelId: 'dm_messages_channel',
          tag: `dm_${newConvId}`,
          data: {
            action: `dm?conversationId=${newConvId}`,
            conversationId: newConvId,
            type: 'dm_group_invite',
            groupName
          }
        }).catch(() => {});
      }

      return new Response(JSON.stringify({
        success: true,
        conversationId: newConvId,
        message: 'グループを作成しました'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 0.6: Add Members to Group
    if (action === 'add_group_members') {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      const newMemberIds = Array.isArray(body.newMemberIds) ? Array.from(new Set(body.newMemberIds.filter((id: any) => typeof id === 'string' && id))) : [];
      if (newMemberIds.length === 0) {
        return new Response(JSON.stringify({ error: '追加するメンバーを選択してください' }), { status: 400 });
      }

      // Verify group and membership
      const conv = await env.D1_DB.prepare(
        "SELECT id, name, is_group FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv || conv.is_group !== 1) {
        return new Response(JSON.stringify({ error: 'Group conversation not found' }), { status: 404 });
      }

      const actorMem = await env.D1_DB.prepare(
        "SELECT 1 FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ? AND is_left = 0"
      ).bind(conversationId, senderId).first();

      if (!actorMem) {
        return new Response(JSON.stringify({ error: 'You are not a member of this group' }), { status: 403 });
      }

      const actor = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(senderId).first() as any;
      const actorName = actor?.username || 'メンバー';

      const addedNames: string[] = [];

      for (const mId of newMemberIds) {
        const u = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(mId).first() as any;
        if (!u) continue;

        const existing = await env.D1_DB.prepare(
          "SELECT id, is_left FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ?"
        ).bind(conversationId, mId).first() as any;

        if (existing) {
          if (existing.is_left === 1) {
            await env.D1_DB.prepare(
              "UPDATE dm_conversation_members SET is_left = 0, joined_at = CURRENT_TIMESTAMP, last_read_at = CURRENT_TIMESTAMP WHERE id = ?"
            ).bind(existing.id).run();
            addedNames.push(u.username);
          }
        } else {
          const rowId = crypto.randomUUID();
          await env.D1_DB.prepare(
            "INSERT INTO dm_conversation_members (id, conversation_id, user_id, role, last_read_at) VALUES (?, ?, ?, 'member', CURRENT_TIMESTAMP)"
          ).bind(rowId, conversationId, mId).run();
          addedNames.push(u.username);
        }

        // Notify newly added user
        sendFcmNotificationToUser(env, mId as string, {
          title: `👥 グループ「${conv.name}」への招待`,
          body: `${actorName}さんがあなたをグループに追加しました`,
          channelId: 'dm_messages_channel',
          tag: `dm_${conversationId}`,
          data: {
            action: `dm?conversationId=${conversationId}`,
            conversationId,
            type: 'dm_group_invite',
            groupName: conv.name
          }
        }).catch(() => {});
      }

      if (addedNames.length > 0) {
        const sysMsg = `${actorName}が${addedNames.join('、')}さんを追加しました`;
        const sysMsgId = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, is_read, created_at)
          VALUES (?, ?, ?, 'group', ?, 1, CURRENT_TIMESTAMP)
        `).bind(sysMsgId, conversationId, senderId, sysMsg).run();

        await env.D1_DB.prepare(`
          UPDATE dm_conversations 
          SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).bind(sysMsg, conversationId).run();
      }

      return new Response(JSON.stringify({ success: true, addedCount: addedNames.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 0.7: Leave Group
    if (action === 'leave_group') {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      const conv = await env.D1_DB.prepare(
        "SELECT id, name, is_group, owner_id FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv || conv.is_group !== 1) {
        return new Response(JSON.stringify({ error: 'Group conversation not found' }), { status: 404 });
      }

      const actor = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(senderId).first() as any;
      const actorName = actor?.username || 'メンバー';

      // Set member left
      await env.D1_DB.prepare(`
        UPDATE dm_conversation_members 
        SET is_left = 1, left_at = CURRENT_TIMESTAMP 
        WHERE conversation_id = ? AND user_id = ?
      `).bind(conversationId, senderId).run();

      const sysMsg = `${actorName}がグループを退出しました`;
      const sysMsgId = crypto.randomUUID();
      await env.D1_DB.prepare(`
        INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, is_read, created_at)
        VALUES (?, ?, ?, 'group', ?, 1, CURRENT_TIMESTAMP)
      `).bind(sysMsgId, conversationId, senderId, sysMsg).run();

      // If owner left, reassign owner to next oldest active member
      if (conv.owner_id === senderId) {
        const nextOwner = await env.D1_DB.prepare(
          "SELECT user_id FROM dm_conversation_members WHERE conversation_id = ? AND is_left = 0 ORDER BY joined_at ASC LIMIT 1"
        ).bind(conversationId).first() as any;

        if (nextOwner) {
          await env.D1_DB.prepare("UPDATE dm_conversation_members SET role = 'owner' WHERE conversation_id = ? AND user_id = ?").bind(conversationId, nextOwner.user_id).run();
          await env.D1_DB.prepare("UPDATE dm_conversations SET owner_id = ? WHERE id = ?").bind(nextOwner.user_id, conversationId).run();
        }
      }

      await env.D1_DB.prepare(`
        UPDATE dm_conversations 
        SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(sysMsg, conversationId).run();

      return new Response(JSON.stringify({ success: true, message: 'グループを退出しました' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 0.8: Update Group Info (Name / Icon)
    if (action === 'update_group') {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      const newName = (body.name || '').trim();
      const newIcon = (body.icon || '').trim() || null;

      if (!newName) {
        return new Response(JSON.stringify({ error: 'グループ名を入力してください' }), { status: 400 });
      }

      const conv = await env.D1_DB.prepare(
        "SELECT id, name, icon, is_group FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv || conv.is_group !== 1) {
        return new Response(JSON.stringify({ error: 'Group not found' }), { status: 404 });
      }

      const actor = await env.D1_DB.prepare("SELECT username FROM users WHERE id = ?").bind(senderId).first() as any;
      const actorName = actor?.username || 'メンバー';

      await env.D1_DB.prepare(`
        UPDATE dm_conversations
        SET name = ?, icon = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newName, newIcon, conversationId).run();

      const sysMsg = `${actorName}がグループ情報を変更しました（${newName}）`;
      const sysMsgId = crypto.randomUUID();
      await env.D1_DB.prepare(`
        INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, is_read, created_at)
        VALUES (?, ?, ?, 'group', ?, 1, CURRENT_TIMESTAMP)
      `).bind(sysMsgId, conversationId, senderId, sysMsg).run();

      await env.D1_DB.prepare(`
        UPDATE dm_conversations 
        SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(sysMsg, conversationId).run();

      return new Response(JSON.stringify({ success: true, name: newName, icon: newIcon }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Action 1: Mark messages in a conversation as read
    if (action === 'mark_read') {
      if (!conversationId) {
        return new Response(JSON.stringify({ error: 'Missing conversationId' }), { status: 400 });
      }

      const conv = await env.D1_DB.prepare(
        "SELECT id, is_group FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (conv && conv.is_group === 1) {
        await env.D1_DB.prepare(`
          UPDATE dm_conversation_members
          SET last_read_at = CURRENT_TIMESTAMP
          WHERE conversation_id = ? AND user_id = ?
        `).bind(conversationId, senderId).run();
      } else {
        await env.D1_DB.prepare(`
          UPDATE dm_messages 
          SET is_read = 1, read_at = CURRENT_TIMESTAMP 
          WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
        `).bind(conversationId, senderId).run();
      }

      await env.D1_DB.prepare(`
        UPDATE dm_conversations 
        SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(conversationId).run().catch(() => {});

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

    // Action 2: Send message
    const trimmedContent = (content || '').trim();
    if (!trimmedContent && !imageData) {
      return new Response(JSON.stringify({ error: 'Message cannot be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let actualRecipientId = body.recipientId;
    let isGroupConv = false;
    let groupConvName = '';

    if (!conversationId) {
      if (!actualRecipientId) {
        return new Response(JSON.stringify({ error: 'recipientId or conversationId required' }), { status: 400 });
      }
      const [u1, u2] = getSortedUserPair(senderId, actualRecipientId);
      let conv = await env.D1_DB.prepare(
        "SELECT id FROM dm_conversations WHERE user1_id = ? AND user2_id = ?"
      ).bind(u1, u2).first() as any;

      if (!conv) {
        conversationId = crypto.randomUUID();
        await env.D1_DB.prepare(`
          INSERT INTO dm_conversations (id, user1_id, user2_id, last_message_text, last_message_at, updated_at, is_group)
          VALUES (?, ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0)
        `).bind(conversationId, u1, u2).run();
      } else {
        conversationId = conv.id;
      }
    } else {
      const conv = await env.D1_DB.prepare(
        "SELECT id, user1_id, user2_id, is_group, name FROM dm_conversations WHERE id = ?"
      ).bind(conversationId).first() as any;

      if (!conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 });
      }

      if (conv.is_group === 1) {
        isGroupConv = true;
        groupConvName = conv.name || 'グループチャット';
        actualRecipientId = 'group';

        // Verify membership
        const mem = await env.D1_DB.prepare(
          "SELECT 1 FROM dm_conversation_members WHERE conversation_id = ? AND user_id = ? AND is_left = 0"
        ).bind(conversationId, senderId).first();

        if (!mem) {
          return new Response(JSON.stringify({ error: 'You are not a member of this group' }), { status: 403 });
        }
      } else if (!actualRecipientId) {
        actualRecipientId = conv.user1_id === senderId ? conv.user2_id : conv.user1_id;
      }
    }

    const messageId = crypto.randomUUID();
    const replyToId = body.replyToId || null;
    const previewText = trimmedContent 
      ? (trimmedContent.length > 60 ? trimmedContent.substring(0, 60) + '...' : trimmedContent)
      : '📷 [画像]';

    // Insert message
    await env.D1_DB.prepare(`
      INSERT INTO dm_messages (id, conversation_id, sender_id, recipient_id, content, image_data, reply_to_id, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).bind(messageId, conversationId, senderId, actualRecipientId, trimmedContent, imageData || null, replyToId).run();

    // If sender in group, also update sender last_read_at
    if (isGroupConv) {
      await env.D1_DB.prepare(`
        UPDATE dm_conversation_members
        SET last_read_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ? AND user_id = ?
      `).bind(conversationId, senderId).run().catch(() => {});
    }

    // Update conversation metadata
    await env.D1_DB.prepare(`
      UPDATE dm_conversations 
      SET last_message_text = ?, last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(previewText, conversationId).run();

    // Push notification handling
    try {
      const sender = await env.D1_DB.prepare(
        "SELECT username, avatar FROM users WHERE id = ?"
      ).bind(senderId).first() as any;

      if (sender) {
        if (isGroupConv) {
          // GROUP: Send push notification to all other active group members
          const { results: otherMembers } = await env.D1_DB.prepare(`
            SELECT user_id FROM dm_conversation_members 
            WHERE conversation_id = ? AND user_id != ? AND is_left = 0
          `).bind(conversationId, senderId).all();

          for (const m of (otherMembers || []) as any[]) {
            const memberTargetId = m.user_id;
            const notifTitle = `👥 [${groupConvName}] ${sender.username}`;
            const notifBody = replyToId ? `↩️ 返信: ${previewText}` : previewText;

            sendFcmNotificationToUser(env, memberTargetId, {
              title: notifTitle,
              body: notifBody,
              channelId: 'dm_messages_channel',
              tag: `dm_${conversationId}`,
              data: {
                action: `dm?conversationId=${conversationId}`,
                conversationId,
                recipientId: memberTargetId,
                senderUsername: sender.username,
                senderAvatar: sender.avatar || '',
                type: 'dm_group_message',
                groupName: groupConvName,
                lastMessage: previewText
              }
            }).catch(() => {});
          }
        } else if (actualRecipientId) {
          // 1-on-1: Send stacked push notification
          const unreadCountRow = await env.D1_DB.prepare(`
            SELECT COUNT(*) as count FROM dm_messages 
            WHERE conversation_id = ? AND recipient_id = ? AND is_read = 0
          `).bind(conversationId, actualRecipientId).first() as any;
          const unreadCount = unreadCountRow?.count || 1;

          let notifTitle = replyToId 
            ? `💬 ${sender.username}さんからの返信` 
            : `💬 ${sender.username}さんからの新着メッセージ`;
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
