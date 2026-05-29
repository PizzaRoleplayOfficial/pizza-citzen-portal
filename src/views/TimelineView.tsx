import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Image as ImageIcon, 
  Heart, 
  Trash2, 
  MessageSquare, 
  Loader2, 
  RotateCcw, 
  Share2,
  BarChart2,
  AlertCircle, 
  X, 
  Send 
} from 'lucide-react';
import { compressImage } from '../utils/helpers';
import { parseImages } from '../components/UIBase';
import { triggerHaptic } from '../utils/native';

interface TimelineViewProps {
  currentUser: any;
  isMobile: boolean;
  theme: 'dark' | 'light';
  targetPostId?: string | null;
  onClearTargetPost?: () => void;
}

interface TimelinePost {
  id: string;
  user_id: string;
  content: string;
  image_data: string | null;
  created_at: string;
  author_username: string | null;
  author_avatar: string | null;
  author_roblox_username: string | null;
  likes_count: number;
  comments_count: number;
  is_liked: number;
  views_count?: number;
}

interface TimelineComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_username: string | null;
  author_avatar: string | null;
  author_roblox_username: string | null;
  likes_count: number;
  is_liked: number;
}

export const TimelineView = ({ currentUser, isMobile, theme, targetPostId, onClearTargetPost }: TimelineViewProps) => {
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeZoomImage, setActiveZoomImage] = useState<string | null>(null);
  const [likeAnimatingPostId, setLikeAnimatingPostId] = useState<string | null>(null);
  
  // Comments related states
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Record<string, TimelineComment[]>>({});
  const [isCommentsLoading, setIsCommentsLoading] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<TimelineComment | null>(null);

  // Keep track of posts viewed in this session to prevent duplicate views count increments
  const [viewedPostIds, setViewedPostIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('gvvr_viewed_posts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`/api/timeline?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch timeline posts:", err);
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  const fetchComments = async (postId: string, isBackground = false) => {
    if (!isBackground) setIsCommentsLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch(`/api/timeline-comments?postId=${postId}&userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setPostComments(prev => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
      }
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      if (!isBackground) setIsCommentsLoading(prev => ({ ...prev, [postId]: false }));
    }
  };

  // Poll timeline posts every 1 second for real-time likes, views and new posts
  useEffect(() => {
    fetchPosts();
    const interval = setInterval(() => {
      fetchPosts(true);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch posts in background immediately when the detail modal is closed to sync views/comments/likes count
  useEffect(() => {
    if (!expandedPostId) {
      fetchPosts(true);
    }
  }, [expandedPostId]);

  // Poll active reply thread comments every 1 second when a thread is expanded
  useEffect(() => {
    if (!expandedPostId) return;

    fetchComments(expandedPostId);

    const interval = setInterval(() => {
      // Fetch in background to prevent flickering or losing focus
      fetchComments(expandedPostId, true);
    }, 1000);

    return () => clearInterval(interval);
  }, [expandedPostId]);

  // Handle back button / gesture when image is zoomed
  useEffect(() => {
    if (!activeZoomImage) return;

    window.history.pushState({ imageZoom: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      setActiveZoomImage(null);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.imageZoom) {
        window.history.back();
      }
    };
  }, [activeZoomImage]);

  // Handle back button / gesture when replies overlay modal is open
  useEffect(() => {
    if (!expandedPostId) return;

    window.history.pushState({ repliesOpen: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      setExpandedPostId(null);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.repliesOpen) {
        window.history.back();
      }
    };
  }, [expandedPostId]);

  // Handle resetting nested replying state on modal close
  useEffect(() => {
    if (!expandedPostId) {
      setReplyingToComment(null);
    }
  }, [expandedPostId]);

  // Handle target post selection, scrolling and comment expansion from notification center (v2.2.3)
  useEffect(() => {
    if (!targetPostId) return;
    
    // Wait until posts are loaded and the target post exists in the DOM/posts array
    const postExists = posts.some(p => p.id === targetPostId);
    if (!postExists) return;

    // 1. Open the comments replies overlay modal
    setExpandedPostId(targetPostId);
    fetchComments(targetPostId);
    incrementPostView(targetPostId);
    
    // 2. Scroll the post element into view smoothly after a short delay
    setTimeout(() => {
      const element = document.getElementById(`post-${targetPostId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight effect
        element.style.outline = '2px dashed var(--primary)';
        element.style.outlineOffset = '2px';
        element.style.transition = 'outline 0.3s ease';
        
        setTimeout(() => {
          element.style.outline = '2px dashed transparent';
        }, 3000);
      }
    }, 300);

    // Clear the target post state in parent so it doesn't trigger repeatedly
    if (onClearTargetPost) {
      onClearTargetPost();
    }
  }, [targetPostId, posts]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    if (newPostImages.length + fileList.length > 4) {
      alert("添付できる画像は最大4枚までです。");
      return;
    }

    triggerHaptic('light');
    try {
      const base64Images = await Promise.all(fileList.map(compressImage));
      setNewPostImages(prev => [...prev, ...base64Images]);
    } catch (err) {
      console.error("Image compression failed:", err);
      alert("画像の圧縮に失敗しました。");
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveImage = (index: number) => {
    triggerHaptic('light');
    setNewPostImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = Array.from(items).filter(item => item.type.indexOf('image') !== -1);
    if (imageItems.length === 0) return;

    const files = imageItems.map(item => item.getAsFile()).filter(f => f !== null) as File[];
    if (newPostImages.length + files.length > 4) {
      alert("画像は最大4枚までです。");
      return;
    }

    triggerHaptic('light');
    try {
      const base64Images = await Promise.all(files.map(compressImage));
      setNewPostImages(prev => [...prev, ...base64Images]);
    } catch (err) {
      console.error("Pasted image compression failed:", err);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim()) return;

    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          content: newPostContent,
          image_data: newPostImages.length > 0 ? JSON.stringify(newPostImages) : null
        })
      });

      if (res.ok) {
        setNewPostContent('');
        setNewPostImages([]);
        await fetchPosts();
      } else {
        const err = await res.json() as any;
        alert(err.error || "投稿に失敗しました。");
      }
    } catch (err) {
      console.error("Post creation error:", err);
      alert("ネットワークエラーが発生しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("この投稿を削除しますか？")) return;

    triggerHaptic('warning');
    try {
      const res = await fetch(`/api/timeline?id=${postId}&userId=${currentUser.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        // Clean up expanded state if deleted post was expanded
        if (expandedPostId === postId) {
          setExpandedPostId(null);
        }
      } else {
        alert("削除権限がないか、エラーが発生しました。");
      }
    } catch (err) {
      console.error("Post deletion failed:", err);
    }
  };

  const handleLikeToggle = async (post: TimelinePost) => {
    const action = post.is_liked ? 'unlike' : 'like';
    
    if (action === 'like') {
      triggerHaptic('light');
      setLikeAnimatingPostId(post.id);
      setTimeout(() => setLikeAnimatingPostId(null), 400);
    }

    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          is_liked: action === 'like' ? 1 : 0,
          likes_count: p.likes_count + (action === 'like' ? 1 : -1)
        };
      }
      return p;
    }));

    try {
      const res = await fetch('/api/timeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: post.id,
          userId: currentUser.id,
          action
        })
      });
      if (!res.ok) {
        fetchPosts();
      }
    } catch (err) {
      console.error("Like action failed:", err);
      fetchPosts();
    }
  };

  const incrementPostView = async (postId: string) => {
    // If already viewed in this session, do not increment again
    if (viewedPostIds.includes(postId)) return;

    // Add to viewed posts in session
    const updated = [...viewedPostIds, postId];
    setViewedPostIds(updated);
    try {
      sessionStorage.setItem('gvvr_viewed_posts', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save viewed posts to sessionStorage:', err);
    }

    // Optimistic Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return { ...p, views_count: (p.views_count || 0) + 1 };
      }
      return p;
    }));

    try {
      await fetch('/api/timeline', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          userId: currentUser.id,
          action: 'view'
        })
      });
    } catch (err) {
      console.error("Failed to increment post view:", err);
    }
  };

  const handleSharePost = async (post: TimelinePost) => {
    triggerHaptic('light');
    const shareUrl = `${window.location.origin}/timeline?postId=${post.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '市民タイムラインの投稿',
          text: `${post.author_username || '市民'}さんの投稿: "${post.content.substring(0, 100)}"`,
          url: shareUrl
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error("Web Share failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("投稿のリンクをクリップボードにコピーしました！");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
        alert("共有リンクのコピーに失敗しました。");
      }
    }
  };

  const handleCommentIconClick = (postId: string) => {
    triggerHaptic('light');
    setExpandedPostId(postId);
    setNewCommentText('');
    setReplyingToComment(null);
    fetchComments(postId);
    incrementPostView(postId);
  };

  const handleCreateComment = async (postId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;

    triggerHaptic('medium');
    setIsSubmittingComment(true);

    try {
      const res = await fetch('/api/timeline-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          userId: currentUser.id,
          content: newCommentText,
          parentId: replyingToComment?.id || null
        })
      });

      if (res.ok) {
        setNewCommentText('');
        setReplyingToComment(null);
        // Refresh replies list
        await fetchComments(postId);
        // Increment reply count in posts list
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: p.comments_count + 1 };
          }
          return p;
        }));
      } else {
        const err = await res.json() as any;
        alert(err.error || "コメントの投稿に失敗しました。");
      }
    } catch (err) {
      console.error("Comment submission failed:", err);
      alert("通信エラーが発生しました。");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentLikeToggle = async (postId: string, commentId: string, currentIsLiked: boolean) => {
    const action = currentIsLiked ? 'unlike' : 'like';
    
    // Optimistic Update
    setPostComments(prev => {
      const list = prev[postId] || [];
      return {
        ...prev,
        [postId]: list.map(c => {
          if (c.id === commentId) {
            return {
              ...c,
              is_liked: currentIsLiked ? 0 : 1,
              likes_count: c.likes_count + (currentIsLiked ? -1 : 1)
            };
          }
          return c;
        })
      };
    });

    triggerHaptic('light');

    try {
      const res = await fetch('/api/timeline-comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          userId: currentUser.id,
          action
        })
      });
      if (!res.ok) {
        fetchComments(postId, true);
      }
    } catch (err) {
      console.error("Comment like toggle failed:", err);
      fetchComments(postId, true);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!window.confirm("この返信コメントを削除しますか？")) return;

    triggerHaptic('warning');

    try {
      const res = await fetch(`/api/timeline-comments?id=${commentId}&userId=${currentUser.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setPostComments(prev => {
          const list = prev[postId] || [];
          return {
            ...prev,
            [postId]: list.filter(c => c.id !== commentId)
          };
        });

        // Decrement reply count in posts list
        setPosts(prev => prev.map(p => {
          if (p.id === postId) {
            return { ...p, comments_count: Math.max(0, p.comments_count - 1) };
          }
          return p;
        }));
      } else {
        alert("削除権限がないか、エラーが発生しました。");
      }
    } catch (err) {
      console.error("Comment deletion failed:", err);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    let formattedStr = dateStr;
    if (dateStr.indexOf(' ') !== -1 && dateStr.indexOf('T') === -1) {
      formattedStr = dateStr.replace(' ', 'T') + 'Z';
    }
    
    const postDate = new Date(formattedStr);
    const now = new Date();
    
    const postTimeMs = postDate.getTime() + (postDate.getTimezoneOffset() === 0 ? 9 * 60 * 60 * 1000 : 0);
    const diffMs = now.getTime() - postTimeMs;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return '今';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}日前`;
    
    return postDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  };

  const handleAvatarError = (e: React.SyntheticEvent<HTMLImageElement>, username: string) => {
    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=00c166&color=fff&size=100`;
  };

  const renderImageGrid = (imagesJson: string | null) => {
    const urls = parseImages(imagesJson);
    if (urls.length === 0) return null;

    const count = urls.length;
    let gridStyle: React.CSSProperties = {
      display: 'grid',
      gap: '8px',
      borderRadius: '16px',
      overflow: 'hidden',
      marginTop: '12px',
      border: '1px solid var(--glass-border)'
    };

    if (count === 1) {
      return (
        <div style={{ marginTop: '12px', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--glass-border)', cursor: 'zoom-in' }} onClick={() => setActiveZoomImage(urls[0])}>
          <img src={urls[0]} alt="Attached 1" style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', display: 'block' }} />
        </div>
      );
    } else if (count === 2) {
      gridStyle.gridTemplateColumns = 'repeat(2, 1fr)';
      gridStyle.height = '220px';
    } else if (count === 3) {
      gridStyle.gridTemplateColumns = '2fr 1fr';
      gridStyle.height = '280px';
    } else if (count === 4) {
      gridStyle.gridTemplateColumns = 'repeat(2, 1fr)';
      gridStyle.gridTemplateRows = 'repeat(2, 120px)';
      gridStyle.height = '248px';
    }

    return (
      <div style={gridStyle}>
        {urls.map((url, i) => {
          let itemStyle: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', cursor: 'zoom-in' };
          let wrapperStyle: React.CSSProperties = { position: 'relative', overflow: 'hidden' };
          if (count === 3 && i === 0) {
            wrapperStyle.gridRow = '1 / span 2';
          }
          if (count === 3 && i > 0) {
            wrapperStyle.height = '136px';
          }

          return (
            <div key={i} style={wrapperStyle} onClick={() => setActiveZoomImage(url)}>
              <img src={url} alt={`Attached ${i + 1}`} style={itemStyle} />
            </div>
          );
        })}
      </div>
    );
  };

  const activePost = posts.find(p => p.id === expandedPostId);

  return (
    <div className="animate-fade" style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
      
      {/* Floating Refresh Indicator when reloading in background */}
      {isLoading && posts.length > 0 && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--glass-border)',
          padding: '12px 24px',
          borderRadius: '30px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          zIndex: 1002,
          animation: 'slideDown 0.2s ease-out',
          minWidth: '200px',
          justifyContent: 'center'
        }}>
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 700, whiteSpace: 'nowrap' }}>タイムライン更新中...</span>
        </div>
      )}

      {/* Header with Manual Refresh Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>市民タイムライン</h2>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0' }}>ぴっざぁ市民のひとりごとや写真を共有しよう。</p>
        </div>
        <button 
          onClick={() => { triggerHaptic('light'); fetchPosts(); }} 
          disabled={isLoading}
          className="btn btn-secondary"
          style={{ padding: '10px 16px' }}
        >
          <RotateCcw size={18} className={isLoading ? 'animate-spin' : undefined} strokeWidth={2.5} />
        </button>
      </div>

      {/* New Post Creator Box */}
      <form onSubmit={handleCreatePost} className="glass card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <img 
            src={currentUser.avatar} 
            alt="Avatar" 
            onError={(e) => handleAvatarError(e, currentUser.username)} 
            style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff', objectFit: 'cover' }} 
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              onPaste={handlePaste}
              placeholder="いまどうしてる？（コピペでの画像追加もOK）"
              maxLength={280}
              style={{
                width: '100%',
                minHeight: '80px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '1.05rem',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5
              }}
            />
            
            {/* Selected Images Preview Container */}
            {newPostImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${newPostImages.length === 1 ? 1 : 2}, 1fr)`, gap: '8px', marginTop: '8px' }}>
                {newPostImages.map((img, i) => (
                  <div key={i} style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: newPostImages.length === 1 ? '240px' : '120px', border: '1px solid var(--glass-border)' }}>
                    <img src={img} alt={`Select ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(i)}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0,0,0,0.65)',
                        border: 'none',
                        borderRadius: '50%',
                        width: '26px',
                        height: '26px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <hr style={{ border: 'none', borderBottom: '1px solid var(--glass-border)', margin: '4px 0' }} />

        {/* Creator Actions Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={newPostImages.length >= 4}
              style={{
                background: 'rgba(0,193,102,0.08)',
                border: '1px solid rgba(0,193,102,0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--primary)',
                cursor: newPostImages.length >= 4 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: newPostImages.length >= 4 ? 0.5 : 1
              }}
            >
              <ImageIcon size={18} />
              <span>写真 ({newPostImages.length}/4)</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageSelect}
              multiple 
              accept="image/*" 
              style={{ display: 'none' }} 
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '0.8rem', color: newPostContent.length > 250 ? 'var(--error)' : 'var(--text-muted)' }}>
              {newPostContent.length} / 280
            </span>

            <button
              type="submit"
              disabled={isSubmitting || !newPostContent.trim()}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: !newPostContent.trim() ? 'not-allowed' : 'pointer',
                opacity: !newPostContent.trim() ? 0.6 : 1
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>送信中...</span>
                </>
              ) : (
                <>
                  <Send size={16} />
                  <span>ポスト</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Main Post Stream / Feed */}
      {isLoading && posts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '20px' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
            <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)', opacity: 0.8 }} />
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>タイムラインを読み込み中...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="glass card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-main)' }}>まだ投稿がありません</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>最初のひとりごとを投稿してみませんか？</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.map((post) => {
            const isAuthor = post.user_id === currentUser.id;
            const isAdmin = currentUser.role === 'admin';
            const isLiked = post.is_liked === 1;
            const isAnimating = likeAnimatingPostId === post.id;

            return (
              <div 
                key={post.id} 
                id={`post-${post.id}`}
                className="glass card" 
                style={{ 
                  padding: '20px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: '16px', 
                  background: 'var(--panel-bg)', 
                  border: '1px solid var(--glass-border)',
                  position: 'relative'
                }}
              >
                {/* Main Post Grid */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
                  {/* Author Avatar */}
                  <img 
                    src={post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_username || 'P')}&background=00c166&color=fff`} 
                    alt="Author Avatar" 
                    onError={(e) => handleAvatarError(e, post.author_username || 'P')}
                    style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff', objectFit: 'cover', flexShrink: 0 }} 
                  />

                  {/* Post Content Area */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    
                    {/* User meta information row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                        {post.author_username || '不明な市民'}
                      </span>
                      {post.author_roblox_username && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          @{post.author_roblox_username}
                        </span>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatRelativeTime(post.created_at)}
                      </span>
                    </div>

                    {/* Message body text */}
                    <p style={{ 
                       margin: 0, 
                       fontSize: '1rem', 
                       lineHeight: 1.5, 
                       color: 'var(--text-main)', 
                       wordBreak: 'break-word',
                       whiteSpace: 'pre-wrap'
                    }}>
                      {post.content}
                    </p>

                    {/* Render Images if any attached */}
                    {renderImageGrid(post.image_data)}

                    {/* Post Stats & Actions Bar */}
                    <div style={{ display: 'flex', gap: '32px', marginTop: '16px', color: 'var(--text-muted)' }}>
                      {/* Like Action */}
                      <button
                        onClick={() => handleLikeToggle(post)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: isLiked ? '#ff5252' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'color 0.2s',
                        }}
                      >
                        <Heart 
                          size={18} 
                          fill={isLiked ? '#ff5252' : 'none'}
                          style={{
                            transform: isAnimating ? 'scale(1.4)' : 'scale(1)',
                            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                          }}
                        />
                        <span>{post.likes_count}</span>
                      </button>

                      {/* Comment Action (Bottom Sheet / Overlay Modal Trigger) */}
                      <button
                        onClick={() => handleCommentIconClick(post.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'color 0.2s',
                        }}
                      >
                        <MessageSquare size={18} />
                        <span>{post.comments_count}</span>
                      </button>

                      {/* Views Count (BarChart2) */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text-muted)'
                        }}
                      >
                        <BarChart2 size={18} style={{ color: 'var(--text-muted)' }} />
                        <span>{(post.views_count || 0).toLocaleString()}</span>
                      </div>

                      {/* Share Action (Share2) */}
                      <button
                        onClick={() => handleSharePost(post)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                      >
                        <Share2 size={18} />
                        <span>共有</span>
                      </button>
                    </div>
                  </div>

                  {/* Delete Button (Visible to owner or admins) */}
                  {(isAuthor || isAdmin) && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'none',
                        border: 'none',
                        padding: '4px',
                        color: 'rgba(255,82,82,0.5)',
                        cursor: 'pointer',
                        transition: 'color 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ff5252'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,82,82,0.5)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Sheet (Mobile) / Centered Modal (PC) for Comments Replies */}
      {expandedPostId && activePost && createPortal(
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-overlay)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1001,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={() => setExpandedPostId(null)}
        >
          {/* Modal Card */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              /* PC: centered; Mobile: anchored to bottom above nav bar */
              ...(isMobile ? {
                /* nav bar ~80px + reply form ~70px */
                bottom: 'calc(130px + env(safe-area-inset-bottom, 0px))',
                top: '10vh',
                borderRadius: '20px 20px 0 0',
              } : {
                top: '10vh',
                bottom: '10vh',
                left: '50%',
                right: 'auto',
                width: '560px',
                transform: 'translateX(-50%)',
                borderRadius: '24px',
              }),
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 -4px 40px rgba(0,0,0,0.6)',
              animation: isMobile ? 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' : 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'default'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top Drag Handle for Bottom Sheet on Mobile */}
            {isMobile && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
                <div style={{ width: '40px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.15)' }} />
              </div>
            )}

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>返信スレッド</h3>
              <button 
                onClick={() => setExpandedPostId(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Replies Container */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Original Post Context */}
              <div style={{ display: 'flex', gap: '12px', padding: '16px', background: 'rgba(255,255,255,0.015)', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                <img 
                  src={activePost.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activePost.author_username || 'P')}&background=00c166&color=fff`} 
                  alt="Author Avatar" 
                  onError={(e) => handleAvatarError(e, activePost.author_username || 'P')}
                  style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                      {activePost.author_username || '不明な市民'}
                    </span>
                    {activePost.author_roblox_username && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        @{activePost.author_roblox_username}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                    {activePost.content}
                  </p>
                  {renderImageGrid(activePost.image_data)}
                </div>
              </div>

              {/* Replies Header Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  返信 ({activePost.comments_count})
                </span>
                <hr style={{ flex: 1, border: 'none', borderBottom: '1px solid var(--glass-border)', margin: 0 }} />
              </div>

              {/* Replies Feed */}
              {isCommentsLoading[activePost.id] && (postComments[activePost.id] || []).length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '32px 0' }}>
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>返信を読み込み中...</span>
                </div>
              ) : (postComments[activePost.id] || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  まだ返信はありません。
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {(() => {
                    const allComments = postComments[activePost.id] || [];
                    const mainComments = allComments.filter(c => !c.parent_id);
                    
                    return mainComments.map((comment) => {
                      const subReplies = allComments.filter(sub => sub.parent_id === comment.id);
                      const isCommentOwner = comment.user_id === currentUser.id;
                      const isPostOwner = activePost.user_id === currentUser.id;
                      const isUserAdmin = currentUser.role === 'admin';
                      const isCommentLiked = comment.is_liked === 1;

                      return (
                        <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px' }}>
                          
                          {/* 1階層目: メインコメント */}
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                            <img 
                              src={comment.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author_username || 'C')}&background=00c166&color=fff`} 
                              alt="Avatar" 
                              onError={(e) => handleAvatarError(e, comment.author_username || 'C')}
                              style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                                  {comment.author_username || '不明な市民'}
                                </span>
                                {comment.author_roblox_username && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    @{comment.author_roblox_username}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>•</span>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  {formatRelativeTime(comment.created_at)}
                                </span>
                              </div>

                              <p style={{ margin: '4px 0 8px', fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                {comment.content}
                              </p>

                              {/* Action Bar */}
                              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                {/* Like */}
                                <button
                                  onClick={() => handleCommentLikeToggle(activePost.id, comment.id, isCommentLiked)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: isCommentLiked ? '#ff5252' : 'var(--text-muted)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                  }}
                                >
                                  <Heart size={13} fill={isCommentLiked ? '#ff5252' : 'none'} />
                                  <span>{comment.likes_count || 0}</span>
                                </button>

                                {/* Reply */}
                                <button
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setReplyingToComment(comment);
                                    // Autofocus the reply input field
                                    const inputEl = document.querySelector('input[placeholder*="返信"]') as HTMLInputElement;
                                    if (inputEl) {
                                      inputEl.focus();
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: 'var(--text-muted)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'color 0.2s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                  返信
                                </button>

                                {/* Delete */}
                                {(isCommentOwner || isPostOwner || isUserAdmin) && (
                                  <button
                                    onClick={() => handleDeleteComment(activePost.id, comment.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: 0,
                                      color: 'rgba(255,82,82,0.65)',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ff5252'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,82,82,0.65)'}
                                  >
                                    削除
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2階層目: スレッド返信 */}
                          {subReplies.length > 0 && (
                            <div style={{
                              marginLeft: isMobile ? '24px' : '44px',
                              paddingLeft: '12px',
                              borderLeft: '1.5px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px',
                              marginTop: '4px'
                            }}>
                              {subReplies.map((sub) => {
                                const isSubOwner = sub.user_id === currentUser.id;
                                const isSubLiked = sub.is_liked === 1;

                                return (
                                  <div key={sub.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', paddingBottom: '4px' }}>
                                    <img 
                                      src={sub.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(sub.author_username || 'C')}&background=00c166&color=fff`} 
                                      alt="Avatar" 
                                      onError={(e) => handleAvatarError(e, sub.author_username || 'C')}
                                      style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-main)' }}>
                                          {sub.author_username || '不明な市民'}
                                        </span>
                                        {sub.author_roblox_username && (
                                          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                            @{sub.author_roblox_username}
                                          </span>
                                        )}
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>•</span>
                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                          {formatRelativeTime(sub.created_at)}
                                        </span>
                                      </div>

                                      <p style={{ margin: '2px 0 6px', fontSize: '0.85rem', color: 'var(--text-main)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                                        {sub.content}
                                      </p>

                                      {/* Sub Actions */}
                                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                        {/* Like */}
                                        <button
                                          onClick={() => handleCommentLikeToggle(activePost.id, sub.id, isSubLiked)}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            color: isSubLiked ? '#ff5252' : 'var(--text-muted)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '3px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'color 0.2s'
                                          }}
                                        >
                                          <Heart size={11} fill={isSubLiked ? '#ff5252' : 'none'} />
                                          <span>{sub.likes_count || 0}</span>
                                        </button>

                                        {/* Reply */}
                                        <button
                                          onClick={() => {
                                            triggerHaptic('light');
                                            setReplyingToComment(comment);
                                            setNewCommentText(`@${sub.author_username} `);
                                            const inputEl = document.querySelector('input[placeholder*="返信"]') as HTMLInputElement;
                                            if (inputEl) {
                                              inputEl.focus();
                                            }
                                          }}
                                          style={{
                                            background: 'none',
                                            border: 'none',
                                            padding: 0,
                                            color: 'var(--text-muted)',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'color 0.2s'
                                          }}
                                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                                        >
                                          返信
                                        </button>

                                        {/* Delete */}
                                        {(isSubOwner || isPostOwner || isUserAdmin) && (
                                          <button
                                            onClick={() => handleDeleteComment(activePost.id, sub.id)}
                                            style={{
                                              background: 'none',
                                              border: 'none',
                                              padding: 0,
                                              color: 'rgba(255,82,82,0.65)',
                                              fontSize: '0.7rem',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              transition: 'color 0.2s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#ff5252'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,82,82,0.65)'}
                                          >
                                            削除
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Reply Form - separate fixed element always above nav bar */}
      {expandedPostId && activePost && createPortal(
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: isMobile ? 'calc(60px + env(safe-area-inset-bottom, 0px))' : '10vh',
            zIndex: 1002,
            background: 'var(--glass-bg)',
            borderTop: '1px solid var(--glass-border)',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
            padding: '12px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            ...(isMobile ? {} : { width: '560px', left: '50%', transform: 'translateX(-50%)', borderRadius: '0 0 24px 24px', right: 'auto' })
          }}
          onClick={e => e.stopPropagation()}
        >
          {replyingToComment && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(0, 255, 136, 0.08)',
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 255, 136, 0.15)',
              fontSize: '0.8rem',
              color: 'var(--primary)',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              <span>
                <strong>@{replyingToComment.author_username}</strong> さんへの返信中...
              </span>
              <button 
                onClick={() => {
                  triggerHaptic('light');
                  setReplyingToComment(null);
                  if (newCommentText.startsWith(`@${replyingToComment.author_username} `)) {
                    setNewCommentText('');
                  }
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.75rem'
                }}
              >
                キャンセル
              </button>
            </div>
          )}

          <form onSubmit={(e) => handleCreateComment(activePost.id, e)} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <img
              src={currentUser.avatar}
              alt="My Avatar"
              onError={(e) => handleAvatarError(e, currentUser.username)}
              style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
            />
            <input
              type="text"
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={replyingToComment ? `${replyingToComment.author_username}さんへ返信...` : "返信をポスト..."}
              maxLength={200}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '10px',
                background: 'var(--input-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--input-text)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={isSubmittingComment || !newCommentText.trim()}
              style={{
                background: 'var(--primary)',
                border: 'none',
                borderRadius: '10px',
                width: '42px',
                height: '42px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme === 'light' ? '#fff' : '#000',
                cursor: !newCommentText.trim() ? 'not-allowed' : 'pointer',
                opacity: !newCommentText.trim() ? 0.5 : 1,
                flexShrink: 0
              }}
            >
              {isSubmittingComment ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>,
        document.body
      )}

      {/* Image Zoom Modal overlay */}
      {activeZoomImage && createPortal(
        <div 
          onClick={() => setActiveZoomImage(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.95)', 
            backdropFilter: 'blur(10px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999, 
            padding: '16px',
            cursor: 'zoom-out'
          }}
        >
          <button
            onClick={() => setActiveZoomImage(null)}
            style={{
              position: 'absolute',
              top: 'calc(16px + env(safe-area-inset-top))',
              right: '16px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            <X size={24} />
          </button>
          <img 
            src={activeZoomImage} 
            alt="Zoomed" 
            style={{ 
              maxWidth: '100%', 
              maxHeight: '92vh', 
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 10px 50px rgba(0,0,0,0.6)'
            }} 
          />
        </div>,
        document.body
      )}

    </div>
  );
};
