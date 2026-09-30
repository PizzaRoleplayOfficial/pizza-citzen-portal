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
  Download
} from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { triggerHaptic } from '../utils/native';

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
}

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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // State: Image Zoom
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<any>(null);

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
        setMessages(data.messages || []);
        if (data.partner) {
          setActivePartner(data.partner);
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

    // Restore draft text for this conversation
    const savedDraft = localStorage.getItem(`gvvr_dm_draft_${activeConversationId}`) || '';
    setInputText(savedDraft);

    fetchMessages(activeConversationId);

    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(() => {
      if (!document.hidden && activeConversationId) {
        fetchMessages(activeConversationId, true);
      }
    }, 5000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeConversationId]);

  // 会話一覧閲覧時の自動ポーリング (2.5秒間隔)
  useEffect(() => {
    if (activeConversationId) return;

    fetchConversations(true);
    const listTimer = setInterval(() => {
      if (!document.hidden && !activeConversationId) {
        fetchConversations(true);
      }
    }, 5000);

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

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle select conversation
  const handleSelectConversation = (conv: Conversation) => {
    triggerHaptic('light');
    setActiveConversationId(conv.id);
    setActivePartner({
      id: conv.partner_id,
      username: conv.partner_username,
      roblox_username: conv.partner_roblox_username,
      avatar: conv.partner_avatar,
      role: conv.partner_role
    });
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
      created_at: new Date().toISOString()
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
          imageData: selectedImage
        })
      });

      if (res.ok) {
        const data = await res.json();
        triggerHaptic('success');
        if (activeConversationId) {
          localStorage.removeItem(`gvvr_dm_draft_${activeConversationId}`);
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
                        ? (theme === 'light' ? 'rgba(0, 193, 102, 0.12)' : 'rgba(0, 193, 102, 0.1)') 
                        : 'transparent',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img
                        src={conv.partner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.partner_username)}&background=2563eb&color=fff`}
                        alt={conv.partner_username}
                        onError={(e) => handleAvatarError(e, conv.partner_username)}
                        style={{ width: '46px', height: '46px', borderRadius: '50%', objectFit: 'cover' }}
                      />
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
                          boxShadow: '0 2px 8px rgba(0, 193, 102, 0.4)'
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
                          {conv.partner_role === 'admin' && (
                            <ShieldCheck size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          )}
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
              background: 'rgba(0, 193, 102, 0.15)',
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
                  <img
                    src={activePartner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.username)}&background=2563eb&color=fff`}
                    alt={activePartner.username}
                    onError={(e) => handleAvatarError(e, activePartner.username)}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        {activePartner.username}
                      </span>
                      {activePartner.role === 'admin' && (
                        <ShieldCheck size={14} style={{ color: 'var(--primary)' }} />
                      )}
                    </div>
                    {activePartner.roblox_username && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{activePartner.roblox_username}
                      </span>
                    )}
                  </div>
                </div>

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

              {/* Messages Timeline */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px'
              }}>
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
                    return (
                      <div
                        key={msg.id || index}
                        style={{
                          display: 'flex',
                          flexDirection: isMine ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: '8px',
                          maxWidth: '100%'
                        }}
                      >
                        {!isMine && (
                          <img
                            src={activePartner.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePartner.username)}&background=2563eb&color=fff`}
                            alt="avatar"
                            onError={(e) => handleAvatarError(e, activePartner.username)}
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        )}

                        <div style={{
                          maxWidth: isMobile ? '80%' : '65%',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMine ? 'flex-end' : 'flex-start'
                        }}>
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
                            {msg.image_data && (
                              <img
                                src={msg.image_data}
                                alt="Attachment"
                                onClick={() => setZoomedImage(msg.image_data)}
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

              {/* Bottom Input Bar */}
              <div style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border)',
                background: theme === 'light' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(10, 15, 25, 0.6)',
                backdropFilter: 'blur(10px)'
              }}>
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
                      const val = e.target.value;
                      setInputText(val);
                      if (activeConversationId) {
                        localStorage.setItem(`gvvr_dm_draft_${activeConversationId}`, val);
                      }
                      e.target.style.height = 'auto';
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    onPaste={handlePaste}
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
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: '999px',
                      background: 'transparent',
                      border: 'none',
                      color: theme === 'dark' ? '#f4f4f5' : 'var(--text-main)',
                      fontSize: '16px',
                      outline: 'none',
                      resize: 'none',
                      minHeight: '36px',
                      maxHeight: '120px',
                      lineHeight: 1.4,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: theme === 'light' ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 20, 30, 0.95)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)'
          }} className="animate-scale">
            
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
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
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
                    padding: '10px 14px 10px 38px',
                    borderRadius: '10px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--input-text)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
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
                        borderRadius: '10px',
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

    </div>
  );
};
