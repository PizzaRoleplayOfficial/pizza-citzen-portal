import React from 'react';
import { LayoutDashboard, ShieldCheck, Search as SearchIcon, Compass, Key, RefreshCw } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { startAuthentication } from '@simplewebauthn/browser';

interface LandingViewProps {
  onLoginSuccess?: (user: any) => void;
}

export const LandingView = ({ onLoginSuccess }: LandingViewProps) => {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const mouseRef = React.useRef({ x: 0, y: 0, active: false });
  const [scrollY, setScrollY] = React.useState(0);
  const [passkeyLoading, setPasskeyLoading] = React.useState(false);
  const [passkeyError, setPasskeyError] = React.useState<string | null>(null);
  const [isWebAuthnSupported, setIsWebAuthnSupported] = React.useState(true);

  React.useEffect(() => {
    setIsWebAuthnSupported(typeof window.PublicKeyCredential !== 'undefined');
  }, []);

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setPasskeyError(null);
    try {
      const optionsRes = await fetch('/api/auth/webauthn/login-options');
      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(err.error || 'ログインオプションの取得に失敗しました');
      }
      const options = await optionsRes.json();

      const assertion = await startAuthentication({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/webauthn/login-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion)
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || '認証に失敗しました。パスキーが正しく登録されているか確認してください。');
      }

      const verifyData = await verifyRes.json();
      
      if (onLoginSuccess && verifyData.user) {
        onLoginSuccess(verifyData.user);
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'NotAllowedError' || err.name === 'AbortError') {
        return;
      }
      setPasskeyError(err.message || 'パスキーによるログイン中にエラーが発生しました');
    } finally {
      setPasskeyLoading(false);
    }
  };

  React.useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const canvasOpacity = Math.max(0, 1 - scrollY / 600);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const colors = [
      'rgba(255, 255, 255, ', // 白
      'rgba(0, 193, 102, ',   // 緑
      'rgba(0, 210, 252, ',   // 水色
      'rgba(255, 215, 0, ',   // 金
    ];

    // Particle class definition
    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      baseAlpha: number;
      alpha: number;
      colorBase: string;
      twinkleSpeed: number;
      twinklePhase: number;
      depth: number;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;
        this.radius = Math.random() * 2.0 + 0.6;
        this.baseAlpha = Math.random() * 0.4 + 0.3;
        this.alpha = this.baseAlpha;
        this.colorBase = colors[Math.floor(Math.random() * colors.length)];
        this.twinkleSpeed = 0.001 + Math.random() * 0.003;
        this.twinklePhase = Math.random() * Math.PI * 2;
        this.depth = Math.random() * 0.5 + 0.1;
      }

      update(time: number) {
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around borders
        if (this.x < 0) this.x += width;
        if (this.x > width) this.x -= width;
        if (this.y < 0) this.y += height;
        if (this.y > height) this.y -= height;

        // Twinkle effect using sine wave
        this.alpha = Math.max(0.1, Math.min(0.9, this.baseAlpha + Math.sin(time * this.twinkleSpeed + this.twinklePhase) * 0.25));
      }

      draw(mouseX: number, mouseY: number, sY: number) {
        if (!ctx) return;

        // Parallax offset
        const offsetX = mouseX * this.depth;
        const offsetY = (mouseY + sY) * this.depth;
        
        let drawX = (this.x - offsetX) % width;
        let drawY = (this.y - offsetY) % height;
        if (drawX < 0) drawX += width;
        if (drawY < 0) drawY += height;

        ctx.beginPath();
        ctx.arc(drawX, drawY, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${this.colorBase}${this.alpha})`;
        ctx.fill();

        // Glow style for gold/white stars
        if (this.colorBase.includes('255, 215, 0') || this.colorBase.includes('255, 255, 255')) {
          ctx.shadowBlur = 4;
          ctx.shadowColor = this.colorBase.includes('215') ? '#ffd700' : '#ffffff';
        } else {
          ctx.shadowBlur = 0;
        }
      }
    }

    const particles: Particle[] = Array.from({ length: 45 }, () => new Particle());
    const startTime = performance.now();

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      const currentTime = performance.now() - startTime;

      const maxDistance = 100;
      
      // Precompute screen positions including scroll & mouse offset
      const coords = particles.map(p => {
        const offsetX = mouseRef.current.x * p.depth;
        const offsetY = (mouseRef.current.y + window.scrollY) * p.depth;
        let px = (p.x - offsetX) % width;
        let py = (p.y - offsetY) % height;
        if (px < 0) px += width;
        if (py < 0) py += height;
        return { px, py };
      });

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        p1.update(currentTime);
        p1.draw(mouseRef.current.x, mouseRef.current.y, window.scrollY);

        const { px: px1, py: py1 } = coords[i];

        // Connect with mouse
        if (mouseRef.current.active) {
          const dx = px1 - mouseRef.current.x;
          const dy = py1 - mouseRef.current.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
            ctx.strokeStyle = `rgba(0, 193, 102, ${(1 - dist / 120) * 0.15})`;
            ctx.lineWidth = 0.5;
            ctx.shadowBlur = 0;
            ctx.stroke();
          }
        }

        // Connect with other particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const { px: px2, py: py2 } = coords[j];
          const dx = px1 - px2;
          const dy = py1 - py2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            ctx.beginPath();
            ctx.moveTo(px1, py1);
            ctx.lineTo(px2, py2);
            ctx.strokeStyle = p1.colorBase + `${(1 - dist / maxDistance) * 0.08})`;
            ctx.lineWidth = 0.4;
            ctx.shadowBlur = 0;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div 
      onMouseMove={(e) => {
        mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
      }}
      onMouseLeave={() => {
        mouseRef.current.active = false;
      }}
      onTouchMove={(e) => {
        if (e.touches[0]) {
          mouseRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: true };
        }
      }}
      onTouchEnd={() => {
        mouseRef.current.active = false;
      }}
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 24px',
        background: 'radial-gradient(circle at 50% 25%, #0d1e15 0%, #05070a 100%)',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 宇宙の深淵インタラクティブパーティクルキャンバス */}
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'absolute', 
          inset: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none', 
          zIndex: 0,
          opacity: canvasOpacity
        }} 
      />

      {/* プレミアムネオン装飾背景 */}
      <div style={{ position: 'absolute', width: '350px', height: '350px', background: 'rgba(0, 193, 102, 0.08)', filter: 'blur(100px)', top: '10%', left: 'calc(50% - 175px)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: '450px', height: '450px', background: 'rgba(0, 160, 204, 0.04)', filter: 'blur(120px)', top: '35%', left: 'calc(50% - 225px)', borderRadius: '50%', pointerEvents: 'none' }} />

      <div className="animate-fade" style={{ textAlign: 'center', maxWidth: '850px', width: '100%', zIndex: 1 }}>
        
        {/* 高級ロゴバッジ */}
        <div style={{ display: 'inline-block', marginBottom: '32px', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            inset: '-12px',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            borderRadius: '50%',
            filter: 'blur(18px)',
            opacity: 0.45,
            zIndex: -1
          }} />
          <img 
            src="/pizza.webp" 
            alt="ぴっざぁポータル ロゴ" 
            style={{ 
              width: '128px', 
              height: '128px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              border: '4px solid var(--primary)',
              boxShadow: '0 8px 32px rgba(0, 193, 102, 0.35)'
            }} 
          />
        </div>

        {/* プレミアムグラデーションタイトル */}
        <h1 style={{ 
          fontSize: '3.5rem', 
          marginBottom: '24px', 
          lineHeight: 1.15, 
          fontWeight: 850, 
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #ffffff 40%, #a8ffd5 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          ぴっざぁポータル
        </h1>

        <p style={{ color: 'var(--text-muted)', marginBottom: '48px', lineHeight: 1.8, fontSize: '1.15rem', maxWidth: '580px', margin: '0 auto 48px' }}>
          市民のための次世代デジタルポータル。<br/>
          車両登録、マイガレージの管理、運営審査までを<br/>
          極めてスマートで直感的なインターフェースで統合。
        </p>
        
        {/* Discord ログインボタン（プレミアムネオングラデーション） */}
        <div style={{ marginBottom: '16px' }}>
          <button 
            onClick={async () => {
              if (Capacitor.isNativePlatform()) {
                await Browser.open({ url: 'https://pizza-citzen-portal.pages.dev/api/auth/login?source=app' });
              } else {
                window.location.href = '/api/auth/login';
              }
            }} 
            className="btn" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center',
              justifyContent: 'center', 
              width: '100%', 
              maxWidth: '320px', 
              padding: '18px 32px', 
              fontSize: '1.1rem', 
              borderRadius: '16px', 
              textDecoration: 'none', 
              color: '#000', 
              fontWeight: 800, 
              border: 'none', 
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #00c166 0%, #00d2fc 100%)',
              boxShadow: '0 6px 24px rgba(0, 193, 102, 0.35), inset 0 2px 4px rgba(255,255,255,0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
          >
            <Compass size={20} style={{ marginRight: '10px' }} /> Discordでログイン
          </button>
        </div>

        {/* パスキー ログインボタン */}
        {isWebAuthnSupported && (
          <div style={{ marginBottom: '24px' }}>
            <button 
              onClick={handlePasskeyLogin} 
              disabled={passkeyLoading}
              className="btn" 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center',
                justifyContent: 'center', 
                width: '100%', 
                maxWidth: '320px', 
                padding: '18px 32px', 
                fontSize: '1.1rem', 
                borderRadius: '16px', 
                textDecoration: 'none', 
                color: '#fff', 
                fontWeight: 800, 
                border: '1px solid rgba(0, 193, 102, 0.4)', 
                cursor: 'pointer',
                background: 'rgba(0, 193, 102, 0.1)',
                boxShadow: '0 4px 15px rgba(0, 193, 102, 0.15)',
                transition: 'all 0.2s',
              }}
            >
              {passkeyLoading ? (
                <RefreshCw size={20} className="animate-spin" style={{ marginRight: '10px' }} />
              ) : (
                <Key size={20} style={{ marginRight: '10px' }} />
              )}
              {passkeyLoading ? '照合中...' : 'パスキーでログイン'}
            </button>
          </div>
        )}

        {/* パスキーエラーメッセージ */}
        {passkeyError && (
          <div style={{
            maxWidth: '320px',
            margin: '0 auto 24px',
            padding: '10px 16px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ff8585'
          }}>
            {passkeyError}
          </div>
        )}

        {/* Discordサーバーへの招待リンク */}
        <div style={{ marginBottom: '64px' }}>
          <a 
            href="https://discord.gg/RruM8Gqc4m" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              color: '#fff',
              background: 'rgba(88, 101, 242, 0.15)',
              border: '1px solid rgba(88, 101, 242, 0.3)',
              padding: '12px 24px',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 700,
              textDecoration: 'none',
              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              boxShadow: '0 8px 24px rgba(88, 101, 242, 0.2)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(88, 101, 242, 0.35)';
              e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.5)';
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.03)';
              e.currentTarget.style.boxShadow = '0 12px 30px rgba(88, 101, 242, 0.4)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(88, 101, 242, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(88, 101, 242, 0.3)';
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(88, 101, 242, 0.2)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="#5865F2" style={{ display: 'inline-block', verticalAlign: 'middle', filter: 'drop-shadow(0 0 4px rgba(88, 101, 242, 0.6))' }}>
              <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.8.71,1.64,1.41,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.22,123.6,27.31,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
            </svg>
            <span>ぴっざぁ公式Discordサーバーに参加</span>
          </a>
        </div>

        {/* プレミアムフィーチャーグリッド */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px', textAlign: 'left' }}>
          <div className="glass card" style={{ padding: '32px', borderRadius: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(0,193,102,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <LayoutDashboard size={28} color="var(--primary)" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 193, 102, 0.4))' }} />
            </div>
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>スマートガレージ</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>所有車両を一覧で一括管理。リアルタイムでステータス（承認/却下）をキャッチ。</p>
          </div>
          
          <div className="glass card" style={{ padding: '32px', borderRadius: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(0,160,204,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <ShieldCheck size={28} color="var(--secondary)" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 160, 204, 0.4))' }} />
            </div>
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>デジタル証明書</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>ナンバープレートOCR自動解析を搭載。ゲーム内の警察検問や車両登録もペーパーレスに。</p>
          </div>

          <div className="glass card" style={{ padding: '32px', borderRadius: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }}>
            <div style={{ width: '48px', height: '48px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <SearchIcon size={28} color="var(--text-main)" />
            </div>
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)' }}>運営向けの高度ツール</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>ナンバー検索、申請のワンタップ承認/却下、Wiki自動同期カタログ管理など満載。</p>
          </div>
        </div>
      </div>
    </div>
  );
};
