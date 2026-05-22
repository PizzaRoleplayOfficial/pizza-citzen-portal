import React from 'react';
import { User as UserIcon, Palette, Smartphone, Vibrate, Bell, Info } from 'lucide-react';
import { triggerHaptic, scheduleLocalNotification, isNative } from '../utils/native';
import { CURRENT_VERSION } from '../utils/updater';

interface ProfileViewProps {
  currentUser: any;
  setCurrentUser: (u: any) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
  onCheckUpdate: () => Promise<void>;
  isCheckingUpdate: boolean;
}

export const ProfileView = ({
  currentUser,
  setCurrentUser,
  theme,
  setTheme,
  handleUpdateProfile,
  onCheckUpdate,
  isCheckingUpdate
}: ProfileViewProps) => {
  return (
    <div className="animate-fade" style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontWeight: 700, color: 'var(--text-main)' }}>Profile Settings</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0px' }}>アカウント設定を管理します。</p>
      </div>

      <form onSubmit={handleUpdateProfile} className="glass card" style={{ padding: '40px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '32px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Roblox ユーザー名</label>
          <div style={{ position: 'relative' }}>
            <UserIcon size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" value={currentUser.roblox_username || ''} onChange={e => setCurrentUser({...currentUser, roblox_username: e.target.value})} style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--input-text)', fontSize: '1rem' }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>テーマ設定（見た目）</label>
          <div style={{ display: 'flex', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '16px', background: theme === 'dark' ? 'rgba(0,193,102,0.1)' : 'var(--input-bg)', border: `1px solid ${theme === 'dark' ? 'var(--primary)' : 'var(--glass-border)'}`, borderRadius: '12px', flex: 1, color: 'var(--text-main)' }}>
              <input type="radio" value="dark" checked={theme === 'dark'} onChange={() => setTheme('dark')} style={{ accentColor: 'var(--primary)' }} />
              <Palette size={18} /> ダークモード
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '16px', background: theme === 'light' ? 'rgba(0,193,102,0.1)' : 'var(--input-bg)', border: `1px solid ${theme === 'light' ? 'var(--primary)' : 'var(--glass-border)'}`, borderRadius: '12px', flex: 1, color: 'var(--text-main)' }}>
              <input type="radio" value="light" checked={theme === 'light'} onChange={() => setTheme('light')} style={{ accentColor: 'var(--primary)' }} />
              <Palette size={18} /> ライトモード
            </label>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '16px', borderRadius: '12px', fontSize: '1rem', justifyContent: 'center' }}>設定を保存</button>
      </form>

      {isNative ? (
        <>
          {/* App Information Section */}
          <div className="glass card" style={{ padding: '40px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
                <Info size={24} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>アプリ情報</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>現在のバージョン情報と手動更新の確認ができます。</p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>現在のバージョン</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>v{CURRENT_VERSION}</div>
              </div>
              <button
                type="button"
                onClick={onCheckUpdate}
                disabled={isCheckingUpdate}
                className="btn btn-primary"
                style={{ padding: '12px 20px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {isCheckingUpdate ? '確認中...' : '最新バージョンをチェック'}
              </button>
            </div>
          </div>

          {/* Device Features Test (Beta) Section */}
          <div className="glass card" style={{ padding: '40px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
                <Smartphone size={24} style={{ color: 'var(--primary)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>デバイス機能テスト (Beta)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Capacitorネイティブプラグインの動作検証用テストツールです。</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Haptics Column */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Vibrate size={18} style={{ color: 'var(--primary)' }} /> 触覚フィードバック (Haptics)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                  <button
                    onClick={() => triggerHaptic('light')}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    軽めのコツン (Light)
                  </button>
                  <button
                    onClick={() => triggerHaptic('heavy')}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    強めの衝撃 (Heavy)
                  </button>
                  <button
                    onClick={() => triggerHaptic('success')}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)', cursor: 'pointer', color: '#10b981' }}
                  >
                    成功 (Success)
                  </button>
                  <button
                    onClick={() => triggerHaptic('error')}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.05)', cursor: 'pointer', color: '#ef4444' }}
                  >
                    エラー (Error)
                  </button>
                </div>
              </div>

              {/* Local Notifications Column */}
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Bell size={18} style={{ color: 'var(--primary)' }} /> ローカル通知 (Notifications)
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                  <button
                    onClick={() => scheduleLocalNotification('テスト通知', 'これは即時テスト通知です。ぴっざぁ市民ポータルより。')}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    今すぐ通知をテスト
                  </button>
                  <button
                    onClick={() => scheduleLocalNotification('テスト通知 (ディレイ)', '3秒前に予約された通知です！', 3000)}
                    className="btn glass"
                    style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    3秒後に通知をテスト
                  </button>
                </div>
                
                <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>バックグラウンド通知のシミュレーター (3秒後)</h5>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                  ※ボタンを押したあと、すぐにスマホのホーム画面に戻り（またはスリープにし）、3秒後にバックグラウンドで通知が届くか確認できます。
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button
                    onClick={() => scheduleLocalNotification('車両登録申請の結果', '車両「2024年式 トヨタ プリウス」（ナンバー: WIS-1234）の申請が承認されました。', 3000)}
                    className="btn glass"
                    style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(0,193,102,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    🚗 車両「承認」通知をシミュレート
                  </button>
                  <button
                    onClick={() => scheduleLocalNotification('市民申請の結果', '市民登録申請が却下されました。理由: 写真のナンバープレート文字が不鮮明です。', 3000)}
                    className="btn glass"
                    style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(239,68,68,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    🪪 市民申請「却下」通知をシミュレート
                  </button>
                  <button
                    onClick={() => scheduleLocalNotification('新規の車両登録申請', '新規の登録申請が届きました: Keabu_Robloxさんの「日産 スカイライン」', 3000)}
                    className="btn glass"
                    style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                  >
                    👑 運営向け「新規申請」通知をシミュレート
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* App Download Banner ONLY in Web Browser */
        <div className="glass card" style={{ padding: '40px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0, 193, 102, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
              <Smartphone size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>公式 Android アプリ版</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>実機アプリ版をインストールすると、ポータルの全機能が有効になります。</p>
            </div>
          </div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            🚀 <strong>アプリ版限定のプレミアム機能:</strong><br />
            • 審査結果（車両・市民）の<strong>リアルタイムローカルプッシュ通知</strong><br />
            • アプリが起動していない間もバックグラウンドで状態変化を自動検知<br />
            • 新アイコン・ステータスバー連動による極上のネイティブデザイン体験<br />
            • 新機能リリース時の<strong>シームレス自動アップデート</strong>（アプリ内完結）
          </div>
          <a
            href="https://github.com/PizzaRoleplayOfficial/pizza-citzen-portal/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '16px', borderRadius: '12px', fontSize: '1rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', fontWeight: 'bold' }}
          >
            🤖 アプリ版 (APK) をダウンロード
          </a>
        </div>
      )}
    </div>
  );
};


