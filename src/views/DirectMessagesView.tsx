import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  ArrowLeft, 
  Search, 
  Plus, 
  X, 
  CheckCircle2, 
  Clock, 
  Loader2, 
  User as UserIcon, 
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Upload,
  Download,
  ChevronDown,
  Reply,
  CornerDownRight,
  Smile,
  Copy,
  Check,
  Users,
  UserPlus,
  LogOut,
  Settings,
  Crown,
  Edit3
} from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { triggerHaptic, notifyActiveConversation } from '../utils/native';

interface DirectMessagesViewProps {
  currentUser: any;
  isMobile: boolean;
  theme: 'dark' | 'light';
  initialConversationId?: string | null;
  initialTargetUserId?: string | null;
  onClearInitialIds?: () => void;
  onUnreadCountChange?: (count: number) => void;
  onClose?: () => void;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_text: string | null;
  last_message_at: string | null;
  updated_at: string;
  partner_id: string;
  partner_username: string;
  partner_roblox_username: string | null;
  partner_avatar: string | null;
  partner_role: string | null;
  unread_count: number;
  is_group?: number;
  group_name?: string | null;
  group_icon?: string | null;
  group_owner_id?: string | null;
  member_count?: number;
}

interface GroupMember {
  id: string;
  role: 'owner' | 'member';
  joined_at?: string;
  username: string;
  roblox_username?: string | null;
  avatar?: string | null;
  user_role?: string | null;
}

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
  hasReacted: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  image_data: string | null;
  is_read: number;
  read_at: string | null;
  created_at: string;
  reply_to_id?: string | null;
  reply_content?: string | null;
  reply_sender_id?: string | null;
  reply_sender_name?: string | null;
  reply_image?: string | null;
  reactions?: Reaction[];
  sender_username?: string | null;
  sender_roblox_username?: string | null;
  sender_avatar?: string | null;
  sender_role?: string | null;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🍕', '🔥'];

const EMOJI_CATEGORIES = [
  {
    name: '定番・リアクション',
    emojis: ['👍', '❤️', '😂', '😮', '😢', '🙏', '🍕', '🔥', '👏', '🎉', '💯', '✨', '🥺', '🤣', '😍', '👀']
  },
  {
    name: '表情・スマイリー',
    emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🙂', '😉', '😊', '😇', '🥰', '🤩', '😘', '😋', '😜', '🤪', '😎', '🥳', '😏', '😭', '😤', '😡', '🤯', '😳', '😱', '🤫', '😴', '🤤', '🤠']
  },
  {
    name: 'ジェスチャー・手',
    emojis: ['👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '👌', '🤌', '👈', '👉', '👆', '👇', '✋', '🤚', '👋', '💪', '🖕', '✍️', '💅']
  },
  {
    name: 'ハート・感情',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '⭐', '🌟', '💫', '💥', '💢', '💤']
  },
  {
    name: 'アイテム・乗り物・フード',
    emojis: ['🍕', '🍔', '🍟', '🍜', '🍣', '🍱', '🍦', '🍩', '🎂', '☕', '🍵', '🧃', '🥤', '🍺', '🍻', '🚗', '🚓', '🚑', '🏎️', '🏍️', '🚲', '🎁', '🏆', '🎯', '🎮']
  }
];

// Utility: Render formatted message with clickable hyperlinks
const renderFormattedMessageText = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            color: 'var(--primary)',
            textDecoration: 'underline',
            wordBreak: 'break-all',
            fontWeight: 600
          }}
        >
          {part}
        </a>
      );
    }
    return part;
  });
};

// Utility: Download image to device
const downloadImageFile = (urlOrBase64: string, filename: string) => {
  const link = document.createElement('a');
  link.href = urlOrBase64;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const DirectMessagesView: React.FC<DirectMessagesViewProps> = ({
  currentUser,
  isMobile,
  theme,
  initialConversationId,
  initialTargetUserId,
  onClearInitialIds,
  onUnreadCountChange,
  onClose
}) => {
  // State: Conversations list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // State: Active Chat
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null);
  const [activePartner, setActivePartner] = useState<any | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // State: Message Input
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // State: Search & Start new DM
  const [showNewDmModal, setShowNewDmModal] = useState(false);
  const [newDmTab, setNewDmTab] = useState<'direct' | 'group'>('direct');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State: Group Chat Creation & Management
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupIcon, setNewGroupIcon] = useState('👥');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<any[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupIcon, setEditGroupIcon] = useState('');
  const [isSavingGroupInfo, setIsSavingGroupInfo] = useState(false);
  const [addMemberQuery, setAddMemberQuery] = useState('');
  const [addMemberResults, setAddMemberResults] = useState<any[]>([]);
  const [selectedAddMembers, setSelectedAddMembers] = useState<any[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // State: Image Zoom
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // State: Reply & Reactions
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [activeActionMessageId, setActiveActionMessageId] = useState<string | null>(null);
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState<string | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const touchTimerRef = useRef<any>(null);

  // Refs & Smart Scroll State
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<any>(null);
  const isNearBottomRef = useRef(true);
  const userJustSentRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // Hybrid Real-time & Adaptive Sync Refs
  const lastSyncTimeRef = useRef<string | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const isCheckingUpdatesRef = useRef<boolean>(false);
  const saveScrollTimerRef = useRef<any>(null);

  const handleTimelineScroll = () => {
    if (!timelineRef.current || !activeConversationId) return;
    const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Consider user at bottom if within 120px
    const nearBottom = distanceFromBottom <= 120;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottomBtn(!nearBottom);

    // Don't save scroll position while initial load or rendering is in flight
    if (isInitialLoadRef.current) return;

    // Debounce save to localStorage per conversation
    if (saveScrollTimerRef.current) clearTimeout(saveScrollTimerRef.current);
    saveScrollTimerRef.current = setTimeout(() => {
      try {
        if (nearBottom) {
          localStorage.setItem(`gvvr_dm_scroll_${activeConversationId}`, 'bottom');
        } else {
          localStorage.setItem(`gvvr_dm_scroll_${activeConversationId}`, String(Math.round(scrollTop)));
        }
      } catch (e) {
        // ignore quota errors
      }
    }, 150);
  };

  const scrollToBottom = (smooth = true) => {
    if (timelineRef.current) {
      if (smooth) {
        timelineRef.current.scrollTo({
          top: timelineRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);
    if (activeConversationId) {
      try {
        localStorage.setItem(`gvvr_dm_scroll_${activeConversationId}`, 'bottom');
      } catch (e) {}
    }
  };

  // Restore scroll position when opening a conversation
  const restoreScrollPosition = (convId: string | null) => {
    if (!convId) return;
    const saved = localStorage.getItem(`gvvr_dm_scroll_${convId}`);

    const applyScroll = () => {
      const el = timelineRef.current;
      if (!el) return;
      if (!saved || saved === 'bottom') {
        el.scrollTop = el.scrollHeight;
        isNearBottomRef.current = true;
        setShowScrollBottomBtn(false);
      } else {
        const targetPos = parseInt(saved, 10);
        if (!isNaN(targetPos) && targetPos >= 0) {
          el.scrollTop = targetPos;
          const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          const nearBottom = distanceFromBottom <= 120;
          isNearBottomRef.current = nearBottom;
          setShowScrollBottomBtn(!nearBottom);
        } else {
          el.scrollTop = el.scrollHeight;
          isNearBottomRef.current = true;
          setShowScrollBottomBtn(false);
        }
      }
    };

    // Staggered execution ensures layout reflows (avatars, text wrapping, images) don't dislodge the position
    requestAnimationFrame(applyScroll);
    setTimeout(applyScroll, 40);
    setTimeout(applyScroll, 120);
    setTimeout(applyScroll, 250);
    setTimeout(applyScroll, 500);
  };

  // Start reply to a message
  const handleStartReply = (msg: Message) => {
    triggerHaptic('light');
    setReplyingTo(msg);
    setActiveActionMessageId(null);
    setHoveredMessageId(null);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 80);
  };

  // Scroll to original message when clicking reply quote
  const scrollToOriginalMessage = (origId: string) => {
    const el = document.getElementById(`dm-msg-${origId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(origId);
      triggerHaptic('light');
      setTimeout(() => {
        setHighlightedMsgId(null);
      }, 1600);
    }
  };

  // Copy message text
  const handleCopyMessage = async (msg: Message) => {
    if (!msg.content) return;
    try {
      await navigator.clipboard.writeText(msg.content);
      triggerHaptic('light');
      setCopiedMsgId(msg.id);
      setActiveActionMessageId(null);
      setTimeout(() => setCopiedMsgId(null), 1500);
    } catch (e) {
      console.error('Copy failed:', e);
    }
  };

  // Toggle emoji reaction
  const handleToggleReaction = async (messageId: string, emoji: string) => {
    triggerHaptic('light');
    setActiveActionMessageId(null);
    setShowFullEmojiPicker(null);
    setHoveredMessageId(null);

    // Optimistically update reactions
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const existing = m.reactions ? [...m.reactions] : [];
      const idx = existing.findIndex(r => r.emoji === emoji);

      if (idx !== -1) {
        const item = { ...existing[idx] };
        if (item.hasReacted) {
          item.count -= 1;
          item.hasReacted = false;
          item.users = item.users.filter(u => u !== (currentUser?.username || ''));
          if (item.count <= 0) {
            existing.splice(idx, 1);
          } else {
            existing[idx] = item;
          }
        } else {
          item.count += 1;
          item.hasReacted = true;
          item.users.push(currentUser?.username || '');
          existing[idx] = item;
        }
      } else {
        existing.push({
          emoji,
          count: 1,
          users: [currentUser?.username || ''],
          hasReacted: true
        });
      }
      return { ...m, reactions: existing };
    }));

    try {
      await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_reaction',
          messageId,
          emoji,
          senderId: currentUser.id
        })
      });
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
      fetchMessages(activeConversationId!, true);
    }
  };

  // Touch handlers for mobile long-press
  const handleMessageTouchStart = (msg: Message) => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      triggerHaptic('medium');
      setActiveActionMessageId(msg.id);
    }, 450);
  };

  const handleMessageTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  // Ultra-lightweight conversation update check (reads 1 row, CPU < 0.5ms)
  const checkForUpdates = async (convId: string) => {
    if (!currentUser?.id || !convId || isCheckingUpdatesRef.current) return;
    isCheckingUpdatesRef.current = true;
    try {
      const since = lastSyncTimeRef.current || '';
      const res = await fetch(`/api/dm?action=check_updates&conversationId=${convId}&userId=${currentUser.id}&since=${encodeURIComponent(since)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.has_updates) {
          await fetchMessages(convId, true);
        }
        if (data.updated_at) {
          lastSyncTimeRef.current = data.updated_at;
        }
      }
    } catch (err) {
      console.warn('[DM] checkForUpdates error:', err);
    } finally {
      isCheckingUpdatesRef.current = false;
    }
  };

  // Helper to safely parse UTC date strings from SQLite ("YYYY-MM-DD HH:MM:SS") or ISO
  const parseUtcDate = (dateStr: string | null): Date | null => {
    if (!dateStr) return null;
    let s = dateStr.trim();
    if (s.indexOf(' ') !== -1 && s.indexOf('T') === -1) {
      s = s.replace(' ', 'T') + 'Z';
    } else if (s.indexOf('T') !== -1 && !s.endsWith('Z') && !/[+\-]\d{2}:\d{2}$/.test(s)) {
      s = s + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  // Format timestamp helper (Converts UTC to user's local timezone / JST)
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = parseUtcDate(dateStr);
    if (!date) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, name: string) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=2563eb&color=fff`;
  };

  // 1. Fetch conversations list
  const fetchConversations = async (silent = false) => {
    if (!currentUser?.id) return;
    if (!silent) setIsLoadingConversations(true);

    try {
      const res = await fetch(`/api/dm?action=conversations&userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const convList = data.conversations || [];
        setConversations(convList);

        const totalUnread = convList.reduce((acc: number, c: Conversation) => acc + (c.unread_count || 0), 0);
        if (onUnreadCountChange) onUnreadCountChange(totalUnread);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      if (!silent) setIsLoadingConversations(false);
    }
  };

  // 2. Fetch messages for active conversation
  const fetchMessages = async (convId: string, silent = false) => {
    if (!currentUser?.id || !convId) return;
    if (!silent) setIsLoadingMessages(true);

    try {
      const res = await fetch(`/api/dm?action=messages&conversationId=${convId}&userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.updatedAt) {
          lastSyncTimeRef.current = data.updatedAt;
        }
        const nextMessages: Message[] = data.messages || [];

        // Reference check: preserve state identity if messages are identical to avoid auto-scroll jerking
        setMessages(prev => {
          if (prev.length === nextMessages.length) {
            let isIdentical = true;
            for (let i = 0; i < prev.length; i++) {
              if (
                prev[i].id !== nextMessages[i].id ||
                prev[i].content !== nextMessages[i].content ||
                prev[i].is_read !== nextMessages[i].is_read ||
                prev[i].image_url !== nextMessages[i].image_url
              ) {
                isIdentical = false;
                break;
              }
            }
            if (isIdentical) {
              return prev;
            }
          }
          return nextMessages;
        });

        if (data.partner) {
          setActivePartner(data.partner);
        }
        if (data.members) {
          setGroupMembers(data.members);
        }

        // Update local conversation unread count to 0
        setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
        // 通知センターと未読バッジの即時連動
        window.dispatchEvent(new CustomEvent('gv-notifications-refresh'));
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Initial load & Target User Handling
  useEffect(() => {
    fetchConversations();
  }, [currentUser?.id]);

  useEffect(() => {
    if (initialTargetUserId && currentUser?.id && initialTargetUserId !== currentUser.id) {
      // Create or open conversation with this target user
      (async () => {
        try {
          setIsLoadingMessages(true);
          const res = await fetch(`/api/dm?action=get_or_create&userId=${currentUser.id}&targetUserId=${initialTargetUserId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.conversation?.id) {
              setActiveConversationId(data.conversation.id);
              setActivePartner(data.partner);
              fetchMessages(data.conversation.id);
            }
          }
        } catch (e) {
          console.error('Failed to get_or_create DM:', e);
        } finally {
          setIsLoadingMessages(false);
          if (onClearInitialIds) onClearInitialIds();
        }
      })();
    } else if (initialConversationId) {
      setActiveConversationId(initialConversationId);
      fetchMessages(initialConversationId);
      if (onClearInitialIds) onClearInitialIds();
    }
  }, [initialTargetUserId, initialConversationId, currentUser?.id]);

  // 高速メッセージ同期ループ (アクティブな会話中は1秒間隔で同期)
  useEffect(() => {
    if (!activeConversationId) return;

    // Reset scroll tracking for active conversation
    isInitialLoadRef.current = true;
    setShowScrollBottomBtn(false);
    lastSyncTimeRef.current = null;
    lastInteractionRef.current = Date.now();
    setMessages([]);

    // Restore draft text for this conversation
    const savedDraft = localStorage.getItem(`gvvr_dm_draft_${activeConversationId}`) || '';
    setInputText(savedDraft);

    fetchMessages(activeConversationId);

    // ネイティブ側に現在閲覧中の会話IDを通知（通知シェードのポップアップを抑制＆既読通知を即時解除）
    notifyActiveConversation(activeConversationId);

    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);

    // Adaptive lightweight check loop:
    // - FCM handles instant message arrivals on Android without polling
    // - Background loop checks ultra-lightweight check_updates endpoint (1-row check)
    // - 5s when active (<30s), 15s when idle, 25s when long idle
    // - Completely suspended when document is hidden (screen off / other tab)
    const scheduleNextCheck = () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (document.hidden || !activeConversationId) return;

      const idleSec = (Date.now() - lastInteractionRef.current) / 1000;
      let interval = 15000;
      if (idleSec < 30) {
        interval = 5000; // active conversation
      } else if (idleSec > 120) {
        interval = 25000; // idle
      }

      pollTimerRef.current = setTimeout(async () => {
        if (!document.hidden && activeConversationId) {
          await checkForUpdates(activeConversationId);
        }
        scheduleNextCheck();
      }, interval);
    };

    scheduleNextCheck();

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      notifyActiveConversation(null);
    };
  }, [activeConversationId]);

  // 会話一覧閲覧時の自動ポーリング (2.5秒間隔)

  // FCMプッシュ通知受信時のリアルタイム即時反映（ポーリングを待たずに0.1秒で即時描画）
  useEffect(() => {
    const handleInstantDm = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      console.log('[DirectMessagesView] Instant DM event received:', detail);
      if (detail && detail.conversationId) {
        if (activeConversationId && detail.conversationId === activeConversationId) {
          lastInteractionRef.current = Date.now();
          fetchMessages(activeConversationId, true);
          triggerHaptic('light');
        }
        // 会話一覧の未読バッジと最新メッセージも即座に更新
        fetchConversations(true);
      }
    };

    window.addEventListener('gvvr-dm-received', handleInstantDm);
    return () => {
      window.removeEventListener('gvvr-dm-received', handleInstantDm);
    };
  }, [activeConversationId]);

  // 会話一覧画面の定期ポーリング (2.5秒間隔)
  useEffect(() => {
    if (activeConversationId) return;

    fetchConversations(true);
    const listTimer = setInterval(() => {
      if (!document.hidden && !activeConversationId) {
        fetchConversations(true);
      }
    }, 15000);

    return () => clearInterval(listTimer);
  }, [activeConversationId]);

  // タブ復帰時の即時同期
  useEffect(() => {
    const handleVis = () => {
      if (!document.hidden) {
        if (activeConversationId) {
          fetchMessages(activeConversationId, true);
        } else {
          fetchConversations(true);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVis);
    return () => document.removeEventListener('visibilitychange', handleVis);
  }, [activeConversationId]);

  // Auto-scroll or restore scroll when messages update
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      restoreScrollPosition(activeConversationId);
    } else if (userJustSentRef.current) {
      userJustSentRef.current = false;
      scrollToBottom(true);
      try {
        localStorage.setItem(`gvvr_dm_scroll_${activeConversationId}`, 'bottom');
      } catch (e) {}
    } else if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
    // If isNearBottomRef.current is false and not initial load, user is reading history: do NOT scroll
  }, [messages, activeConversationId]);

  // Handle select conversation
  const handleSelectConversation = (conv: Conversation) => {
    triggerHaptic('light');
    isInitialLoadRef.current = true;
    setShowScrollBottomBtn(false);
    setMessages([]);
    setActiveConversationId(conv.id);
    if (conv.is_group === 1) {
      setActivePartner({
        id: conv.id,
        username: conv.partner_username || 'グループチャット',
        avatar: conv.partner_avatar || '👥',
        role: 'group',
        is_group: true,
        owner_id: conv.group_owner_id,
        member_count: conv.member_count
      });
    } else {
      setActivePartner({
        id: conv.partner_id,
        username: conv.partner_username,
        roblox_username: conv.partner_roblox_username,
        avatar: conv.partner_avatar,
        role: conv.partner_role,
        is_group: false
      });
    }
    fetchMessages(conv.id);
  };

  // Handle Send Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSending) return;

    const trimmed = inputText.trim();
    if (!trimmed && !selectedImage) return;
    if (!activeConversationId || !currentUser?.id || !activePartner?.id) return;

    triggerHaptic('medium');
    setIsSending(true);
    lastInteractionRef.current = Date.now();
    userJustSentRef.current = true;
    isNearBottomRef.current = true;
    setShowScrollBottomBtn(false);

    const targetReply = replyingTo;
    setReplyingTo(null);

    const tempId = 'temp_' + Date.now();
    const optimisticMessage: Message = {
      id: tempId,
      conversation_id: activeConversationId,
      sender_id: currentUser.id,
      recipient_id: activePartner.id,
      content: trimmed || null,
      image_data: selectedImage || null,
      is_read: 0,
      read_at: null,
      created_at: new Date().toISOString(),
      reply_to_id: targetReply?.id || null,
      reply_content: targetReply?.content || null,
      reply_sender_id: targetReply?.sender_id || null,
      reply_sender_name: targetReply ? (targetReply.sender_id === currentUser.id ? '自分' : activePartner.username) : null,
      reply_image: targetReply?.image_data || null,
      reactions: []
    };

    // Optimistically append message
    setMessages(prev => [...prev, optimisticMessage]);
    setInputText('');
    setSelectedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          conversationId: activeConversationId,
          senderId: currentUser.id,
          recipientId: activePartner.id,
          content: trimmed,
          imageData: selectedImage,
          replyToId: targetReply?.id || null
        })
      });

      if (res.ok) {
        const data = await res.json();
        triggerHaptic('success');
        if (activeConversationId) {
          localStorage.removeItem(`gvvr_dm_draft_${activeConversationId}`);
          try {
            localStorage.setItem(`gvvr_dm_scroll_${activeConversationId}`, 'bottom');
          } catch (e) {}
        }
        // Replace tempId with actual message ID
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.messageId } : m));
        fetchConversations(true);
      } else {
        const err = await res.json();
        alert(err.error || 'メッセージの送信に失敗しました');
        // Rollback
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (err) {
      console.error('Send message error:', err);
      alert('通信エラーが発生しました');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // Process image file (from clipboard paste, file picker, or drag & drop)
  const processImageFile = async (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      triggerHaptic('light');
      const base64 = await compressImage(file, { maxWidth: 1200, maxHeight: 1200, quality: 0.8 });
      setSelectedImage(base64);
      setTimeout(() => textareaRef.current?.focus(), 50);
    } catch (err) {
      console.error('Image compression failed:', err);
      alert('画像の処理に失敗しました');
    }
  };

  // Handle image attachment from file input
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle image paste from clipboard (Ctrl+V)
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement> | ClipboardEvent) => {
    const clipboardData = (e as any).clipboardData;
    if (!clipboardData) return;

    const files = clipboardData.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith('image/')) {
          e.preventDefault();
          await processImageFile(files[i]);
          return;
        }
      }
    }

    const items = clipboardData.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await processImageFile(file);
            return;
          }
        }
      }
    }
  };

  // Window-level paste listener for active conversation
  useEffect(() => {
    if (!activeConversationId) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.tagName === 'INPUT' && target !== fileInputRef.current) {
        return;
      }
      handlePaste(e);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [activeConversationId]);

  // Search users for new DM
  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api/dm?action=search_users&query=${encodeURIComponent(query)}&currentUserId=${currentUser?.id}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (err) {
      console.error('User search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Start chat with user from modal
  const handleStartChatWithUser = async (targetUser: any) => {
    triggerHaptic('light');
    setShowNewDmModal(false);
    setSearchQuery('');
    setSearchResults([]);

    try {
      setIsLoadingMessages(true);
      const res = await fetch(`/api/dm?action=get_or_create&userId=${currentUser.id}&targetUserId=${targetUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.conversation?.id) {
          setActiveConversationId(data.conversation.id);
          setActivePartner(targetUser);
          fetchConversations(true);
          fetchMessages(data.conversation.id);
        }
      }
    } catch (err) {
      console.error('Failed to start chat:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };
  // ─── Group Chat Action Handlers ───

  // Toggle user selection in Group creation modal
  const handleToggleGroupMember = (user: any) => {
    triggerHaptic('light');
    setSelectedGroupMembers(prev => {
      const exists = prev.some(u => u.id === user.id);
      if (exists) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  // Create Group Chat
  const handleCreateGroup = async () => {
    const trimmed = newGroupName.trim();
    if (!trimmed) {
      alert('グループ名を入力してください');
      return;
    }
    if (selectedGroupMembers.length === 0) {
      alert('グループメンバーを1人以上選択してください');
      return;
    }

    triggerHaptic('medium');
    setIsCreatingGroup(true);

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_group',
          senderId: currentUser.id,
          name: trimmed,
          icon: newGroupIcon || '👥',
          memberIds: selectedGroupMembers.map(m => m.id)
        })
      });

      if (res.ok) {
        const data = await res.json();
        triggerHaptic('success');
        setShowNewDmModal(false);
        setNewGroupName('');
        setSelectedGroupMembers([]);
        setSearchQuery('');
        setSearchResults([]);

        // Select and switch to new group
        setActiveConversationId(data.conversationId);
        setActivePartner({
          id: data.conversationId,
          username: trimmed,
          avatar: newGroupIcon || '👥',
          role: 'group',
          is_group: true,
          owner_id: currentUser.id,
          member_count: selectedGroupMembers.length + 1
        });
        await fetchConversations(true);
        fetchMessages(data.conversationId);
      } else {
        const err = await res.json();
        alert(err.error || 'グループの作成に失敗しました');
      }
    } catch (e) {
      console.error('Create group error:', e);
      alert('通信エラーが発生しました');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Update Group Info (Name / Icon)
  const handleSaveGroupInfo = async () => {
    if (!activeConversationId || !editGroupName.trim()) return;
    setIsSavingGroupInfo(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_group',
          conversationId: activeConversationId,
          senderId: currentUser.id,
          name: editGroupName.trim(),
          icon: editGroupIcon.trim() || '👥'
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        setActivePartner((prev: any) => prev ? { ...prev, username: editGroupName.trim(), avatar: editGroupIcon.trim() || '👥' } : prev);
        setShowGroupInfoModal(false);
        fetchConversations(true);
        fetchMessages(activeConversationId, true);
      } else {
        const err = await res.json();
        alert(err.error || 'グループ情報の更新に失敗しました');
      }
    } catch (e) {
      alert('通信エラーが発生しました');
    } finally {
      setIsSavingGroupInfo(false);
    }
  };

  // Leave Group
  const handleLeaveGroup = async () => {
    if (!activeConversationId) return;
    if (!window.confirm('本当にこのグループを退出しますか？\n退出後はメッセージの送受信ができなくなります。')) return;

    triggerHaptic('medium');
    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'leave_group',
          conversationId: activeConversationId,
          senderId: currentUser.id
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        setShowGroupInfoModal(false);
        setActiveConversationId(null);
        setActivePartner(null);
        fetchConversations(true);
      } else {
        const err = await res.json();
        alert(err.error || 'グループの退出に失敗しました');
      }
    } catch (e) {
      alert('通信エラーが発生しました');
    }
  };

  // Search users to add to existing group
  const handleSearchAddMembers = async (q: string) => {
    setAddMemberQuery(q);
    if (!q.trim()) {
      setAddMemberResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/dm?action=search_users&query=${encodeURIComponent(q)}&currentUserId=${currentUser?.id}`);
      if (res.ok) {
        const data = await res.json();
        // Filter out users already in group
        const existingIds = new Set(groupMembers.map(m => m.id));
        setAddMemberResults((data.users || []).filter((u: any) => !existingIds.has(u.id)));
      }
    } catch (e) {}
  };

  // Add selected members to existing group
  const handleAddMembersToGroup = async () => {
    if (!activeConversationId || selectedAddMembers.length === 0) return;
    setIsAddingMembers(true);
    triggerHaptic('medium');

    try {
      const res = await fetch('/api/dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_group_members',
          conversationId: activeConversationId,
          senderId: currentUser.id,
          newMemberIds: selectedAddMembers.map(m => m.id)
        })
      });

      if (res.ok) {
        triggerHaptic('success');
        setShowAddMembersModal(false);
        setSelectedAddMembers([]);
        setAddMemberQuery('');
        setAddMemberResults([]);
        fetchMessages(activeConversationId, true);
        fetchConversations(true);
      } else {
        const err = await res.json();
        alert(err.error || 'メンバーの追加に失敗しました');
      }
    } catch (e) {
      alert('通信エラーが発生しました');
    } finally {
      setIsAddingMembers(false);
    }
  };


  return (
    <div style={{
      display: 'flex',
      height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 110px)',
      background: 'transparent',
      borderRadius: '24px',
      overflow: 'hidden',
      border: '1px solid var(--glass-border)',
      position: 'relative'
    }} className="glass animate-fade">
      
      {/* ──────────────────────────────────────────────────────────
          LEFT COLUMN: Conversations List (スレッド一覧)
          ────────────────────────────────────────────────────────── */}
      {(!isMobile || !activeConversationId) && (
        <div style={{
          width: isMobile ? '100%' : '360px',
          borderRight: isMobile ? 'none' : '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          background: theme === 'light' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(10, 15, 25, 0.4)',
          flexShrink: 0
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--glass-border)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={22} style={{ color: 'var(--primary)' }} />
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>メッセージ</h2>
            </div>
            
            <button
              onClick={() => { triggerHaptic('light'); setShowNewDmModal(true); }}
              className="btn btn-primary"
              style={{
                padding: '6px 12px',
                borderRadius: '10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} /> 新規作成
            </button>
          </div>

          {/* Conversations Thread List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoadingConversations && conversations.length === 0 ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <MessageSquare size={40} style={{ opacity: 0.2, margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>メッセージはありません</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>「新規作成」から市民を探してチャットを始めましょう！</p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    style={{
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isSelected 
                        ? (theme === 'light' ? 'rgba(37, 99, 235, 0.08)' : 'rgba(10, 132, 255, 0.12)') 
                        : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      {conv.is_group === 1 && (!conv.partner_avatar || (!conv.partner_avatar.startsWith('http') && !conv.partner_avatar.startsWith('data:'))) ? (
                        <div style={{
                          width: '46px',
                          height: '46px',
                          borderRadius: '16px',
                          background: theme === 'dark' ? 'rgba(10, 132, 255, 0.18)' : 'rgba(37, 99, 235, 0.12)',
                          border: '1px solid var(--primary-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.4rem'
                        }}>
                          {conv.partner_avatar || '👥'}
                        </div>
                      ) : (
                        <img
                          src={conv.partner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.partner_username)}&background=2563eb&color=fff`}
                          alt={conv.partner_username}
                          onError={(e) => handleAvatarError(e, conv.partner_username)}
                          style={{ width: '46px', height: '46px', borderRadius: conv.is_group === 1 ? '16px' : '50%', objectFit: 'cover' }}
                        />
                      )}
                      {conv.unread_count > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: 'var(--primary)',
                          color: theme === 'light' ? '#fff' : '#000',
                          borderRadius: '10px',
                          fontSize: '0.7rem',
                          fontWeight: 900,
                          minWidth: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 4px',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
                        }}>
                          {conv.unread_count}
                        </div>
                      )}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span style={{
                            fontSize: '0.92rem',
                            fontWeight: conv.unread_count > 0 ? 800 : 700,
                            color: 'var(--text-main)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {conv.partner_username}
                          </span>
                          {conv.is_group === 1 ? (
                            <span style={{
                              fontSize: '0.7rem',
                              padding: '1px 6px',
                              borderRadius: '999px',
                              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                              color: 'var(--text-muted)',
                              fontWeight: 600,
                              flexShrink: 0
                            }}>
                              👥 {conv.member_count || ''}
                            </span>
                          ) : conv.partner_role === 'admin' ? (
                            <ShieldCheck size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          ) : null}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          {formatTime(conv.last_message_at || conv.updated_at)}
                        </span>
                      </div>

                      <p style={{
                        margin: 0,
                        fontSize: '0.8rem',
                        color: conv.unread_count > 0 ? 'var(--text-main)' : 'var(--text-muted)',
                        fontWeight: conv.unread_count > 0 ? 700 : 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {conv.last_message_text || 'チャットが開始されました'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          RIGHT COLUMN: Chat Room (トークルーム)
          ────────────────────────────────────────────────────────── */}
      {(!isMobile || !!activeConversationId) && (
        <div 
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDraggingOver) setIsDraggingOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
          }}
          onDrop={async (e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingOver(false);
            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
              const file = files[0];
              if (file.type.startsWith('image/')) {
                await processImageFile(file);
              }
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: theme === 'light' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(10, 15, 25, 0.2)',
            minWidth: 0,
            position: 'relative'
          }}
        >
          {/* Drag & Drop Visual Overlay */}
          {isDraggingOver && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(37, 99, 235, 0.1)',
              backdropFilter: 'blur(8px)',
              border: '2px dashed var(--primary)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: 'var(--primary)',
              pointerEvents: 'none'
            }}>
              <Upload size={48} className="animate-bounce" />
              <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>画像をドロップして添付</span>
            </div>
          )}
          {activePartner ? (
            <>
              {/* Partner Header */}
              <div style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--glass-border)',
                background: theme === 'light' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(10, 15, 25, 0.5)',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isMobile && (
                    <button
                      onClick={() => { triggerHaptic('light'); setActiveConversationId(null); }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '4px', display: 'flex' }}
                    >
                      <ArrowLeft size={20} />
                    </button>
                  )}
                  {activePartner.is_group && (!activePartner.avatar || (!activePartner.avatar.startsWith('http') && !activePartner.avatar.startsWith('data:'))) ? (
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: theme === 'dark' ? 'rgba(10, 132, 255, 0.2)' : 'rgba(37, 99, 235, 0.12)',
                      border: '1px solid var(--primary-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem'
                    }}>
                      {activePartner.avatar || '👥'}
                    </div>
                  ) : (
                    <img
                      src={activePartner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.username)}&background=2563eb&color=fff`}
                      alt={activePartner.username}
                      onError={(e) => handleAvatarError(e, activePartner.username)}
                      style={{ width: '40px', height: '40px', borderRadius: activePartner.is_group ? '12px' : '50%', objectFit: 'cover' }}
                    />
                  )}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {activePartner.username}
                      </span>
                      {!activePartner.is_group && activePartner.role === 'admin' && (
                        <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
                      )}
                    </div>
                    {activePartner.is_group ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        👥 {groupMembers.length || activePartner.member_count || 1}人のメンバー
                      </span>
                    ) : activePartner.roblox_username ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{activePartner.roblox_username}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activePartner.is_group && (
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setEditGroupName(activePartner.username || '');
                        setEditGroupIcon(activePartner.avatar || '👥');
                        setShowGroupInfoModal(true);
                      }}
                      title="グループ情報・メンバー管理"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-main)',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Users size={16} style={{ color: 'var(--primary)' }} />
                      <span>メンバー</span>
                    </button>
                  )}

                  <button
                    onClick={() => fetchMessages(activeConversationId!, true)}
                    title="メッセージを更新"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '8px',
                      borderRadius: '8px'
                    }}
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>

              {/* Messages Timeline Container */}
              <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div
                  ref={timelineRef}
                  onScroll={handleTimelineScroll}
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px'
                  }}
                >
                {isLoadingMessages && messages.length === 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>メッセージはまだありません</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem' }}>最初のメッセージを送ってみましょう！</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isMine = msg.sender_id === currentUser.id;
                    const isHighlighted = highlightedMsgId === msg.id;
                    const isHoveredOrActive = hoveredMessageId === msg.id || activeActionMessageId === msg.id;

                    // Centered System message for group actions
                    const isSystemMsg = msg.recipient_id === 'group' && (
                      msg.content?.includes('グループを作成しました') ||
                      msg.content?.includes('さんを追加しました') ||
                      msg.content?.includes('グループを退出しました') ||
                      msg.content?.includes('グループ情報を変更しました')
                    );

                    if (isSystemMsg) {
                      return (
                        <div key={msg.id || index} style={{ display: 'flex', justifyContent: 'center', margin: '6px 0', width: '100%' }}>
                          <div style={{
                            padding: '4px 14px',
                            borderRadius: '999px',
                            background: theme === 'dark' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
                            border: '1px solid var(--glass-border)',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: 'var(--text-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                          }}>
                            <span>{msg.content}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.65 }}>{formatTime(msg.created_at)}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id || index}
                        id={`dm-msg-${msg.id}`}
                        onMouseEnter={() => !isMobile && setHoveredMessageId(msg.id)}
                        onMouseLeave={() => !isMobile && setHoveredMessageId(null)}
                        onTouchStart={() => isMobile && handleMessageTouchStart(msg)}
                        onTouchEnd={() => isMobile && handleMessageTouchEnd()}
                        onTouchCancel={() => isMobile && handleMessageTouchEnd()}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: isMine ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: '8px',
                          maxWidth: '100%',
                          padding: '4px 6px',
                          borderRadius: '16px',
                          background: isHighlighted
                            ? (theme === 'dark' ? 'rgba(10, 132, 255, 0.22)' : 'rgba(37, 99, 235, 0.14)')
                            : 'transparent',
                          transition: 'background-color 0.3s ease, transform 0.2s ease',
                          transform: isHighlighted ? 'scale(1.02)' : 'none'
                        }}
                      >
                        {/* Floating Action Pill Toolbar (Hover on PC, Long-press on Mobile) */}
                        {isHoveredOrActive && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '-36px',
                              [isMine ? 'right' : 'left']: isMobile ? '8px' : '36px',
                              zIndex: 25,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              padding: '4px 8px',
                              borderRadius: '999px',
                              background: theme === 'dark' ? '#1c1c1e' : '#ffffff',
                              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid rgba(0, 0, 0, 0.1)',
                              boxShadow: theme === 'dark' ? '0 6px 20px rgba(0,0,0,0.6)' : '0 4px 14px rgba(0,0,0,0.12)',
                              animation: 'fadeIn 0.15s ease'
                            }}
                          >
                            {/* Quick Emojis */}
                            {QUICK_EMOJIS.slice(0, 5).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReaction(msg.id, emoji);
                                }}
                                title={emoji}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  fontSize: '1rem',
                                  borderRadius: '6px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'transform 0.1s ease'
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                              >
                                {emoji}
                              </button>
                            ))}

                            <div style={{ width: '1px', height: '14px', background: 'var(--glass-border)', margin: '0 2px' }} />

                            {/* Full Emoji Picker Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowFullEmojiPicker(msg.id);
                              }}
                              title="絵文字を追加"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%'
                              }}
                            >
                              <Smile size={16} />
                            </button>

                            {/* Reply Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartReply(msg);
                              }}
                              title="返信"
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '50%'
                              }}
                            >
                              <Reply size={16} />
                            </button>

                            {/* Copy Button (if text exists) */}
                            {msg.content && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyMessage(msg);
                                }}
                                title="コピー"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: copiedMsgId === msg.id ? 'var(--primary)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: '50%'
                                }}
                              >
                                {copiedMsgId === msg.id ? <Check size={16} /> : <Copy size={15} />}
                              </button>
                            )}

                            {/* Close Menu Button on Mobile */}
                            {activeActionMessageId === msg.id && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveActionMessageId(null);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        )}

                        {!isMine && (
                          <img
                            src={(activePartner.is_group ? msg.sender_avatar : activePartner.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent((activePartner.is_group ? msg.sender_username : activePartner.username) || '市民')}&background=2563eb&color=fff`}
                            alt="avatar"
                            onError={(e) => handleAvatarError(e, (activePartner.is_group ? msg.sender_username : activePartner.username) || '市民')}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}

                        <div style={{
                          maxWidth: isMobile ? '82%' : '65%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMine ? 'flex-end' : 'flex-start'
                        }}>
                          {/* Sender Name above bubble in Group Chat */}
                          {activePartner.is_group && !isMine && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginBottom: '3px',
                              marginLeft: '4px'
                            }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                {msg.sender_username || '市民'}
                              </span>
                              {msg.sender_role === 'admin' && (
                                <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />
                              )}
                            </div>
                          )}
                          {/* Chat Bubble (Apple iOS Asymmetrical Squircle) */}
                          <div className={isMine ? 'bubble-mine' : 'bubble-other'} style={{
                            padding: '10px 16px',
                            borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: isMine 
                              ? (theme === 'dark' ? '#0a84ff' : '#007aff') 
                              : (theme === 'dark' ? '#262628' : '#e9ecef'),
                            border: isMine 
                              ? 'none' 
                              : (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.04)'),
                            color: isMine 
                              ? '#ffffff' 
                              : (theme === 'dark' ? '#f4f4f5' : '#1f2937'),
                            fontSize: '0.94rem',
                            lineHeight: 1.45,
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                            boxShadow: isMine 
                              ? (theme === 'dark' ? '0 2px 12px rgba(10, 132, 255, 0.35)' : '0 2px 10px rgba(0, 122, 255, 0.28)') 
                              : (theme === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 2px rgba(0, 0, 0, 0.03)')
                          }}>
                            {/* Reply Quote Header */}
                            {msg.reply_to_id && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  scrollToOriginalMessage(msg.reply_to_id!);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '5px 8px',
                                  marginBottom: '8px',
                                  borderRadius: '8px',
                                  background: isMine
                                    ? 'rgba(0, 0, 0, 0.22)'
                                    : (theme === 'dark' ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)'),
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  borderLeft: isMine
                                    ? '3px solid rgba(255, 255, 255, 0.85)'
                                    : (theme === 'dark' ? '3px solid #0a84ff' : '3px solid #2563eb'),
                                  transition: 'opacity 0.15s ease'
                                }}
                              >
                                <CornerDownRight size={12} style={{ flexShrink: 0, opacity: 0.85 }} />
                                <span style={{ fontWeight: 700, flexShrink: 0 }}>
                                  {msg.reply_sender_id === currentUser.id ? '自分' : (msg.reply_sender_name || '返信')}:
                                </span>
                                <span style={{
                                  opacity: 0.85,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '200px'
                                }}>
                                  {msg.reply_content || (msg.reply_image ? '📷 [画像]' : '...')}
                                </span>
                              </div>
                            )}

                            {msg.image_data && (
                              <img
                                src={msg.image_data}
                                alt="Attachment"
                                onClick={() => setZoomedImage(msg.image_data)}
                                onLoad={() => {
                                  if (isNearBottomRef.current && timelineRef.current) {
                                    timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
                                  }
                                }}
                                style={{
                                  maxWidth: '100%',
                                  maxHeight: '260px',
                                  borderRadius: '10px',
                                  marginBottom: msg.content ? '8px' : 0,
                                  cursor: 'pointer',
                                  display: 'block',
                                  objectFit: 'cover'
                                }}
                              />
                            )}
                            {renderFormattedMessageText(msg.content)}
                          </div>

                          {/* Reaction Capsules */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginTop: '4px',
                              justifyContent: isMine ? 'flex-end' : 'flex-start'
                            }}>
                              {msg.reactions.map((r) => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={() => handleToggleReaction(msg.id, r.emoji)}
                                  title={r.users.join(', ')}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    fontSize: '0.8rem',
                                    border: r.hasReacted
                                      ? (theme === 'dark' ? '1px solid #0a84ff' : '1px solid #2563eb')
                                      : (theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)'),
                                    background: r.hasReacted
                                      ? (theme === 'dark' ? 'rgba(10, 132, 255, 0.2)' : 'rgba(37, 99, 235, 0.12)')
                                      : (theme === 'dark' ? '#222328' : '#ffffff'),
                                    color: r.hasReacted
                                      ? (theme === 'dark' ? '#409cff' : '#2563eb')
                                      : 'var(--text-main)',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span>{r.emoji}</span>
                                  <span style={{ fontWeight: 600, fontSize: '0.72rem' }}>{r.count}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Time & Read status */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.68rem',
                            color: 'var(--text-muted)',
                            marginTop: '3px',
                            padding: '0 4px'
                          }}>
                            <span>{formatTime(msg.created_at)}</span>
                            {isMine && msg.is_read === 1 && (
                              <span style={{ color: 'var(--primary)', fontWeight: 700 }}>既読</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Floating Scroll to Bottom Button */}
                {showScrollBottomBtn && (
                  <button
                    type="button"
                    onClick={() => scrollToBottom(true)}
                    aria-label="最新のメッセージへスクロール"
                    style={{
                      position: 'absolute',
                      bottom: '16px',
                      right: '20px',
                      zIndex: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '999px',
                      background: theme === 'dark' ? '#27272a' : '#ffffff',
                      color: theme === 'dark' ? '#f4f4f5' : '#1e293b',
                      border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
                      boxShadow: theme === 'dark' ? '0 4px 16px rgba(0, 0, 0, 0.45)' : '0 4px 14px rgba(0, 0, 0, 0.12)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <ChevronDown size={16} />
                    <span>最新へ</span>
                  </button>
                )}
              </div>

              {/* Bottom Input Bar */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border)',
                background: theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(10, 15, 25, 0.6)',
                backdropFilter: 'blur(10px)'
              }}>
                {/* Replying To Banner */}
                {replyingTo && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    marginBottom: '8px',
                    borderRadius: '12px',
                    background: theme === 'dark' ? '#222328' : '#ffffff',
                    borderLeft: theme === 'dark' ? '3px solid #0a84ff' : '3px solid #2563eb',
                    borderTop: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                    borderRight: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                    borderBottom: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
                    boxShadow: theme === 'dark' ? '0 2px 8px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.04)',
                    animation: 'fadeIn 0.15s ease'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: theme === 'dark' ? '#0a84ff' : '#2563eb', fontWeight: 700 }}>
                        <Reply size={13} />
                        <span>{replyingTo.sender_id === currentUser.id ? '自分' : activePartner.username} への返信</span>
                      </div>
                      <span style={{
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {replyingTo.content || (replyingTo.image_data ? '📷 [画像]' : '...')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      title="返信をキャンセル"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Image Preview Thumbnail */}
                {selectedImage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={selectedImage}
                        alt="Selected"
                        style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--primary)' }}
                      />
                      <button
                        onClick={() => setSelectedImage(null)}
                        style={{
                          position: 'absolute',
                          top: '-6px',
                          right: '-6px',
                          background: '#ff5252',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>画像を添付中</span>
                  </div>
                )}

                <form
                  className="chat-input-pill"
                  onSubmit={handleSendMessage}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: theme === 'dark' ? '#222328' : '#f1f3f5',
                    borderRadius: '999px',
                    padding: '4px 6px 4px 14px',
                    border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
                    boxShadow: theme === 'dark' ? '0 2px 8px rgba(0, 0, 0, 0.25)' : '0 1px 4px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />

                  {/* Attachment Button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 122, 255, 0.1)',
                      border: 'none',
                      color: theme === 'dark' ? '#409cff' : '#007aff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                  >
                    <ImageIcon size={18} />
                  </button>

                  {/* Auto-growing Textarea in Pill Form */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => {
                      lastInteractionRef.current = Date.now();
                      const val = e.target.value;
                      setInputText(val);
                      if (activeConversationId) {
                        localStorage.setItem(`gvvr_dm_draft_${activeConversationId}`, val);
                      }
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onPaste={handlePaste}
                    onFocus={() => {
                      if (isNearBottomRef.current) {
                        setTimeout(() => scrollToBottom(false), 200);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.nativeEvent.isComposing) return;
                        if (!isMobile && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }
                    }}
                    placeholder={`${activePartner.username}さんにメッセージ...`}
                    maxLength={1000}
                    className="dm-textarea chat-input-textarea"
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      background: 'transparent',
                      border: 'none',
                      color: theme === 'dark' ? '#f4f4f5' : 'var(--text-main)',
                      fontSize: '16px',
                      outline: 'none',
                      boxShadow: 'none',
                      resize: 'none',
                      minHeight: '36px',
                      maxHeight: '120px',
                      lineHeight: 1.4,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      overflowY: 'auto',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none'
                    }}
                  />

                  {/* Send Button Circular Pill Action */}
                  <button
                    type="submit"
                    disabled={isSending || (!inputText.trim() && !selectedImage)}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: theme === 'dark' ? '#0a84ff' : '#007aff',
                      border: 'none',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (!inputText.trim() && !selectedImage) ? 'not-allowed' : 'pointer',
                      opacity: (!inputText.trim() && !selectedImage) ? 0.4 : 1,
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(10, 132, 255, 0.35)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isSending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Send size={18} />
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', padding: '20px' }}>
              <MessageSquare size={56} style={{ opacity: 0.15, marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-main)', fontSize: '1.1rem' }}>会話を選択してください</h3>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>左のリストから会話を選ぶか、新規作成で市民とチャットを開始できます。</p>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: Start New DM (新規メッセージ相手検索)
          ────────────────────────────────────────────────────────── */}
      {showNewDmModal && (
        <div 
          onClick={() => setShowNewDmModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              maxHeight: '85vh',
              background: theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 24, 38, 0.98)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
            }} 
            className="animate-scale"
          >
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--glass-border)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>新規メッセージ作成</h3>
              <button
                onClick={() => setShowNewDmModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab Switcher: 1対1チャット / グループ作成 */}
            <div style={{
              display: 'flex',
              padding: '6px',
              margin: '12px 20px 0',
              borderRadius: '12px',
              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              gap: '6px'
            }}>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setNewDmTab('direct'); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: newDmTab === 'direct' ? 'var(--primary)' : 'transparent',
                  color: newDmTab === 'direct' ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: newDmTab === 'direct' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <MessageSquare size={15} /> 1対1チャット
              </button>
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setNewDmTab('group'); }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  borderRadius: '9px',
                  border: 'none',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: newDmTab === 'group' ? 'var(--primary)' : 'transparent',
                  color: newDmTab === 'group' ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: newDmTab === 'group' ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <Users size={15} /> 👥 グループ作成
              </button>
            </div>

            {/* TAB 1: 1対1チャット */}
            {newDmTab === 'direct' && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="ユーザー名やRoblox名で検索..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 20px 10px 42px',
                      borderRadius: '999px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ flex: 1, maxHeight: '280px', overflowY: 'auto' }}>
                  {isSearching ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleStartChatWithUser(user)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          marginBottom: '4px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=2563eb&color=fff`}
                            alt={user.username}
                            onError={(e) => handleAvatarError(e, user.username)}
                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.username}</span>
                              {user.role === 'admin' && <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />}
                            </div>
                            {user.roblox_username && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{user.roblox_username}</span>
                            )}
                          </div>
                        </div>

                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>チャット開始</span>
                      </div>
                    ))
                  ) : searchQuery ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      該当する市民が見つかりませんでした
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      メッセージを送りたい市民の名前を入力してください
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: 👥 グループ作成 */}
            {newDmTab === 'group' && (
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1, minHeight: 0 }}>
                {/* Group Name & Icon Input */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={newGroupIcon}
                    onChange={(e) => setNewGroupIcon(e.target.value)}
                    maxLength={4}
                    title="グループアイコン絵文字"
                    style={{
                      width: '46px',
                      height: '42px',
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      borderRadius: '12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="グループ名を入力 (例: ツーリング仲間)..."
                    maxLength={30}
                    autoFocus
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Quick Icon Selector */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['👥', '🚗', '🏎️', '🚓', '🚑', '🛠️', '☕', '🎉', '🏢', '⭐'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewGroupIcon(emoji)}
                      style={{
                        background: newGroupIcon === emoji ? 'var(--primary-subtle)' : 'transparent',
                        border: newGroupIcon === emoji ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '4px 6px',
                        fontSize: '1.1rem',
                        cursor: 'pointer'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Member Search Input */}
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchUsers(e.target.value)}
                    placeholder="参加させる市民を検索して選択..."
                    style={{
                      width: '100%',
                      padding: '10px 16px 10px 40px',
                      borderRadius: '999px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--input-text)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Selected Members Chips */}
                {selectedGroupMembers.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '64px', overflowY: 'auto' }}>
                    {selectedGroupMembers.map(user => (
                      <div
                        key={user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          background: 'var(--primary-subtle)',
                          border: '1px solid var(--primary-border)',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                      >
                        <span>{user.username}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleGroupMember(user)}
                          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Member Candidate Results */}
                <div style={{ flex: 1, maxHeight: '180px', overflowY: 'auto' }}>
                  {isSearching ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map(user => {
                      const isSelected = selectedGroupMembers.some(u => u.id === user.id);
                      return (
                        <div
                          key={user.id}
                          onClick={() => handleToggleGroupMember(user)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 10px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            background: isSelected ? 'var(--primary-subtle)' : 'transparent',
                            marginBottom: '4px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <img
                              src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=2563eb&color=fff`}
                              alt={user.username}
                              onError={(e) => handleAvatarError(e, user.username)}
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                            />
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.username}</span>
                                {user.role === 'admin' && <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />}
                              </div>
                              {user.roblox_username && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user.roblox_username}</span>
                              )}
                            </div>
                          </div>

                          <div style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '6px',
                            border: isSelected ? 'none' : '2px solid var(--text-muted)',
                            background: isSelected ? 'var(--primary)' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                          }}>
                            {isSelected && <Check size={14} />}
                          </div>
                        </div>
                      );
                    })
                  ) : searchQuery ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      該当する市民が見つかりませんでした
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      名前を入力してメンバーを検索してください
                    </div>
                  )}
                </div>

                {/* Create Group Action Button */}
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={!newGroupName.trim() || selectedGroupMembers.length === 0 || isCreatingGroup}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    cursor: !newGroupName.trim() || selectedGroupMembers.length === 0 || isCreatingGroup ? 'not-allowed' : 'pointer',
                    opacity: !newGroupName.trim() || selectedGroupMembers.length === 0 || isCreatingGroup ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                  }}
                >
                  {isCreatingGroup ? <Loader2 size={18} className="animate-spin" /> : <Users size={18} />}
                  <span>グループを作成 ({selectedGroupMembers.length}名)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: Zoom Image with Download Option
          ────────────────────────────────────────────────────────── */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(10px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          {/* Top Action Bar */}
          <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', gap: '12px', zIndex: 100000 }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('medium');
                downloadImageFile(zoomedImage, `gv-chat-image-${Date.now()}.jpg`);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                padding: '8px 18px',
                borderRadius: '30px',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: '0.2s'
              }}
            >
              <Download size={16} /> 保存
            </button>
            <button
              onClick={() => setZoomedImage(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#fff',
                padding: '8px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>

          <img
            src={zoomedImage}
            alt="Zoomed"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw',
              maxHeight: '82vh',
              objectFit: 'contain',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
              cursor: 'default'
            }}
          />
        </div>
      )}

      {/* Full Emoji Picker Modal */}
      {showFullEmojiPicker && (
        <div
          onClick={() => setShowFullEmojiPicker(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '380px',
              maxHeight: '440px',
              borderRadius: '20px',
              background: theme === 'dark' ? '#1c1c1e' : '#ffffff',
              border: theme === 'dark' ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)',
              boxShadow: '0 12px 36px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smile size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>リアクションを選択</span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullEmojiPicker(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Categories & Emojis Scrollable Area */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              {EMOJI_CATEGORIES.map(cat => (
                <div key={cat.name}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {cat.name}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: '6px'
                  }}>
                    {cat.emojis.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleToggleReaction(showFullEmojiPicker, emoji)}
                        style={{
                          background: 'none',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '1.3rem',
                          cursor: 'pointer',
                          padding: '6px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'transform 0.1s ease, background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.25)';
                          e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: Group Info & Member Management
          ────────────────────────────────────────────────────────── */}
      {showGroupInfoModal && activePartner?.is_group && (
        <div
          onClick={() => setShowGroupInfoModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              maxHeight: '85vh',
              background: theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 24, 38, 0.98)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
            }}
            className="animate-scale"
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--glass-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>グループ情報</h3>
              </div>
              <button
                onClick={() => setShowGroupInfoModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Group Name & Icon Edit Card */}
              <div style={{
                padding: '16px',
                borderRadius: '16px',
                background: theme === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)',
                border: '1px solid var(--glass-border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)' }}>グループ名・アイコンの変更</div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={editGroupIcon}
                    onChange={(e) => setEditGroupIcon(e.target.value)}
                    maxLength={4}
                    style={{
                      width: '48px',
                      height: '42px',
                      textAlign: 'center',
                      fontSize: '1.3rem',
                      borderRadius: '12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                    title="アイコン絵文字"
                  />
                  <input
                    type="text"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    placeholder="グループ名"
                    maxLength={30}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--glass-border)',
                      color: 'var(--input-text)',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Quick Emoji Bar for Edit */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['👥', '🚗', '🏎️', '🚓', '🚑', '🛠️', '☕', '🎉', '🏢', '⭐'].map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditGroupIcon(emoji)}
                      style={{
                        background: editGroupIcon === emoji ? 'var(--primary-subtle)' : 'transparent',
                        border: editGroupIcon === emoji ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '4px 6px',
                        fontSize: '1.1rem',
                        cursor: 'pointer'
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleSaveGroupInfo}
                  disabled={isSavingGroupInfo || !editGroupName.trim()}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: isSavingGroupInfo || !editGroupName.trim() ? 'not-allowed' : 'pointer',
                    opacity: isSavingGroupInfo || !editGroupName.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSavingGroupInfo ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={15} />}
                  <span>変更を保存</span>
                </button>
              </div>

              {/* Members Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    👥 メンバー ({groupMembers.length}名)
                  </span>
                  <button
                    onClick={() => {
                      setSelectedAddMembers([]);
                      setAddMemberQuery('');
                      setAddMemberResults([]);
                      setShowAddMembersModal(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: 'var(--primary-subtle)',
                      border: '1px solid var(--primary-border)',
                      color: 'var(--primary)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <UserPlus size={14} /> メンバーを追加
                  </button>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}>
                  {groupMembers.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        border: '1px solid var(--glass-border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={m.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.username)}&background=2563eb&color=fff`}
                          alt={m.username}
                          onError={(e) => handleAvatarError(e, m.username)}
                          style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                              {m.username}
                            </span>
                            {m.id === currentUser.id && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(あなた)</span>
                            )}
                            {m.user_role === 'admin' && (
                              <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />
                            )}
                          </div>
                          {m.roblox_username && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{m.roblox_username}</span>
                          )}
                        </div>
                      </div>

                      {m.role === 'owner' ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '8px',
                          background: 'rgba(234, 179, 8, 0.15)',
                          color: '#eab308',
                          fontSize: '0.72rem',
                          fontWeight: 800
                        }}>
                          <Crown size={12} /> オーナー
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                          メンバー
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Danger Zone: Leave Group */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                <button
                  type="button"
                  onClick={handleLeaveGroup}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#ef4444',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s'
                  }}
                >
                  <LogOut size={16} /> グループを退出する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          MODAL: Add Members to Existing Group
          ────────────────────────────────────────────────────────── */}
      {showAddMembersModal && (
        <div
          onClick={() => setShowAddMembersModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(8px)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '420px',
              maxHeight: '80vh',
              background: theme === 'light' ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 24, 38, 0.98)',
              border: '1px solid var(--glass-border)',
              borderRadius: '24px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)'
            }}
            className="animate-scale"
          >
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--glass-border)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>メンバーを追加</h3>
              <button
                onClick={() => setShowAddMembersModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minHeight: 0 }}>
              {/* Search Input */}
              <div style={{ position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={addMemberQuery}
                  onChange={(e) => handleSearchAddMembers(e.target.value)}
                  placeholder="追加する市民を検索..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '10px 16px 10px 40px',
                    borderRadius: '999px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--input-text)',
                    fontSize: '0.88rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Selected Chips */}
              {selectedAddMembers.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxHeight: '70px', overflowY: 'auto' }}>
                  {selectedAddMembers.map(user => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: 'var(--primary-subtle)',
                        border: '1px solid var(--primary-border)',
                        color: 'var(--primary)',
                        fontSize: '0.78rem',
                        fontWeight: 700
                      }}
                    >
                      <span>{user.username}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedAddMembers(prev => prev.filter(u => u.id !== user.id))}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Candidate Results */}
              <div style={{ flex: 1, overflowY: 'auto', minHeight: '150px' }}>
                {addMemberResults.length > 0 ? (
                  addMemberResults.map(user => {
                    const isSelected = selectedAddMembers.some(u => u.id === user.id);
                    return (
                      <div
                        key={user.id}
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedAddMembers(prev => 
                            prev.some(u => u.id === user.id) ? prev.filter(u => u.id !== user.id) : [...prev, user]
                          );
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--primary-subtle)' : 'transparent',
                          marginBottom: '4px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img
                            src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=2563eb&color=fff`}
                            alt={user.username}
                            onError={(e) => handleAvatarError(e, user.username)}
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{user.username}</span>
                              {user.role === 'admin' && <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />}
                            </div>
                            {user.roblox_username && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user.roblox_username}</span>
                            )}
                          </div>
                        </div>

                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '6px',
                          border: isSelected ? 'none' : '2px solid var(--text-muted)',
                          background: isSelected ? 'var(--primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff'
                        }}>
                          {isSelected && <Check size={14} />}
                        </div>
                      </div>
                    );
                  })
                ) : addMemberQuery ? (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    追加可能な市民が見つかりませんでした
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    追加したい市民の名前を入力して検索してください
                  </div>
                )}
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleAddMembersToGroup}
                disabled={selectedAddMembers.length === 0 || isAddingMembers}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  cursor: selectedAddMembers.length === 0 || isAddingMembers ? 'not-allowed' : 'pointer',
                  opacity: selectedAddMembers.length === 0 || isAddingMembers ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)'
                }}
              >
                {isAddingMembers ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                <span>追加する ({selectedAddMembers.length}名)</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
