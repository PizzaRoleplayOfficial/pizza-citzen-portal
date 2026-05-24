import React from 'react';
import { LayoutDashboard, ShieldCheck, Search as SearchIcon, Compass } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const LandingView = () => {
  return (
    <div style={{
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
    }}>
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
        <div style={{ marginBottom: '88px' }}>
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
