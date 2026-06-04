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
  Send,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Car,
  ChevronRight,
  Repeat2,
  Search,
  Bookmark,
  Pin,
  TrendingUp
} from 'lucide-react';
import { compressImage, compressVideo } from '../utils/helpers';
import { parseImages } from '../components/UIBase';
import { triggerHaptic } from '../utils/native';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { MediaSession } from '@capgo/capacitor-media-session';

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
  video_path: string | null;
  created_at: string;
  author_username: string | null;
  author_avatar: string | null;
  author_roblox_username: string | null;
  likes_count: number;
  comments_count: number;
  is_liked: number;
  views_count?: number;
  repost_id?: string | null;
  reposts_count?: number;
  is_reposted?: number;
  orig_content?: string | null;
  orig_image_data?: string | null;
  orig_video_path?: string | null;
  orig_created_at?: string | null;
  orig_author_id?: string | null;
  orig_author_username?: string | null;
  orig_author_avatar?: string | null;
  orig_author_roblox_username?: string | null;
  is_bookmarked?: number;
  is_pinned?: number;
  poll_options?: string | null;
  poll_expires_at?: string | null;
  user_voted_option?: number | null;
  poll_total_votes?: number;
  poll_option_0_votes?: number;
  poll_option_1_votes?: number;
  poll_option_2_votes?: number;
  poll_option_3_votes?: number;
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
  parent_id?: string | null;
  image_data?: string | null;
  video_path?: string | null;
  views_count?: number;
}

interface TimelineVideoPlayerProps {
  src: string;
  onPlay: () => void;
  maxHeight?: string;
  title?: string;
  artist?: string;
  artwork?: string;
}

const TimelineVideoPlayer = ({ src, onPlay, maxHeight, title, artist, artwork }: TimelineVideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdatedTimeRef = useRef<number>(0);

  // Synchronize fullscreen state for custom styles
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Auto-hide controls after 3 seconds of playing
  useEffect(() => {
    if (!isPlaying || !showControls) return;
    const timer = setTimeout(() => {
      setShowControls(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [showControls, isPlaying]);

  // 60fps high-precision linear interpolation loop for ultra-smooth seek thumb gliding
  useEffect(() => {
    let animationFrameId: number;
    let baseVideoTime = 0;
    let baseWallTime = 0;
    let isInitialized = false;
    
    const updateLoop = () => {
      const video = videoRef.current;
      if (video && !video.paused && !isDragging) {
        if (!isInitialized) {
          baseVideoTime = video.currentTime;
          baseWallTime = performance.now();
          isInitialized = true;
        }
        
        const elapsed = (performance.now() - baseWallTime) / 1000;
        let smoothTime = baseVideoTime + elapsed * (video.playbackRate || 1);
        
        // If smooth time drifts from actual video time by more than 0.15s (e.g. buffering/looping), resync immediately!
        const actual = video.currentTime;
        if (Math.abs(smoothTime - actual) > 0.15) {
          baseVideoTime = actual;
          baseWallTime = performance.now();
          smoothTime = actual;
        }
        
        // Clamp smoothly to duration boundary
        const dur = video.duration || 1;
        if (smoothTime > dur) {
          smoothTime = dur;
        }
        
        setCurrentTime(smoothTime);
      } else {
        isInitialized = false;
      }
      animationFrameId = requestAnimationFrame(updateLoop);
    };

    if (isPlaying && !isDragging) {
      animationFrameId = requestAnimationFrame(updateLoop);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, isDragging]);

  const handlePlayClick = () => {
    if (videoRef.current) {
      videoRef.current.play();
    }
  };

  const togglePlayPause = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic('light');
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted && volume === 0) {
        videoRef.current.volume = 0.5;
        setVolume(0.5);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        const container = containerRef.current;
        container.requestFullscreen?.() || 
        (container as any).webkitRequestFullscreen?.() || 
        (container as any).msRequestFullscreen?.();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val); // Smooth visual feedback instantly!
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const updatePositionState = (customParams?: { duration?: number; position?: number; playbackRate?: number }) => {
    const video = videoRef.current;
    if (!video) return;

    const dur = customParams?.duration !== undefined ? customParams.duration : video.duration;
    const cur = customParams?.position !== undefined ? customParams.position : video.currentTime;
    const playbackRate = customParams?.playbackRate !== undefined ? customParams.playbackRate : (video.playbackRate || 1);

    if (isNaN(dur) || dur <= 0 || isNaN(cur)) return;

    if (!customParams) {
      if (Math.abs(cur - lastUpdatedTimeRef.current) < 1 && cur !== 0 && cur !== dur) {
        return;
      }
    }

    lastUpdatedTimeRef.current = cur;

    const positionParams = {
      duration: dur,
      position: cur,
      playbackRate: playbackRate
    };

    if (Capacitor.isNativePlatform()) {
      try {
        MediaSession.setPositionState(positionParams);
      } catch (err) {
        console.error("Failed to set native MediaSession position state:", err);
      }
    } else if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState(positionParams);
      } catch (err) {
        console.error("Failed to set Web MediaSession position state:", err);
      }
    }
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setShowControls(true);
    if (onPlay) onPlay();

    let artworkUrl = 'https://pizza-citzen-portal.pages.dev/assets/logo.png';
    if (artwork && !artwork.startsWith('data:')) {
      if (artwork.startsWith('http://') || artwork.startsWith('https://')) {
        artworkUrl = artwork;
      } else if (artwork.startsWith('/')) {
        artworkUrl = window.location.origin + artwork;
      }
    } else {
      artworkUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(artist || 'P')}&background=00c166&color=fff&size=128`;
    }

    const metadataParams = {
      title: title || '市民の動画投稿',
      artist: artist || '不明な市民',
      album: '市民タイムライン',
      artwork: [
        { 
          src: artworkUrl, 
          sizes: '128x128', 
          type: 'image/png' 
        }
      ]
    };

    if (Capacitor.isNativePlatform()) {
      try {
        MediaSession.setMetadata(metadataParams);
        MediaSession.setPlaybackState({ playbackState: 'playing' });

        MediaSession.setActionHandler({ action: 'play' }, () => {
          videoRef.current?.play();
        });
        MediaSession.setActionHandler({ action: 'pause' }, () => {
          videoRef.current?.pause();
        });
        MediaSession.setActionHandler({ action: 'seekto' }, (details: any) => {
          if (videoRef.current && details?.seekTime !== undefined) {
            videoRef.current.currentTime = details.seekTime;
            updatePositionState({ position: details.seekTime });
          }
        });
      } catch (err) {
        console.error("Failed to set native MediaSession:", err);
      }
    } else if ('mediaSession' in navigator && 'MediaMetadata' in window) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata(metadataParams);
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          videoRef.current?.play();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          videoRef.current?.pause();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (videoRef.current && details.seekTime !== undefined) {
            videoRef.current.currentTime = details.seekTime;
            updatePositionState({ position: details.seekTime });
          }
        });
      } catch (err) {
        console.error("Failed to set Web MediaSession metadata:", err);
      }
    }

    setTimeout(() => {
      updatePositionState();
    }, 150);
  };

  const handlePause = () => {
    setIsPlaying(false);
    setShowControls(true);

    if (videoRef.current) {
      const dur = videoRef.current.duration;
      const cur = videoRef.current.currentTime;
      if (!isNaN(dur) && dur > 0) {
        updatePositionState({ duration: dur, position: cur, playbackRate: 0 });
      }
    }

    if (Capacitor.isNativePlatform()) {
      try {
        MediaSession.setPlaybackState({ playbackState: 'paused' });
      } catch (err) {
        console.error("Failed to set native MediaSession pause state:", err);
      }
    } else if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setShowControls(true);

    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (!isNaN(dur) && dur > 0) {
        updatePositionState({ duration: dur, position: dur, playbackRate: 0 });
      }
    }

    if (Capacitor.isNativePlatform()) {
      try {
        MediaSession.setPlaybackState({ playbackState: 'none' });
      } catch (err) {
        console.error("Failed to reset native MediaSession state:", err);
      }
    } else if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'none';
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDragging) {
      setCurrentTime(videoRef.current.currentTime);
    }
    updatePositionState();
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
    updatePositionState();
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={() => setShowControls(true)}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      onClick={togglePlayPause}
      style={{ 
        position: 'relative', 
        borderRadius: isFullscreen ? '0' : '16px', 
        overflow: 'hidden', 
        border: isFullscreen ? 'none' : '1px solid var(--glass-border)', 
        background: '#000',
        cursor: 'pointer',
        boxShadow: isFullscreen ? 'none' : '0 12px 36px rgba(0,0,0,0.5)',
        width: isFullscreen ? '100%' : 'auto',
        height: isFullscreen ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      <video 
        ref={videoRef}
        src={`${src}#t=0.001`} 
        preload="metadata"
        playsInline 
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        style={{ 
          width: '100%', 
          height: isFullscreen ? '100%' : 'auto',
          maxHeight: isFullscreen ? '100vh' : (maxHeight || '400px'), 
          objectFit: 'contain', 
          display: 'block' 
        }} 
      />
      
      {/* 1. Large Central Play Button (When paused) */}
      {!isPlaying && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.35)',
          transition: 'background 0.3s',
          zIndex: 4
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.45)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(0, 0, 0, 0.35)';
        }}
        >
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            transition: 'transform 0.2s, background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'var(--glass-bg)';
          }}
          >
            <Play size={28} fill="#fff" style={{ marginLeft: '4px' }} />
          </div>
        </div>
      )}

      {/* 2. Glassmorphic Ultra-Stylish Controls Bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: isFullscreen ? '16px' : '8px 12px',
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 60%, transparent 100%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: isFullscreen ? '12px' : '4px',
        zIndex: 5,
        opacity: showControls ? 1 : 0,
        transform: showControls ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none'
      }}
      onClick={e => e.stopPropagation()}
      >
        {/* Progress Slider Track */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
          <input 
            type="range"
            min={0}
            max={duration || 100}
            step="any"
            value={currentTime}
            onChange={handleSeek}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
            onMouseUp={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              if (videoRef.current) {
                videoRef.current.currentTime = val;
              }
              updatePositionState({ position: val });
            }}
            onTouchEnd={(e) => {
              setIsDragging(false);
              const val = parseFloat((e.target as HTMLInputElement).value);
              if (videoRef.current) {
                videoRef.current.currentTime = val;
              }
              updatePositionState({ position: val });
            }}
            style={{
              flex: 1,
              height: '5px',
              borderRadius: '3px',
              background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.15) ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.15) 100%)`,
              outline: 'none',
              cursor: 'pointer',
              WebkitAppearance: 'none',
              transition: 'none'
            }}
            className="video-seek-slider"
          />
        </div>

        {/* Action Buttons & Time Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color: '#fff' }}>
          
          {/* Play/Pause & Time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={togglePlayPause}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              {isPlaying ? <Pause size={16} fill="#fff" /> : <Play size={16} fill="#fff" style={{ marginLeft: '2px' }} />}
            </button>

            {/* Time Stamp Counter */}
            <span style={{ 
              fontSize: '0.78rem', 
              fontWeight: 600, 
              color: 'rgba(255,255,255,0.85)', 
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap'
            }}>
              {formatTime(currentTime)}<span style={{ color: 'rgba(255,255,255,0.4)', margin: '0 4px' }}>/</span>{formatTime(duration)}
            </span>
          </div>

          {/* Volume, Mute & Fullscreen */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={toggleMute}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  transition: 'color 0.2s, transform 0.1s'
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>

              <input 
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{
                  width: '60px',
                  height: '4px',
                  borderRadius: '2px',
                  background: `linear-gradient(to right, #fff 0%, #fff ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  WebkitAppearance: 'none',
                }}
                className="volume-slider"
              />
            </div>

            <button 
              onClick={toggleFullscreen}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '6px',
                transition: 'color 0.2s, transform 0.1s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
            >
              <Maximize size={18} />
            </button>
          </div>

        </div>
      </div>

      {/* Stylesheet for seeking slider thumb hiding/styling */}
      <style>{`
        .video-seek-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 0 10px rgba(0, 193, 102, 0.8), 0 0 4px rgba(0,0,0,0.5);
          cursor: pointer;
          margin-top: -4.5px;
          border: none;
          transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .video-seek-slider::-webkit-slider-thumb:hover {
          transform: scale(1.25);
        }
        .video-seek-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          border: none;
          box-shadow: 0 0 10px rgba(0, 193, 102, 0.8), 0 0 4px rgba(0,0,0,0.5);
          cursor: pointer;
          transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
        }
        .video-seek-slider::-moz-range-thumb:hover {
          transform: scale(1.25);
        }
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: none;
        }
        .volume-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          border: none;
          cursor: pointer;
        }
        @media (max-width: 480px) {
          .volume-slider {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

const highlightText = (text: string, highlight: string) => {
  if (!highlight.trim()) return <span>{text}</span>;
  const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark 
            key={i} 
            style={{ 
              background: 'rgba(0, 193, 102, 0.25)', 
              color: 'var(--primary)', 
              padding: '1px 3px', 
              borderRadius: '4px',
              fontWeight: 700
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  );
};

export const TimelineView = ({ currentUser, isMobile, theme, targetPostId, onClearTargetPost }: TimelineViewProps) => {
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostImages, setNewPostImages] = useState<string[]>([]);
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isCompressingVideo, setIsCompressingVideo] = useState(false);

  // Click Particle Burst System
  const [clickParticles, setClickParticles] = useState<Array<{ id: string; x: number; y: number; char: string; color: string; angle: number; velocity: number }>>([]);
  
  const triggerParticleBurst = (clientX: number, clientY: number, type: 'like' | 'repost') => {
    // Generate 6 particles
    const newParticles = Array.from({ length: 6 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const velocity = Math.random() * 80 + 40; // Pixels per second
      return {
        id: crypto.randomUUID(),
        x: clientX,
        y: clientY,
        char: type === 'like' ? '❤️' : '✨',
        color: type === 'like' ? '#ff5252' : '#00c166',
        angle,
        velocity
      };
    });

    setClickParticles(prev => [...prev, ...newParticles]);

    // Cleanup after 800ms
    setTimeout(() => {
      const idsToRemove = newParticles.map(p => p.id);
      setClickParticles(prev => prev.filter(p => !idsToRemove.includes(p.id)));
    }, 850);
  };

  // URL Link Preview Generator
  const renderLinkPreview = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const match = text.match(urlRegex);
    if (!match) return null;
    const url = match[0];

    let title = "Web リンク";
    let desc = "共有された外部リンクを開く";
    let brandColor = "rgba(255,255,255,0.4)";
    let icon = <Compass size={18} />;

    if (url.includes('roblox.com')) {
      title = "Roblox 公式サイト";
      desc = "Greenville や Rensselaer County へのアクセスはこちらから";
      brandColor = "rgba(239, 68, 68, 0.4)";
      icon = (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path d="M18.884 2.846L5.12 6.812l3.966 14.34L22.85 17.185zM9.54 11.238l4.49-.974.974 4.49-4.49.974z" />
        </svg>
      );
    } else if (url.includes('discord.gg') || url.includes('discord.com')) {
      title = "Discord 招待リンク";
      desc = "公式ディスコードに参加して市民コミュニティに合流しよう！";
      brandColor = "rgba(88, 101, 242, 0.4)";
      icon = (
        <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="#5865F2" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.8.71,1.64,1.41,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.22,123.6,27.31,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
        </svg>
      );
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
      title = "YouTube 共有動画";
      desc = "市民がタイムラインで共有した動画を開いて再生する";
      brandColor = "rgba(239, 68, 68, 0.4)";
      icon = (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#ff0000" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.517 3.545 12 3.545 12 3.545s-7.517 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.871.508 9.388.508 9.388.508s7.517 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      );
    } else if (url.includes('fandom.com') || url.includes('wiki')) {
      title = "Roblox Wiki カタログ";
      desc = "車両モデルやカラーコード、トリムの詳細仕様をWikiで確認";
      brandColor = "rgba(0, 193, 102, 0.4)";
      icon = <BookOpen size={18} style={{ color: 'var(--primary)' }} />;
    }

    try {
      const host = new URL(url).hostname;
      return (
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          onClick={(e) => e.stopPropagation()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginTop: '12px',
            padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
            border: '1px solid var(--glass-border)',
            borderLeft: `4px solid ${brandColor}`,
            borderRadius: '12px',
            textDecoration: 'none',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
          }}
        >
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            {icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{desc}</div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
            {host}
          </div>
        </a>
      );
    } catch {
      return null;
    }
  };

  // Manage video preview object URL lifetime to prevent memory leaks and unnecessary player resets
  useEffect(() => {
    if (!selectedVideoFile) {
      setVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedVideoFile);
    setVideoPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedVideoFile]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFeedTab, setActiveFeedTab] = useState<'all' | 'following' | 'bookmarks'>('all');
  const [searchSuggestions, setSearchSuggestions] = useState<{ users: any[]; keywords: string[] }>({ users: [], keywords: [] });
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Poll composer and Trends states
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState(1440); // 1 day
  const [trends, setTrends] = useState<{ tag: string; count: number }[]>([]);

  // Fetch trending hashtags
  const fetchTrends = async () => {
    try {
      const res = await fetch('/api/timeline/trends');
      if (res.ok) {
        const data = await res.json();
        setTrends(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to fetch trends:", err);
    }
  };

  useEffect(() => {
    fetchTrends();
    const interval = setInterval(fetchTrends, 45000); // refresh every 45s
    return () => clearInterval(interval);
  }, []);

  // Poll voting helper
  const handleVote = async (postId: string, optionIndex: number) => {
    triggerHaptic('light');
    // Optimistic vote update locally
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const updated = { ...p };
        updated.user_voted_option = optionIndex;
        updated.poll_total_votes = (updated.poll_total_votes || 0) + 1;
        const key = `poll_option_${optionIndex}_votes` as keyof TimelinePost;
        updated[key] = ((updated[key] as number) || 0) + 1;
        return updated;
      }
      return p;
    }));

    try {
      const res = await fetch('/api/timeline/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, postId, optionIndex })
      });
      if (!res.ok) {
        fetchPosts(true); // revert
      }
    } catch (err) {
      console.error("Vote failed:", err);
      fetchPosts(true);
    }
  };

  // Bookmark toggle helper
  const handleBookmarkToggle = async (post: TimelinePost) => {
    triggerHaptic('light');
    const isBookmarked = post.is_bookmarked === 1;
    const action = isBookmarked ? 'unbookmark' : 'bookmark';

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === post.id) {
        return { ...p, is_bookmarked: isBookmarked ? 0 : 1 };
      }
      return p;
    }));

    try {
      const res = await fetch('/api/timeline/bookmark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, postId: post.id, action })
      });
      if (!res.ok) {
        // revert on error
        setPosts(prev => prev.map(p => {
          if (p.id === post.id) {
            return { ...p, is_bookmarked: isBookmarked ? 1 : 0 };
          }
          return p;
        }));
      }
    } catch (err) {
      console.error("Bookmark toggle failed:", err);
    }
  };

  // Pinned post toggle helper
  const handlePinToggle = async (post: TimelinePost) => {
    triggerHaptic('medium');
    const isPinned = post.is_pinned === 1;
    const action = isPinned ? 'unpin' : 'pin';

    // Optimistic update (Only one pinned post allowed per user)
    setPosts(prev => prev.map(p => {
      if (p.user_id === currentUser.id) {
        if (p.id === post.id) {
          return { ...p, is_pinned: isPinned ? 0 : 1 };
        } else {
          return { ...p, is_pinned: 0 }; // unpin others
        }
      }
      return p;
    }));

    try {
      const res = await fetch('/api/timeline/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, postId: post.id, action })
      });
      if (!res.ok) {
        fetchPosts(true); // revert
      }
    } catch (err) {
      console.error("Pin toggle failed:", err);
    }
  };
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeZoomImage, setActiveZoomImage] = useState<string | null>(null);
  const [likeAnimatingPostId, setLikeAnimatingPostId] = useState<string | null>(null);
  
  // Comments related states
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [deepLinkedPost, setDeepLinkedPost] = useState<TimelinePost | null>(null);
  const [postComments, setPostComments] = useState<Record<string, TimelineComment[]>>({});
  const [isCommentsLoading, setIsCommentsLoading] = useState<Record<string, boolean>>({});
  const [newCommentText, setNewCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<TimelineComment | null>(null);
  // Comment Media States
  const [newCommentImages, setNewCommentImages] = useState<string[]>([]);
  const [selectedCommentVideoFile, setSelectedCommentVideoFile] = useState<File | null>(null);
  const [commentVideoPreviewUrl, setCommentVideoPreviewUrl] = useState<string | null>(null);
  const [isCompressingCommentVideo, setIsCompressingCommentVideo] = useState(false);

  useEffect(() => {
    if (!selectedCommentVideoFile) {
      setCommentVideoPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedCommentVideoFile);
    setCommentVideoPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedCommentVideoFile]);

  // User Profile Modal States
  const [selectedUserProfile, setSelectedUserProfile] = useState<{ userId: string; username: string; robloxUsername: string | null; avatar: string | null } | null>(null);
  const [profileVehicles, setProfileVehicles] = useState<any[]>([]);
  const [loadingProfileVehicles, setLoadingProfileVehicles] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [bioText, setBioText] = useState('');
  const [profileInfo, setProfileInfo] = useState<{ bio: string | null; followingCount: number; followerCount: number; isFollowing: boolean; isFollower?: boolean } | null>(null);
  const [loadingProfileInfo, setLoadingProfileInfo] = useState(false);

  // Premium Profile Experience states
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState('');
  const [profileFade, setProfileFade] = useState(true);

  const charCount = newPostContent.length;
  const maxChars = 280;
  const percentage = Math.min((charCount / maxChars) * 100, 100);
  const strokeColor = charCount >= 280 ? '#ff3b30' : charCount >= 240 ? '#ffa500' : 'var(--primary)';
  
  const hasPollOptions = showPollComposer && pollOptions.filter(o => o.trim()).length >= 2;
  const isPostEmpty = !newPostContent.trim() && newPostImages.length === 0 && !selectedVideoFile && !hasPollOptions;
  const isPollInvalid = showPollComposer && (pollOptions.filter(o => o.trim()).length < 2 || pollOptions.some(o => !o.trim()));
  const isSubmitDisabled = isSubmitting || isPostEmpty || isPollInvalid || charCount > 280;

  // Deep Linking Sync - Sync active modals to browser URL query search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (expandedPostId) {
      if (params.get('post') !== expandedPostId) {
        params.set('post', expandedPostId);
        params.delete('user'); // Prioritize post modal
        changed = true;
      }
    } else if (selectedUserProfile) {
      if (params.get('user') !== selectedUserProfile.userId) {
        params.set('user', selectedUserProfile.userId);
        params.delete('post');
        changed = true;
      }
    } else {
      if (params.has('post') || params.has('user')) {
        params.delete('post');
        params.delete('user');
        changed = true;
      }
    }

    if (changed) {
      const newQuery = params.toString();
      const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
      window.history.replaceState(null, '', newUrl);
    }
  }, [expandedPostId, selectedUserProfile]);

  // Deep Linking Parse - Parse query parameters on load to auto-open profiles or posts
  useEffect(() => {
    const handleUrlParams = async () => {
      const params = new URLSearchParams(window.location.search);
      const postParam = params.get('post');
      const userParam = params.get('user');

      if (postParam) {
        setExpandedPostId(postParam);
        
        try {
          // Attempt to fetch the specific post in case it's not in the initially loaded feed
          const res = await fetch(`/api/timeline?userId=${currentUser.id}&postId=${postParam}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              setDeepLinkedPost(data[0]);
            }
          }
        } catch (err) {
          console.error("Failed to fetch deep-linked post:", err);
        }
      } else if (userParam) {
        try {
          const res = await fetch(`/api/profile?userId=${userParam}`);
          if (res.ok) {
            const data = await res.json();
            setSelectedUserProfile({
              userId: data.id,
              username: data.username,
              robloxUsername: data.roblox_username,
              avatar: data.avatar
            });
          }
        } catch (err) {
          console.error("Failed to fetch deep-linked user profile:", err);
        }
      }
    };

    handleUrlParams();
  }, [currentUser.id]);

  // Follow list sub-modal states
  const [followListModal, setFollowListModal] = useState<{ type: 'following' | 'followers'; userId: string; list: any[] } | null>(null);
  const [loadingFollowList, setLoadingFollowList] = useState(false);

  const fetchFollowList = async (userId: string, type: 'following' | 'followers') => {
    setLoadingFollowList(true);
    setFollowListModal({ type, userId, list: [] });
    try {
      const res = await fetch(`/api/profile?userId=${userId}&type=${type}`);
      if (res.ok) {
        const list = await res.json();
        setFollowListModal({ type, userId, list: Array.isArray(list) ? list : [] });
      }
    } catch (err) {
      console.error("Failed to fetch follow list:", err);
    } finally {
      setLoadingFollowList(false);
    }
  };

  useEffect(() => {
    if (!selectedUserProfile) {
      setProfileInfo(null);
      setIsFollowing(false);
      setBioText('');
      setIsEditingBio(false);
      setProfileFade(true);
      return;
    }
    setLoadingProfileInfo(true);
    setProfileFade(false); // start fade out
    
    fetch(`/api/profile?userId=${selectedUserProfile.userId}&viewerId=${currentUser.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setProfileInfo(data);
          setBioText(data.bio || '');
          setIsFollowing(data.isFollowing);
          setIsEditingBio(false);
          
          // Trigger smooth fade back in
          setTimeout(() => {
            setProfileFade(true);
          }, 60);
        }
      })
      .catch(err => {
        console.error("Failed to fetch profile info:", err);
        setProfileFade(true);
      })
      .finally(() => setLoadingProfileInfo(false));
  }, [selectedUserProfile, currentUser]);

  useEffect(() => {
    if (!selectedUserProfile) {
      setProfileVehicles([]);
      return;
    }
    const canSeeVehicles = selectedUserProfile.userId === currentUser.id || currentUser.role === 'admin';
    if (!canSeeVehicles) {
      setProfileVehicles([]);
      return;
    }
    setLoadingProfileVehicles(true);
    fetch(`/api/vehicles?userId=${selectedUserProfile.userId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setProfileVehicles(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Failed to fetch profile vehicles:", err))
      .finally(() => setLoadingProfileVehicles(false));
  }, [selectedUserProfile, currentUser]);

  // Keep track of posts viewed in this session to prevent duplicate views count increments
  const [viewedPostIds, setViewedPostIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('gvvr_viewed_posts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Keep track of comments viewed in this session to prevent duplicate views count increments
  const [viewedCommentIds, setViewedCommentIds] = useState<string[]>(() => {
    try {
      const stored = sessionStorage.getItem('gvvr_viewed_comments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const incrementCommentView = async (postId: string, commentId: string) => {
    if (viewedCommentIds.includes(commentId)) return;

    // Add to viewed comments in session
    const updated = [...viewedCommentIds, commentId];
    setViewedCommentIds(updated);
    try {
      sessionStorage.setItem('gvvr_viewed_comments', JSON.stringify(updated));
    } catch (err) {
      console.warn('Failed to save viewed comments to sessionStorage:', err);
    }

    // Optimistic Update
    setPostComments(prev => {
      const list = prev[postId] || [];
      return {
        ...prev,
        [postId]: list.map(c => {
          if (c.id === commentId) {
            return { ...c, views_count: (c.views_count || 0) + 1 };
          }
          return c;
        })
      };
    });

    try {
      await fetch('/api/timeline-comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentId,
          userId: currentUser.id,
          action: 'view'
        })
      });
    } catch (err) {
      console.error("Failed to increment comment view:", err);
    }
  };

  // Automatically trigger views count updates for loaded comments inside expanded post modal
  useEffect(() => {
    if (!expandedPostId) return;
    const comments = postComments[expandedPostId] || [];
    comments.forEach(c => {
      if (!viewedCommentIds.includes(c.id)) {
        incrementCommentView(expandedPostId, c.id);
      }
    });
  }, [postComments, expandedPostId]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    try {
      const res = await fetch(`/api/timeline?userId=${currentUser.id}&feed=${activeFeedTab}`);
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

  // Fetch search suggestions with debouncing (300ms)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchSuggestions({ users: [], keywords: [] });
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchSuggestions(data || { users: [], keywords: [] });
        }
      } catch (err) {
        console.error("Failed to fetch search suggestions:", err);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside search suggestions dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Poll timeline posts every 1 second for real-time likes, views and new posts
  useEffect(() => {
    fetchPosts();
    const interval = setInterval(() => {
      fetchPosts(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeFeedTab]);

  // Fetch posts in background immediately when the detail modal is closed to sync views/comments/likes count
  useEffect(() => {
    if (!expandedPostId) {
      fetchPosts(true);
    }
  }, [expandedPostId, activeFeedTab]);

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

  // Handle back button / gesture when follow list modal is open
  useEffect(() => {
    if (!followListModal) return;

    window.history.pushState({ followListOpen: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      setFollowListModal(null);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (window.history.state?.followListOpen) {
        window.history.back();
      }
    };
  }, [!!followListModal]);

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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Check if there are any video files in the selection
    const videoFile = fileList.find(f => f.type.startsWith('video/'));
    
    if (videoFile) {
      // If a video is selected, switch exclusively to video mode and clear any selected images
      triggerHaptic('medium');
      setSelectedVideoFile(videoFile);
      setNewPostImages([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // If images are selected, clear any selected video
    if (selectedVideoFile) {
      setSelectedVideoFile(null);
    }

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

  const handleRemoveVideo = () => {
    triggerHaptic('light');
    setSelectedVideoFile(null);
  };

  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const handleCommentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const videoFile = fileList.find(f => f.type.startsWith('video/'));
    
    if (videoFile) {
      triggerHaptic('medium');
      setSelectedCommentVideoFile(videoFile);
      setNewCommentImages([]);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
      return;
    }

    if (selectedCommentVideoFile) {
      setSelectedCommentVideoFile(null);
    }

    if (newCommentImages.length + fileList.length > 4) {
      alert("添付できる画像は最大4枚までです。");
      return;
    }

    triggerHaptic('light');
    try {
      const base64Images = await Promise.all(fileList.map(compressImage));
      setNewCommentImages(prev => [...prev, ...base64Images]);
    } catch (err) {
      console.error("Comment image compression failed:", err);
      alert("画像の圧縮に失敗しました。");
    }
    
    if (commentFileInputRef.current) commentFileInputRef.current.value = '';
  };

  const handleRemoveCommentImage = (index: number) => {
    triggerHaptic('light');
    setNewCommentImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveCommentVideo = () => {
    triggerHaptic('light');
    setSelectedCommentVideoFile(null);
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
    const hasPoll = showPollComposer && pollOptions.filter(o => o.trim()).length >= 2;
    if (!newPostContent.trim() && newPostImages.length === 0 && !selectedVideoFile && !hasPoll) return;

    triggerHaptic('medium');
    setIsSubmitting(true);

    try {
      let videoPath: string | null = null;

      if (selectedVideoFile) {
        setIsCompressingVideo(true);
        try {
          // Compress large video to 720p client-side
          const compressedBlob = await compressVideo(selectedVideoFile);
          setIsCompressingVideo(false);

          // Upload compressed video to R2
          const uploadFormData = new FormData();
          uploadFormData.append('file', compressedBlob, selectedVideoFile.name);

          const uploadRes = await fetch('/api/upload-media', {
            method: 'POST',
            body: uploadFormData
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json() as any;
            throw new Error(errData.error || "動画のアップロードに失敗しました。");
          }

          const uploadResult = await uploadRes.json() as { key: string };
          videoPath = uploadResult.key;
        } catch (compressErr: any) {
          setIsCompressingVideo(false);
          setIsSubmitting(false);
          alert(compressErr.message || "動画の圧縮またはアップロードに失敗しました。");
          return;
        }
      }

      const pollData = hasPoll ? {
        options: pollOptions.filter(o => o.trim()),
        durationMinutes: pollDuration
      } : null;

      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          content: newPostContent,
          image_data: newPostImages.length > 0 ? JSON.stringify(newPostImages) : null,
          video_path: videoPath,
          poll: pollData
        })
      });

      if (res.ok) {
        setNewPostContent('');
        setNewPostImages([]);
        setSelectedVideoFile(null);
        setShowPollComposer(false);
        setPollOptions(['', '']);
        setPollDuration(1440);
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

  const handleRepostToggle = async (post: TimelinePost) => {
    const targetPost = post.repost_id ? getTargetPost(post) : post;
    const isCurrentlyReposted = targetPost.is_reposted === 1;
    const action = isCurrentlyReposted ? 'unrepost' : 'repost';

    triggerHaptic('light');

    // Optimistic UI updates
    setPosts(prev => prev.map(p => {
      if (p.id === targetPost.id) {
        return {
          ...p,
          is_reposted: isCurrentlyReposted ? 0 : 1,
          reposts_count: Math.max(0, (p.reposts_count || 0) + (isCurrentlyReposted ? -1 : 1))
        };
      }
      if (p.repost_id === targetPost.id) {
        return {
          ...p,
          reposts_count: Math.max(0, (p.reposts_count || 0) + (isCurrentlyReposted ? -1 : 1))
        };
      }
      return p;
    }));

    try {
      if (action === 'repost') {
        const res = await fetch('/api/timeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            repostId: targetPost.id
          })
        });
        if (!res.ok) {
          await fetchPosts();
        } else {
          await fetchPosts();
        }
      } else {
        const ourRepost = posts.find(p => p.repost_id === targetPost.id && p.user_id === currentUser.id);
        if (ourRepost) {
          const res = await fetch(`/api/timeline?id=${ourRepost.id}&userId=${currentUser.id}`, {
            method: 'DELETE'
          });
          if (!res.ok) {
            await fetchPosts();
          } else {
            await fetchPosts();
          }
        }
      }
    } catch (err) {
      console.error("Repost action failed:", err);
      await fetchPosts();
    }
  };

  const getTargetPost = (post: TimelinePost): TimelinePost => {
    if (!post.repost_id) return post;
    
    const loaded = posts.find(p => p.id === post.repost_id);
    if (loaded) return loaded;
    
    return {
      id: post.repost_id,
      user_id: post.orig_author_id || '',
      content: post.orig_content || '',
      image_data: post.orig_image_data || null,
      video_path: post.orig_video_path || null,
      created_at: post.orig_created_at || post.created_at,
      author_username: post.orig_author_username,
      author_avatar: post.orig_author_avatar,
      author_roblox_username: post.orig_author_roblox_username,
      likes_count: post.likes_count, // Already COALESCE'd in API
      comments_count: post.comments_count, // Already COALESCE'd in API
      is_liked: post.is_liked, // Already COALESCE'd in API
      views_count: post.views_count,
      reposts_count: post.reposts_count,
      is_reposted: post.is_reposted
    };
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
    
    let nativeShareSuccess = false;
    if (Capacitor.isNativePlatform()) {
      try {
        if (Share && typeof Share.share === 'function') {
          await Share.share({
            title: '市民タイムラインの投稿',
            text: `${post.author_username || '市民'}さんの投稿: "${post.content.substring(0, 100)}"`,
            url: shareUrl,
            dialogTitle: '投稿を共有する'
          });
          nativeShareSuccess = true;
        }
      } catch (err) {
        console.warn("Native Share plugin failed or not compiled into APK:", err);
      }
    }

    if (!nativeShareSuccess) {
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
            fallbackCopyToClipboard(shareUrl);
          }
        }
      } else {
        fallbackCopyToClipboard(shareUrl);
      }
    }
  };

  const fallbackCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("投稿のリンクをクリップボードにコピーしました！\n（※新しいアプリ版APKをインストールすると、OS標準の共有画面が使用可能になります）");
    } catch (err) {
      console.error("Clipboard copy failed:", err);
      alert("共有リンクのコピーに失敗しました。");
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
    if (!newCommentText.trim() && newCommentImages.length === 0 && !selectedCommentVideoFile) return;

    triggerHaptic('medium');
    setIsSubmittingComment(true);

    try {
      let videoPath: string | null = null;

      if (selectedCommentVideoFile) {
        setIsCompressingCommentVideo(true);
        try {
          const compressedBlob = await compressVideo(selectedCommentVideoFile);
          setIsCompressingCommentVideo(false);

          const uploadFormData = new FormData();
          uploadFormData.append('file', compressedBlob, selectedCommentVideoFile.name);

          const uploadRes = await fetch('/api/upload-media', {
            method: 'POST',
            body: uploadFormData
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json() as any;
            throw new Error(errData.error || "動画のアップロードに失敗しました。");
          }

          const uploadResult = await uploadRes.json() as { key: string };
          videoPath = uploadResult.key;
        } catch (compressErr: any) {
          setIsCompressingCommentVideo(false);
          setIsSubmittingComment(false);
          alert(compressErr.message || "動画の圧縮またはアップロードに失敗しました。");
          return;
        }
      }

      const res = await fetch('/api/timeline-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          userId: currentUser.id,
          content: newCommentText,
          parentId: replyingToComment?.id || null,
          image_data: newCommentImages.length > 0 ? JSON.stringify(newCommentImages) : null,
          video_path: videoPath
        })
      });

      if (res.ok) {
        setNewCommentText('');
        setReplyingToComment(null);
        setNewCommentImages([]);
        setSelectedCommentVideoFile(null);
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
        alert(err.error || "返信の投稿に失敗しました。");
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

  const renderImageGrid = (imagesJson: string | null, postId: string) => {
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
        <div style={{ marginTop: '12px', overflow: 'hidden', borderRadius: '16px', border: '1px solid var(--glass-border)', cursor: 'zoom-in' }} onClick={() => { setActiveZoomImage(urls[0]); incrementPostView(postId); }}>
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
            <div key={i} style={wrapperStyle} onClick={() => { setActiveZoomImage(url); incrementPostView(postId); }}>
              <img src={url} alt={`Attached ${i + 1}`} style={itemStyle} />
            </div>
          );
        })}
      </div>
    );
  };

  const activePost = (() => {
    if (!expandedPostId) return undefined;
    const direct = posts.find(p => p.id === expandedPostId);
    if (direct) return direct;
    
    const repost = posts.find(p => p.repost_id === expandedPostId);
    if (repost) return getTargetPost(repost);

    if (deepLinkedPost && deepLinkedPost.id === expandedPostId) return deepLinkedPost;
    
    return undefined;
  })();

  // Synced following/followers counts from D1 database
  const followingCount = profileInfo ? profileInfo.followingCount : 0;
  const followerCount = profileInfo ? profileInfo.followerCount : 0;

  return (
    <div 
      className="animate-fade" 
      style={{ 
        maxWidth: isMobile ? '640px' : '980px', 
        margin: '0 auto', 
        display: isMobile ? 'flex' : 'grid', 
        gridTemplateColumns: isMobile ? undefined : '1fr 300px', 
        flexDirection: isMobile ? 'column' : undefined,
        gap: '24px', 
        alignItems: 'flex-start',
        position: 'relative' 
      }}
    >
      {/* Main Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', minWidth: 0 }}>
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

      {/* Recommended vs Following Feed Tab Bar (X style) */}
      <div 
        className="glass"
        style={{
          display: 'flex',
          width: '100%',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--panel-bg)',
          borderRadius: '16px',
          overflow: 'hidden',
          padding: '2px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }}
      >
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setActiveFeedTab('all'); }}
          style={{
            flex: 1,
            background: activeFeedTab === 'all' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            border: 'none',
            padding: '14px 0',
            color: activeFeedTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={e => {
            if (activeFeedTab !== 'all') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-main)';
            }
          }}
          onMouseLeave={e => {
            if (activeFeedTab !== 'all') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <span>おすすめ</span>
          {activeFeedTab === 'all' && (
            <div 
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40px',
                height: '4px',
                background: 'var(--primary)',
                borderRadius: '2px 2px 0 0',
                boxShadow: '0 -2px 10px var(--primary-glow)'
              }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setActiveFeedTab('following'); }}
          style={{
            flex: 1,
            background: activeFeedTab === 'following' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            border: 'none',
            padding: '14px 0',
            color: activeFeedTab === 'following' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={e => {
            if (activeFeedTab !== 'following') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-main)';
            }
          }}
          onMouseLeave={e => {
            if (activeFeedTab !== 'following') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <span>フォロー中</span>
          {activeFeedTab === 'following' && (
            <div 
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40px',
                height: '4px',
                background: 'var(--primary)',
                borderRadius: '2px 2px 0 0',
                boxShadow: '0 -2px 10px var(--primary-glow)'
              }}
            />
          )}
        </button>
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); setActiveFeedTab('bookmarks'); }}
          style={{
            flex: 1,
            background: activeFeedTab === 'bookmarks' ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
            border: 'none',
            padding: '14px 0',
            color: activeFeedTab === 'bookmarks' ? 'var(--text-main)' : 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={e => {
            if (activeFeedTab !== 'bookmarks') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-main)';
            }
          }}
          onMouseLeave={e => {
            if (activeFeedTab !== 'bookmarks') {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }
          }}
        >
          <span>ブックマーク</span>
          {activeFeedTab === 'bookmarks' && (
            <div 
              style={{
                position: 'absolute',
                bottom: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40px',
                height: '4px',
                background: 'var(--primary)',
                borderRadius: '2px 2px 0 0',
                boxShadow: '0 -2px 10px var(--primary-glow)'
              }}
            />
          )}
        </button>
      </div>

      {/* Sleek Glassmorphic Search Bar with suggestions */}
      <div ref={searchContainerRef} style={{ position: 'relative', width: '100%', zIndex: 100 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="タイムライン内を検索（キーワード、Roblox名、市民名）..."
            style={{
              width: '100%',
              padding: '12px 16px 12px 46px',
              borderRadius: '14px',
              background: 'var(--panel-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-main)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
            }}
            onFocus={e => {
              setIsSearchFocused(true);
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,193,102,0.15), inset 0 2px 4px rgba(0,0,0,0.1)';
            }}
            onBlur={e => {
              e.currentTarget.style.borderColor = 'var(--glass-border)';
              e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.1)';
            }}
          />
          <Search 
            size={18} 
            style={{ 
              position: 'absolute', 
              left: '16px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: searchQuery ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'color 0.2s ease',
              pointerEvents: 'none'
            }} 
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setSearchQuery(''); }}
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Suggestion Dropdown List (X-style) */}
        {isSearchFocused && searchQuery.trim().length >= 1 && (
          <div
            className="glass"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '16px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              overflow: 'hidden',
              maxHeight: '380px',
              overflowY: 'auto',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            {/* 1. Keyword search suggestions */}
            {searchSuggestions.keywords.map((kw, i) => (
              <div
                key={`kw-${i}`}
                onClick={() => {
                  triggerHaptic('light');
                  setSearchQuery(kw);
                  setIsSearchFocused(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  transition: 'background 0.2s',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Search size={16} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{kw}</span>
              </div>
            ))}

            {/* Separator if both keywords and users match */}
            {searchSuggestions.keywords.length > 0 && searchSuggestions.users.length > 0 && (
              <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />
            )}

            {/* 2. User accounts suggestions (Citizens) */}
            {searchSuggestions.users.map((u) => (
              <div
                key={`u-${u.id}`}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedUserProfile({
                    userId: u.id,
                    username: u.username,
                    robloxUsername: u.roblox_username,
                    avatar: u.avatar
                  });
                  setIsSearchFocused(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <img
                  src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=00c166&color=fff`}
                  alt={u.username}
                  style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover', background: '#fff' }}
                  onError={e => handleAvatarError(e, u.username)}
                />
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.username}
                  </span>
                  {u.roblox_username && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      @{u.roblox_username}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: 'rgba(0,193,102,0.1)',
                  color: 'var(--primary)',
                  fontWeight: 700
                }}>
                  市民
                </div>
              </div>
            ))}

            {/* 3. Empty state */}
            {searchSuggestions.keywords.length === 0 && searchSuggestions.users.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                一致する候補が見つかりませんでした
              </div>
            )}
          </div>
        )}
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

            {/* Selected Video Preview Container */}
            {selectedVideoFile && videoPreviewUrl && (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', height: '240px', border: '1px solid var(--glass-border)', marginTop: '8px', background: '#000' }}>
                <video 
                  src={videoPreviewUrl} 
                  controls
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
                />
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  background: 'rgba(0,0,0,0.65)',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}>
                  動画: {(selectedVideoFile.size / (1024 * 1024)).toFixed(1)}MB
                </div>
                <button
                  type="button"
                  onClick={handleRemoveVideo}
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
            )}
          </div>
        </div>

        {showPollComposer && (
          <div 
            className="glass" 
            style={{ 
              marginTop: '12px', 
              padding: '16px', 
              borderRadius: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid var(--glass-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>アンケート</span>
              <button 
                type="button" 
                onClick={() => {
                  triggerHaptic('light');
                  setShowPollComposer(false);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >
                削除
              </button>
            </div>

            {pollOptions.map((opt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder={`選択肢 ${idx + 1}`}
                  value={opt}
                  onChange={(e) => {
                    const newOpts = [...pollOptions];
                    newOpts[idx] = e.target.value;
                    setPollOptions(newOpts);
                  }}
                  maxLength={25}
                  style={{
                    flex: 1,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--input-text)',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                />
                {pollOptions.length > 2 && (
                  <button 
                    type="button" 
                    onClick={() => {
                      triggerHaptic('light');
                      setPollOptions(pollOptions.filter((_, i) => i !== idx));
                    }}
                    style={{ background: 'none', border: 'none', color: '#ff5252', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}

            {pollOptions.length < 4 && (
              <button 
                type="button" 
                onClick={() => {
                  triggerHaptic('light');
                  setPollOptions([...pollOptions, '']);
                }}
                style={{ 
                  alignSelf: 'flex-start',
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--primary)', 
                  cursor: 'pointer', 
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '4px 0'
                }}
              >
                + 選択肢を追加
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>投票期間:</span>
              <select 
                value={pollDuration} 
                onChange={(e) => setPollDuration(Number(e.target.value))}
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: 'var(--input-text)',
                  fontSize: '0.8rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value={60}>1時間</option>
                <option value={360}>6時間</option>
                <option value={1440}>1日</option>
                <option value={4320}>3日</option>
                <option value={10080}>7日</option>
              </select>
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderBottom: '1px solid var(--glass-border)', margin: '4px 0' }} />

        {/* Creator Actions Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={newPostImages.length >= 4 || selectedVideoFile !== null || showPollComposer}
              style={{
                background: 'rgba(0,193,102,0.08)',
                border: '1px solid rgba(0,193,102,0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--primary)',
                cursor: (newPostImages.length >= 4 || selectedVideoFile !== null || showPollComposer) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: (newPostImages.length >= 4 || selectedVideoFile !== null || showPollComposer) ? 0.5 : 1
              }}
            >
              <ImageIcon size={18} />
              <span>
                {selectedVideoFile ? '動画添付済み' : `メディア (${newPostImages.length}/4)`}
              </span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect}
              multiple 
              accept="image/*,video/*" 
              style={{ display: 'none' }} 
            />

            <button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowPollComposer(!showPollComposer);
              }}
              disabled={newPostImages.length > 0 || selectedVideoFile !== null}
              style={{
                background: showPollComposer ? 'rgba(0,193,102,0.15)' : 'rgba(0,193,102,0.08)',
                border: '1px solid rgba(0,193,102,0.15)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--primary)',
                cursor: (newPostImages.length > 0 || selectedVideoFile !== null) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
                fontWeight: 600,
                opacity: (newPostImages.length > 0 || selectedVideoFile !== null) ? 0.5 : 1
              }}
            >
              <BarChart2 size={18} style={{ transform: 'rotate(90deg)' }} />
              <span>アンケート</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isCompressingVideo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600 }}>動画を720pに最適化中...</span>
              </div>
            )}

            {isSubmitting && !isCompressingVideo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>アップロード中...</span>
              </div>
            )}

            {/* Premium Character Progress Ring */}
            {charCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width={30} height={30} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                  <circle
                    cx={15}
                    cy={15}
                    r={11}
                    fill="transparent"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={2.5}
                  />
                  <circle
                    cx={15}
                    cy={15}
                    r={11}
                    fill="transparent"
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    strokeDasharray={2 * Math.PI * 11}
                    strokeDashoffset={2 * Math.PI * 11 - (percentage / 100) * 2 * Math.PI * 11}
                    style={{ transition: 'stroke-dashoffset 0.1s ease, stroke 0.1s ease' }}
                  />
                </svg>
                {charCount >= 240 && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: strokeColor }}>
                    {maxChars - charCount}
                  </span>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="btn btn-primary"
              style={{
                padding: '10px 20px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                opacity: isSubmitDisabled ? 0.6 : 1
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
      {(() => {
        const filteredPosts = posts.filter(post => {
          const query = searchQuery.toLowerCase().trim();
          if (!query) return true;
          
          const contentMatches = post.content.toLowerCase().includes(query);
          const authorMatches = post.author_username?.toLowerCase().includes(query) || false;
          const robloxMatches = post.author_roblox_username?.toLowerCase().includes(query) || false;
          
          const origContentMatches = post.repost_id && post.orig_content?.toLowerCase().includes(query);
          const origAuthorMatches = post.repost_id && (
            post.orig_author_username?.toLowerCase().includes(query) || 
            post.orig_author_roblox_username?.toLowerCase().includes(query)
          );
          
          return contentMatches || authorMatches || robloxMatches || origContentMatches || origAuthorMatches;
        });

        if (isLoading && posts.length === 0) {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '20px' }}>
              <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
                <Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)', opacity: 0.8 }} />
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>タイムラインを読み込み中...</span>
            </div>
          );
        }

        if (posts.length === 0) {
          return (
            <div className="glass card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
              <AlertCircle size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-main)' }}>まだ投稿がありません</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>最初のひとりごとを投稿してみませんか？</p>
              </div>
            </div>
          );
        }

        if (filteredPosts.length === 0 && searchQuery) {
          return (
            <div className="glass card" style={{ padding: '60px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
              <Search size={48} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              <div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-main)' }}>検索結果が見つかりませんでした</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>キーワードを変更してもう一度お試しください。</p>
              </div>
            </div>
          );
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredPosts.map((post) => {
              const isAuthor = post.user_id === currentUser.id;
              const isAdmin = currentUser.role === 'admin';
              
              const targetPost = post.repost_id ? getTargetPost(post) : post;
              const isLiked = targetPost.is_liked === 1;
              const isAnimating = likeAnimatingPostId === targetPost.id;
              const isReposted = targetPost.is_reposted === 1;

              return (
                <div 
                  key={post.id} 
                  id={`post-${post.id}`}
                  className="glass card" 
                  style={{ 
                    padding: '20px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    gap: '12px', 
                    background: 'var(--panel-bg)', 
                    border: '1px solid var(--glass-border)',
                    position: 'relative'
                  }}
                >
                  {/* Repost Header Label */}
                  {post.repost_id && (
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px', 
                      fontSize: '0.8rem', 
                      color: 'var(--primary)', 
                      fontWeight: 700, 
                      paddingBottom: '8px', 
                      borderBottom: '1px solid rgba(255,255,255,0.03)', 
                      marginBottom: '4px' 
                    }}>
                      <Repeat2 size={14} />
                      <span 
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedUserProfile({ userId: post.user_id, username: post.author_username || '不明な市民', robloxUsername: post.author_roblox_username, avatar: post.author_avatar });
                        }}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        {post.author_username || '不明な市民'}
                      </span>
                      <span>さんがリポストしました</span>
                    </div>
                  )}

                  {/* Main Post Grid */}
                  {post.repost_id && !post.orig_author_username ? (
                    <div style={{ 
                      padding: '16px', 
                      background: 'rgba(255,255,255,0.01)', 
                      borderRadius: '12px', 
                      border: '1px dashed var(--glass-border)', 
                      color: 'var(--text-muted)', 
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      この投稿は削除されました。
                      
                      {/* Repost can still be deleted */}
                      {(isAuthor || isAdmin) && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
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
                  ) : (
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
                      {/* Author Avatar */}
                      <img 
                        src={targetPost.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(targetPost.author_username || 'P')}&background=00c166&color=fff`} 
                        alt="Author Avatar" 
                        onError={(e) => handleAvatarError(e, targetPost.author_username || 'P')}
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedUserProfile({ userId: targetPost.user_id, username: targetPost.author_username || '不明な市民', robloxUsername: targetPost.author_roblox_username, avatar: targetPost.author_avatar });
                        }}
                        style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', transition: 'transform 0.2s' }} 
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                      />
                      {/* Post Content Area */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        
                        {/* User meta information row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                          <span 
                            onClick={() => {
                              triggerHaptic('light');
                              setSelectedUserProfile({ userId: targetPost.user_id, username: targetPost.author_username || '不明な市民', robloxUsername: targetPost.author_roblox_username, avatar: targetPost.author_avatar });
                            }}
                            style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', cursor: 'pointer', transition: 'color 0.2s' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-main)'}
                          >
                            {targetPost.author_username || '不明な市民'}
                          </span>
                          {targetPost.author_roblox_username && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              @{targetPost.author_roblox_username}
                            </span>
                          )}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatRelativeTime(targetPost.created_at)}
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
                          {highlightText(targetPost.content, searchQuery)}
                        </p>

                        {/* Render URL Link Preview if matching */}
                        {renderLinkPreview(targetPost.content)}

                        {/* Render Images if any attached */}
                        {renderImageGrid(targetPost.image_data, targetPost.id)}

                        {/* Render Video if attached */}
                        {targetPost.video_path && (
                          <div style={{ marginTop: '12px' }}>
                            <TimelineVideoPlayer 
                              src={`/api/media?key=${targetPost.video_path}`} 
                              onPlay={() => incrementPostView(targetPost.id)}
                              maxHeight="400px"
                              title={targetPost.content || '動画投稿'}
                              artist={targetPost.author_username || '不明な市民'}
                              artwork={targetPost.author_avatar || undefined}
                            />
                          </div>
                        )}

                        {(() => {
                          let pollOptionsList: { text: string }[] = [];
                          try {
                            if (targetPost.poll_options) {
                              pollOptionsList = JSON.parse(targetPost.poll_options);
                            }
                          } catch (e) {
                            console.error("Failed to parse poll options:", e);
                          }
                          if (pollOptionsList.length === 0) return null;

                          const isPollExpired = targetPost.poll_expires_at ? new Date(targetPost.poll_expires_at) < new Date() : false;
                          const hasVoted = targetPost.user_voted_option !== null && targetPost.user_voted_option !== undefined;
                          const pollVotes = [
                            targetPost.poll_option_0_votes || 0,
                            targetPost.poll_option_1_votes || 0,
                            targetPost.poll_option_2_votes || 0,
                            targetPost.poll_option_3_votes || 0
                          ];
                          const totalVotes = targetPost.poll_total_votes || 0;

                          return (
                            <div 
                              style={{ 
                                marginTop: '12px', 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: '8px', 
                                maxWidth: '480px' 
                              }}
                            >
                              {pollOptionsList.map((opt, idx) => {
                                const votes = pollVotes[idx] || 0;
                                const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                const maxVotes = Math.max(...pollOptionsList.map((_, i) => pollVotes[i] || 0));
                                const isWinner = isPollExpired && votes === maxVotes && maxVotes > 0;
                                const showResults = hasVoted || isPollExpired;
                                const isUserChoice = targetPost.user_voted_option === idx;

                                return (
                                  <div 
                                    key={idx}
                                    onClick={() => {
                                      if (showResults) return;
                                      handleVote(targetPost.id, idx);
                                    }}
                                    style={{
                                      position: 'relative',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      border: '1px solid var(--glass-border)',
                                      cursor: showResults ? 'default' : 'pointer',
                                      padding: '12px 16px',
                                      background: 'rgba(255, 255, 255, 0.02)',
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      transition: 'border-color 0.2s, background 0.2s'
                                    }}
                                    onMouseEnter={e => {
                                      if (!showResults) e.currentTarget.style.borderColor = 'var(--primary)';
                                    }}
                                    onMouseLeave={e => {
                                      if (!showResults) e.currentTarget.style.borderColor = 'var(--glass-border)';
                                    }}
                                  >
                                    {showResults && (
                                      <div 
                                        style={{
                                          position: 'absolute',
                                          left: 0,
                                          top: 0,
                                          bottom: 0,
                                          width: `${percent}%`,
                                          background: isUserChoice ? 'rgba(0, 193, 102, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                          zIndex: 0,
                                          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                                        }}
                                      />
                                    )}
                                    
                                    <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                      <span style={{ 
                                        fontWeight: isUserChoice || isWinner ? 700 : 500,
                                        color: isWinner ? 'var(--primary)' : 'var(--text-main)',
                                        fontSize: '0.9rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {opt.text}
                                      </span>
                                      {isUserChoice && (
                                        <span style={{
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          color: 'var(--primary)',
                                          background: 'rgba(0,193,102,0.1)',
                                          padding: '2px 6px',
                                          borderRadius: '4px'
                                        }}>
                                          投票済み
                                        </span>
                                      )}
                                    </div>

                                    {showResults && (
                                      <span style={{ 
                                        zIndex: 1, 
                                        fontWeight: isUserChoice || isWinner ? 700 : 500,
                                        color: isWinner ? 'var(--primary)' : 'var(--text-main)',
                                        fontSize: '0.9rem' 
                                      }}>
                                        {percent}%
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <span>{totalVotes.toLocaleString()} 票</span>
                                <span>•</span>
                                <span>{isPollExpired ? '最終結果' : '投票受付中'}</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Post Stats & Actions Bar */}
                        <div style={{ display: 'flex', gap: '32px', marginTop: '16px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                          {/* Like Action */}
                          <button
                            onClick={(e) => {
                              triggerParticleBurst(e.clientX, e.clientY, 'like');
                              handleLikeToggle(targetPost);
                            }}
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
                            <span>{targetPost.likes_count}</span>
                          </button>

                          {/* Comment Action */}
                          <button
                            onClick={() => handleCommentIconClick(targetPost.id)}
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
                            <span>{targetPost.comments_count}</span>
                          </button>

                          {/* Repost Action (New Repeat2) */}
                          <button
                            onClick={() => handleRepostToggle(post)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: isReposted ? 'var(--primary)' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => { 
                              if (!isReposted) e.currentTarget.style.color = 'var(--primary)';
                              const icon = e.currentTarget.querySelector('svg');
                              if (icon) icon.style.transform = isReposted ? 'rotate(200deg) scale(1.15)' : 'rotate(30deg) scale(1.15)';
                            }}
                            onMouseLeave={e => { 
                              if (!isReposted) e.currentTarget.style.color = 'var(--text-muted)';
                              const icon = e.currentTarget.querySelector('svg');
                              if (icon) icon.style.transform = isReposted ? 'rotate(180deg) scale(1)' : 'none';
                            }}
                          >
                            <Repeat2 
                              size={18} 
                              style={{
                                transform: isReposted ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                              }}
                            />
                            <span>{targetPost.reposts_count || 0}</span>
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
                            <span>{(targetPost.views_count || 0).toLocaleString()}</span>
                          </div>

                          {/* Share Action (Share2) */}
                          <button
                            onClick={() => handleSharePost(targetPost)}
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

                          {/* Bookmark Action */}
                          <button
                            onClick={() => handleBookmarkToggle(targetPost)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              color: targetPost.is_bookmarked === 1 ? 'var(--primary)' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'color 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              if (targetPost.is_bookmarked !== 1) e.currentTarget.style.color = 'var(--primary)';
                            }}
                            onMouseLeave={(e) => {
                              if (targetPost.is_bookmarked !== 1) e.currentTarget.style.color = 'var(--text-muted)';
                            }}
                          >
                            <Bookmark 
                              size={18} 
                              fill={targetPost.is_bookmarked === 1 ? 'var(--primary)' : 'none'}
                            />
                            <span>保存</span>
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
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
      </div>

      {/* Trends Sidebar (Visible on Desktop) */}
      {!isMobile && (
        <div 
          className="glass card" 
          style={{ 
            position: 'sticky',
            top: '88px',
            padding: '20px', 
            background: 'var(--panel-bg)', 
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            boxSizing: 'border-box'
          }}
        >
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            <span>今日のトレンド</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '4px' }}>
            {trends.length === 0 ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>トレンドはありません</span>
            ) : (
              trends.map((t, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    triggerHaptic('light');
                    setSearchQuery(t.tag);
                  }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    gap: '2px',
                    transition: 'opacity 0.2s',
                    padding: '4px 0'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.opacity = 0.8;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.opacity = 1;
                  }}
                >
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{idx + 1} • トレンド</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>{t.tag}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.count}件のポスト</span>
                </div>
              ))
            )}
          </div>
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
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedUserProfile({ userId: activePost.user_id, username: activePost.author_username || '不明な市民', robloxUsername: activePost.author_roblox_username, avatar: activePost.author_avatar });
                  }}
                  style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fff', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span 
                      onClick={() => {
                        triggerHaptic('light');
                        setSelectedUserProfile({ userId: activePost.user_id, username: activePost.author_username || '不明な市民', robloxUsername: activePost.author_roblox_username, avatar: activePost.author_avatar });
                      }}
                      style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)', cursor: 'pointer', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-main)'}
                    >
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
                  {renderImageGrid(activePost.image_data, activePost.id)}

                  {activePost.video_path && (
                    <div style={{ marginTop: '8px' }}>
                      <TimelineVideoPlayer 
                        src={`/api/media?key=${activePost.video_path}`} 
                        onPlay={() => incrementPostView(activePost.id)}
                        maxHeight="300px"
                        title={activePost.content || '動画投稿'}
                        artist={activePost.author_username || '不明な市民'}
                        artwork={activePost.author_avatar || undefined}
                      />
                    </div>
                  )}

                  {(() => {
                    let pollOptionsList: { text: string }[] = [];
                    try {
                      if (activePost.poll_options) {
                        pollOptionsList = JSON.parse(activePost.poll_options);
                      }
                    } catch (e) {
                      console.error("Failed to parse poll options:", e);
                    }
                    if (pollOptionsList.length === 0) return null;

                    const isPollExpired = activePost.poll_expires_at ? new Date(activePost.poll_expires_at) < new Date() : false;
                    const hasVoted = activePost.user_voted_option !== null && activePost.user_voted_option !== undefined;
                    const pollVotes = [
                      activePost.poll_option_0_votes || 0,
                      activePost.poll_option_1_votes || 0,
                      activePost.poll_option_2_votes || 0,
                      activePost.poll_option_3_votes || 0
                    ];
                    const totalVotes = activePost.poll_total_votes || 0;

                    return (
                      <div 
                        style={{ 
                          marginTop: '12px', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '8px'
                        }}
                      >
                        {pollOptionsList.map((opt, idx) => {
                          const votes = pollVotes[idx] || 0;
                          const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          const maxVotes = Math.max(...pollOptionsList.map((_, i) => pollVotes[i] || 0));
                          const isWinner = isPollExpired && votes === maxVotes && maxVotes > 0;
                          const showResults = hasVoted || isPollExpired;
                          const isUserChoice = activePost.user_voted_option === idx;

                          return (
                            <div 
                              key={idx}
                              onClick={() => {
                                if (showResults) return;
                                handleVote(activePost.id, idx);
                              }}
                              style={{
                                position: 'relative',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                border: '1px solid var(--glass-border)',
                                cursor: showResults ? 'default' : 'pointer',
                                padding: '12px 16px',
                                background: 'rgba(255, 255, 255, 0.02)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'border-color 0.2s, background 0.2s'
                              }}
                              onMouseEnter={e => {
                                    if (!showResults) e.currentTarget.style.borderColor = 'var(--primary)';
                              }}
                              onMouseLeave={e => {
                                    if (!showResults) e.currentTarget.style.borderColor = 'var(--glass-border)';
                              }}
                            >
                              {showResults && (
                                <div 
                                  style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: `${percent}%`,
                                    background: isUserChoice ? 'rgba(0, 193, 102, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                                    zIndex: 0,
                                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
                                  }}
                                />
                              )}
                              
                              <div style={{ zIndex: 1, display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                <span style={{ 
                                  fontWeight: isUserChoice || isWinner ? 700 : 500,
                                  color: isWinner ? 'var(--primary)' : 'var(--text-main)',
                                  fontSize: '0.88rem',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {opt.text}
                                </span>
                                {isUserChoice && (
                                  <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    color: 'var(--primary)',
                                    background: 'rgba(0,193,102,0.1)',
                                    padding: '1px 5px',
                                    borderRadius: '4px'
                                  }}>
                                    投票済み
                                  </span>
                                )}
                              </div>

                              {showResults && (
                                <span style={{ 
                                  zIndex: 1, 
                                  fontWeight: isUserChoice || isWinner ? 700 : 500,
                                  color: isWinner ? 'var(--primary)' : 'var(--text-main)',
                                  fontSize: '0.88rem' 
                                }}>
                                  {percent}%
                                </span>
                              )}
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          <span>{totalVotes.toLocaleString()} 票</span>
                          <span>•</span>
                          <span>{isPollExpired ? '最終結果' : '投票受付中'}</span>
                        </div>
                      </div>
                    );
                  })()}
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
                              onClick={() => {
                                triggerHaptic('light');
                                setSelectedUserProfile({ userId: comment.user_id, username: comment.author_username || '不明な市民', robloxUsername: comment.author_roblox_username, avatar: comment.author_avatar });
                              }}
                              style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', objectFit: 'cover', flexShrink: 0, cursor: 'pointer', transition: 'transform 0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                                <span 
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedUserProfile({ userId: comment.user_id, username: comment.author_username || '不明な市民', robloxUsername: comment.author_roblox_username, avatar: comment.author_avatar });
                                  }}
                                  style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', transition: 'color 0.2s' }}
                                  onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-main)'}
                                >
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

                              {/* Attached Images */}
                              {renderImageGrid(comment.image_data, activePost.id)}

                              {/* Attached Video */}
                              {comment.video_path && (
                                <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                                  <TimelineVideoPlayer 
                                    src={`/api/media?key=${comment.video_path}`} 
                                    onPlay={() => incrementPostView(activePost.id)}
                                    maxHeight="300px"
                                    title={comment.content || '返信動画'}
                                    artist={comment.author_username || '不明な市民'}
                                    artwork={comment.author_avatar || undefined}
                                  />
                                </div>
                              )}

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

                                {/* Views Count */}
                                <span style={{ 
                                  color: 'var(--text-muted)', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  fontSize: '0.75rem',
                                  fontWeight: 500
                                }}>
                                  <BarChart2 size={13} style={{ opacity: 0.8 }} />
                                  <span>{comment.views_count || 0}</span>
                                </span>

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

                                      {/* Attached Images */}
                                      {renderImageGrid(sub.image_data, activePost.id)}

                                      {/* Attached Video */}
                                      {sub.video_path && (
                                        <div style={{ marginTop: '6px', marginBottom: '6px' }}>
                                          <TimelineVideoPlayer 
                                            src={`/api/media?key=${sub.video_path}`} 
                                            onPlay={() => incrementPostView(activePost.id)}
                                            maxHeight="240px"
                                            title={sub.content || '返信動画'}
                                            artist={sub.author_username || '不明な市民'}
                                            artwork={sub.author_avatar || undefined}
                                          />
                                        </div>
                                      )}

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

                                        {/* Views Count */}
                                        <span style={{ 
                                          color: 'var(--text-muted)', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '3px', 
                                          fontSize: '0.7rem',
                                          fontWeight: 500
                                        }}>
                                          <BarChart2 size={11} style={{ opacity: 0.8 }} />
                                          <span>{sub.views_count || 0}</span>
                                        </span>

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

          {/* Selected Comment Images Preview Container */}
          {newCommentImages.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${newCommentImages.length === 1 ? 1 : 2}, 1fr)`, gap: '8px', marginTop: '4px' }}>
              {newCommentImages.map((img, i) => (
                <div key={i} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', height: newCommentImages.length === 1 ? '160px' : '80px', border: '1px solid var(--glass-border)' }}>
                  <img src={img} alt={`Comment Select ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    type="button"
                    onClick={() => handleRemoveCommentImage(i)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.65)',
                      border: 'none',
                      borderRadius: '50%',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected Comment Video Preview Container */}
          {selectedCommentVideoFile && commentVideoPreviewUrl && (
            <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', height: '160px', border: '1px solid var(--glass-border)', marginTop: '4px', background: '#000' }}>
              <video 
                src={commentVideoPreviewUrl} 
                controls
                playsInline 
                style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} 
              />
              <div style={{
                position: 'absolute',
                bottom: '8px',
                left: '8px',
                background: 'rgba(0,0,0,0.65)',
                padding: '4px 8px',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 600
              }}>
                動画: {(selectedCommentVideoFile.size / (1024 * 1024)).toFixed(1)}MB
              </div>
              <button
                type="button"
                onClick={handleRemoveCommentVideo}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.65)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Optimizing and uploading status */}
          {(isCompressingCommentVideo || (isSubmittingComment && !isCompressingCommentVideo)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 4px', marginTop: '2px' }}>
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
                {isCompressingCommentVideo ? '動画を最適化中...' : 'アップロード中...'}
              </span>
            </div>
          )}

          <form onSubmit={(e) => handleCreateComment(activePost.id, e)} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <img
              src={currentUser.avatar}
              alt="My Avatar"
              onError={(e) => handleAvatarError(e, currentUser.username)}
              style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', objectFit: 'cover', flexShrink: 0 }}
            />
            
            <button
              type="button"
              onClick={() => commentFileInputRef.current?.click()}
              disabled={newCommentImages.length >= 4 || selectedCommentVideoFile !== null || isSubmittingComment}
              style={{
                background: 'rgba(0,193,102,0.08)',
                border: '1px solid rgba(0,193,102,0.15)',
                borderRadius: '10px',
                width: '42px',
                height: '42px',
                color: 'var(--primary)',
                cursor: (newCommentImages.length >= 4 || selectedCommentVideoFile !== null || isSubmittingComment) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: (newCommentImages.length >= 4 || selectedCommentVideoFile !== null || isSubmittingComment) ? 0.5 : 1,
                flexShrink: 0
              }}
            >
              <ImageIcon size={18} />
            </button>
            
            <input 
              type="file" 
              ref={commentFileInputRef} 
              onChange={handleCommentFileSelect}
              multiple 
              accept="image/*,video/*" 
              style={{ display: 'none' }} 
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
              disabled={isSubmittingComment || (!newCommentText.trim() && newCommentImages.length === 0 && !selectedCommentVideoFile)}
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
                cursor: (!newCommentText.trim() && newCommentImages.length === 0 && !selectedCommentVideoFile) ? 'not-allowed' : 'pointer',
                opacity: (!newCommentText.trim() && newCommentImages.length === 0 && !selectedCommentVideoFile) ? 0.5 : 1,
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

      {/* User Profile Modal overlay */}
      {selectedUserProfile && createPortal(
        <div 
          onClick={() => setSelectedUserProfile(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
            backdropFilter: 'blur(16px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 9999, 
            padding: '16px'
          }}
          className="animate-fade"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="glass card"
            style={{ 
              width: '100%',
              maxWidth: '500px',
              borderRadius: '24px',
              background: 'var(--panel-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0
            }}
          >
            {/* Cover header gradient banner */}
            <div style={{
              height: '110px',
              background: theme === 'light' 
                ? 'linear-gradient(135deg, #00c166 0%, #00d2fc 100%)' 
                : 'linear-gradient(135deg, #0a2115 0%, #0d1520 100%)',
              position: 'relative'
            }}>
              {/* Close Button */}
              <button
                onClick={() => setSelectedUserProfile(null)}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'rgba(0,0,0,0.5)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer',
                  zIndex: 2,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.7)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.5)'}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profile info block */}
            <div style={{ 
              padding: '24px', 
              paddingTop: '0', 
              position: 'relative', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px',
              transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: profileFade ? 1 : 0,
              transform: profileFade ? 'translateY(0)' : 'translateY(8px)'
            }}>
              {/* Avatar offset */}
              <div style={{ position: 'relative', marginTop: '-45px', marginBottom: '8px', display: 'inline-block', width: '90px' }}>
                <img 
                  src={selectedUserProfile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUserProfile.username || 'P')}&background=00c166&color=fff`}
                  alt="Avatar"
                  onError={(e) => handleAvatarError(e, selectedUserProfile.username || 'P')}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '22px',
                    border: '4px solid var(--nav-bg)',
                    background: '#fff',
                    objectFit: 'cover',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
                  }}
                />
              </div>

              {/* User Names */}
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span>{selectedUserProfile.username || '不明な市民'}</span>
                  {profileInfo?.isFollower && selectedUserProfile.userId !== currentUser.id && (
                    <span style={{ 
                      fontSize: '0.7rem', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: '6px', 
                      background: theme === 'light' ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)', 
                      color: 'var(--text-muted)', 
                      border: '1px solid var(--glass-border)',
                      display: 'inline-block',
                      lineHeight: '1.4'
                    }}>
                      フォローされています
                    </span>
                  )}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {selectedUserProfile.robloxUsername && (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Roblox:</span>
                      <strong style={{ color: 'var(--primary)' }}>@{selectedUserProfile.robloxUsername}</strong>
                    </div>
                  )}
                  {/* Follow / Follower Counts */}
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                      onClick={() => { triggerHaptic('light'); fetchFollowList(selectedUserProfile.userId, 'following'); }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = ''}
                    >
                      <strong style={{ color: 'inherit', fontWeight: 800 }}>{followingCount}</strong> <span style={{ color: 'inherit' }}>フォロー</span>
                    </span>
                    <span 
                      style={{ cursor: 'pointer', transition: 'color 0.2s' }}
                      onClick={() => { triggerHaptic('light'); fetchFollowList(selectedUserProfile.userId, 'followers'); }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = ''}
                    >
                      <strong style={{ color: 'inherit', fontWeight: 800 }}>{followerCount}</strong> <span style={{ color: 'inherit' }}>フォロワー</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Role & Verification badge / Follow Action Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    padding: '5px 12px', 
                    borderRadius: '20px', 
                    background: profileVehicles.some(v => v.status === 'approved' || v.status === 'approved_warning')
                      ? 'rgba(0, 193, 102, 0.15)'
                      : 'rgba(255,255,255,0.05)',
                    color: profileVehicles.some(v => v.status === 'approved' || v.status === 'approved_warning')
                      ? 'var(--primary)'
                      : 'var(--text-muted)',
                    border: `1px solid ${
                      profileVehicles.some(v => v.status === 'approved' || v.status === 'approved_warning')
                        ? 'rgba(0, 193, 102, 0.2)'
                        : 'var(--glass-border)'
                    }`
                  }}>
                    {profileVehicles.some(v => v.status === 'approved' || v.status === 'approved_warning') ? '認可市民 (Official Citizen)' : '一般メンバー'}
                  </span>
                </div>

                {selectedUserProfile.userId !== currentUser.id && (
                  <button
                    onClick={async () => {
                      triggerHaptic('medium');
                      const nextState = !isFollowing;
                      setIsFollowing(nextState);
                      
                      // Optimistic count update
                      if (profileInfo) {
                        setProfileInfo(prev => prev ? {
                          ...prev,
                          isFollowing: nextState,
                          followerCount: Math.max(0, prev.followerCount + (nextState ? 1 : -1))
                        } : null);
                      }

                      try {
                        const res = await fetch('/api/profile', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            followerId: currentUser.id,
                            followingId: selectedUserProfile.userId,
                            action: nextState ? 'follow' : 'unfollow'
                          })
                        });
                        if (!res.ok) {
                          setIsFollowing(!nextState);
                          if (profileInfo) {
                            setProfileInfo(prev => prev ? {
                              ...prev,
                              isFollowing: !nextState,
                              followerCount: Math.max(0, prev.followerCount + (nextState ? -1 : 1))
                            } : null);
                          }
                        }
                      } catch (err) {
                        console.error("Follow toggling failed:", err);
                        setIsFollowing(!nextState);
                        if (profileInfo) {
                          setProfileInfo(prev => prev ? {
                            ...prev,
                            isFollowing: !nextState,
                            followerCount: Math.max(0, prev.followerCount + (nextState ? -1 : 1))
                          } : null);
                        }
                      }
                    }}
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      padding: '6px 14px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      ...(isFollowing ? {
                        background: 'var(--primary)',
                        color: theme === 'light' ? '#fff' : '#000',
                        border: '1px solid var(--primary)',
                      } : {
                        background: 'transparent',
                        color: 'var(--text-main)',
                        border: '1px solid var(--glass-border)',
                      })
                    }}
                  >
                    {isFollowing ? '✓ フォロー中' : '+ フォロー'}
                  </button>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />

              {/* Bio / 自己紹介 Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '4px', height: '14px', background: 'var(--primary)', borderRadius: '2px' }} />
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      自己紹介
                    </h4>
                  </div>
                  {selectedUserProfile.userId === currentUser.id && !isEditingBio && (
                    <button 
                      onClick={() => {
                        triggerHaptic('light');
                        setDraftBio(bioText || '');
                        setIsEditingBio(true);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      編集
                    </button>
                  )}
                </div>
                
                {isEditingBio ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={draftBio}
                        onChange={e => setDraftBio(e.target.value.substring(0, 100))}
                        placeholder="自己紹介を書いてみましょう（最大100文字）"
                        maxLength={100}
                        style={{
                          width: '100%',
                          minHeight: '80px',
                          padding: '12px 14px 28px 14px', 
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '16px',
                          border: '1px solid var(--primary)',
                          fontSize: '0.88rem',
                          color: 'var(--text-main)',
                          outline: 'none',
                          resize: 'none',
                          lineHeight: 1.4
                        }}
                        autoFocus
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '12px',
                        fontSize: '0.75rem',
                        color: draftBio.length >= 100 ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 600
                      }}>
                        {draftBio.length} / 100
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setIsEditingBio(false);
                        }}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '6px 14px',
                          borderRadius: '20px',
                          background: 'transparent',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--glass-border)',
                          cursor: 'pointer'
                        }}
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          triggerHaptic('medium');
                          const trimmed = draftBio.trim().substring(0, 100);
                          setBioText(trimmed);
                          setIsEditingBio(false);
                          
                          try {
                            await fetch('/api/profile', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                userId: currentUser.id,
                                bio: trimmed,
                                action: 'update_bio'
                              })
                            });
                            if (profileInfo) {
                              setProfileInfo(prev => prev ? { ...prev, bio: trimmed } : null);
                            }
                          } catch (err) {
                            console.error("Save bio failed:", err);
                          }
                        }}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '6px 14px',
                          borderRadius: '20px',
                          background: 'var(--primary)',
                          color: theme === 'light' ? '#fff' : '#000',
                          border: '1px solid var(--primary)',
                          cursor: 'pointer'
                        }}
                      >
                        保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ 
                    padding: '12px 14px', 
                    background: 'rgba(255,255,255,0.02)', 
                    borderRadius: '16px', 
                    border: '1px solid var(--glass-border)',
                    fontSize: '0.88rem',
                    color: bioText ? 'var(--text-main)' : 'var(--text-muted)',
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    minHeight: '44px'
                  }}>
                    {bioText || (selectedUserProfile.userId === currentUser.id 
                      ? '自己紹介を書いてみましょう。（「編集」から設定できます）' 
                      : 'この市民はまだ自己紹介を書いていません。')}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ height: '1px', background: 'var(--glass-border)', margin: '4px 0' }} />

              {/* Personal Posts Feed */}
              {(() => {
                const userPosts = posts.filter(p => p.user_id === selectedUserProfile.userId);
                return (
                  <>
                    {/* Personal Posts Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '4px', height: '14px', background: 'var(--primary)', borderRadius: '2px' }} />
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                        最近の投稿 ({userPosts.length})
                      </h4>
                    </div>

                    {/* Personal Posts Feed */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px', minHeight: '80px' }}>
                      {userPosts.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--glass-border)', borderRadius: '16px' }}>
                          投稿はまだありません。
                        </div>
                      ) : (
                        userPosts.map(p => {
                          const targetPost = p.repost_id ? getTargetPost(p) : p;
                          return (
                            <div 
                              key={p.id} 
                              onClick={() => {
                                triggerHaptic('light');
                                handleCommentIconClick(targetPost.id);
                                setSelectedUserProfile(null);
                              }}
                              style={{ 
                                padding: '12px 14px', 
                                background: 'rgba(255,255,255,0.015)', 
                                borderRadius: '16px', 
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                e.currentTarget.style.borderColor = 'var(--primary)';
                                e.currentTarget.style.transform = 'translateY(-1px)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
                                e.currentTarget.style.borderColor = 'var(--glass-border)';
                                e.currentTarget.style.transform = 'none';
                              }}
                            >
                              {p.repost_id && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700, marginBottom: '2px' }}>
                                  <Repeat2 size={11} />
                                  <span>{targetPost.author_username || '不明な市民'} さんの投稿をリポスト</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {formatRelativeTime(p.created_at)}
                                </span>
                              </div>
                              {p.repost_id && !targetPost.author_username ? (
                                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  この投稿は削除されました
                                </p>
                              ) : (
                                <>
                                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4 }}>
                                    {highlightText(targetPost.content, searchQuery)}
                                  </p>
                                  {targetPost.image_data && (
                                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', marginTop: '4px' }}>
                                      {parseImages(targetPost.image_data).map((url, index) => (
                                        <img 
                                          key={index} 
                                          src={url} 
                                          alt="attachment" 
                                          style={{ width: '40px', height: '40px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--glass-border)' }} 
                                        />
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Follow List Modal overlay */}
      {followListModal && createPortal(
        <div 
          onClick={() => setFollowListModal(null)}
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(10,12,16,0.6)', 
            backdropFilter: 'blur(10px)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10000, 
            padding: '16px'
          }}
          className="animate-fade"
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="glass card"
            style={{ 
              width: '100%',
              maxWidth: '400px',
              borderRadius: '20px',
              background: 'var(--panel-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              maxHeight: '80vh'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--glass-border)'
            }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                {followListModal.type === 'following' ? 'フォロー中' : 'フォロワー'}
              </h3>
              <button
                onClick={() => setFollowListModal(null)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              >
                <X size={16} />
              </button>
            </div>

            {/* List Body */}
            <div style={{ 
              padding: '12px 16px', 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              minHeight: '120px'
            }}>
              {loadingFollowList ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        background: 'rgba(255,255,255,0.005)',
                        border: '1px solid transparent'
                      }}
                    >
                      <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                        <div className="skeleton skeleton-text" style={{ width: '40%', height: '14px' }} />
                        <div className="skeleton skeleton-text" style={{ width: '25%', height: '10px' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : followListModal.list.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {followListModal.type === 'following' ? 'フォローしている市民はいません。' : 'フォロワーはいません。'}
                </div>
              ) : (
                followListModal.list.map(item => (
                  <div
                    key={item.id}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedUserProfile({
                        userId: item.id,
                        username: item.username,
                        robloxUsername: item.roblox_username,
                        avatar: item.avatar
                      });
                      setFollowListModal(null);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover-card"
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      e.currentTarget.style.borderColor = 'var(--glass-border)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <img
                      src={item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.username || 'P')}&background=00c166&color=fff`}
                      alt="Avatar"
                      onError={(e) => handleAvatarError(e, item.username || 'P')}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        background: '#fff'
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                        {item.username || '不明な市民'}
                      </div>
                      {item.roblox_username && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          @{item.roblox_username}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)', opacity: 0.6 }} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3D Particle Burst Overlay */}
      {clickParticles.map(p => (
        <span
          key={p.id}
          style={{
            position: 'fixed',
            left: p.x,
            top: p.y,
            pointerEvents: 'none',
            zIndex: 99999,
            fontSize: '18px',
            color: p.color,
            animation: 'burstFade 0.8s cubic-bezier(0.1, 0.8, 0.3, 1) forwards',
            '--tx': `${Math.cos(p.angle) * p.velocity}px`,
            '--ty': `${Math.sin(p.angle) * p.velocity - 60}px`
          } as React.CSSProperties}
        >
          {p.char}
        </span>
      ))}

      {/* Particle Burst Animations Style Sheet */}
      <style>{`
        @keyframes burstFade {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0, 0) scale(0.6);
            filter: drop-shadow(0 0 4px currentColor);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) scale(1.4);
            filter: drop-shadow(0 0 8px currentColor);
          }
        }
      `}</style>

    </div>
  );
};
