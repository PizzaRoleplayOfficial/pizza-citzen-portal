import React from 'react';
import { User as UserIcon, Palette, Smartphone, Vibrate, Bell, Info, Key, Trash2, RefreshCw, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerHaptic, scheduleLocalNotification, isNative, getLiveProgress } from '../utils/native';
import { CURRENT_VERSION, getLiveUpdate } from '../utils/updater';
import { startRegistration } from '@simplewebauthn/browser';

interface ProfileViewProps {
  currentUser: any;
  setCurrentUser: (u: any) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
  onCheckUpdate: () => Promise<void>;
  isCheckingUpdate: boolean;
  appVersion: string;
  autoCheckUpdates: boolean;
  onToggleAutoCheck: (enabled: boolean) => void;
  pushSettings: { 
    resultsEnabled: boolean; 
    adminEnabled: boolean; 
    adminEditEnabled: boolean;
    timelineLikeEnabled: boolean;
    timelineCommentEnabled: boolean;
    timelineNewPostEnabled: boolean;
  };
  onTogglePushSetting: (
    key: 'resultsEnabled' | 'adminEnabled' | 'adminEditEnabled' | 'timelineLikeEnabled' | 'timelineCommentEnabled' | 'timelineNewPostEnabled', 
    enabled: boolean
  ) => void;
  enterKeyBehavior: 'enter' | 'shiftEnter';
  setEnterKeyBehavior: (val: 'enter' | 'shiftEnter') => void;
  liteMode: boolean;
  onToggleLiteMode: (enabled: boolean) => void;
  dataSaverEnabled: boolean;
  onToggleDataSaver: (enabled: boolean) => void;
}

export const ProfileView = ({
  currentUser,
  setCurrentUser,
  theme,
  setTheme,
  handleUpdateProfile,
  onCheckUpdate,
  isCheckingUpdate,
  appVersion,
  autoCheckUpdates,
  onToggleAutoCheck,
  pushSettings,
  onTogglePushSetting,
  enterKeyBehavior,
  setEnterKeyBehavior,
  liteMode,
  onToggleLiteMode,
  dataSaverEnabled,
  onToggleDataSaver
}: ProfileViewProps) => {
  const [passkeyLoading, setPasskeyLoading] = React.useState(false);
  const [desktopAutostart, setDesktopAutostart] = React.useState(false);
  const [desktopCloseToTray, setDesktopCloseToTray] = React.useState(true);

  React.useEffect(() => {
    if (window.electronAPI?.getSettings) {
      window.electronAPI.getSettings().then(settings => {
        if (settings) {
          setDesktopAutostart(!!settings.openAtLogin);
          setDesktopCloseToTray(settings.closeToTray !== false);
        }
      });
    }
  }, []);

  const handleToggleDesktopSetting = async (key: string, val: boolean) => {
    triggerHaptic('light');
    if (key === 'openAtLogin') setDesktopAutostart(val);
    if (key === 'closeToTray') setDesktopCloseToTray(val);
    if (window.electronAPI?.setSetting) {
      await window.electronAPI.setSetting(key, val);
    }
  };
  const [passkeyMessage, setPasskeyMessage] = React.useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [passkeys, setPasskeys] = React.useState<{ credential_id: string, key_name: string | null, created_at: string }[]>([]);
  const [devices, setDevices] = React.useState<any[]>([]);
  const [devicesLoading, setDevicesLoading] = React.useState(false);
  const [showAdvancedPushSettings, setShowAdvancedPushSettings] = React.useState(false);
  const [mobilePushTimeout, setMobilePushTimeout] = React.useState<number>(() => {
    const cached = typeof localStorage !== 'undefined' ? localStorage.getItem('gvvr_mobile_push_timeout') : null;
    return cached !== null ? Number(cached) : 5;
  });

  const handleMobilePushTimeoutChange = async (val: number) => {
    setMobilePushTimeout(val);
    localStorage.setItem('gvvr_mobile_push_timeout', String(val));
    triggerHaptic('light');
    if (!currentUser?.id) return;
    try {
      await fetch('/api/push-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          mobilePushTimeoutMinutes: val
        })
      });
    } catch (e) {
      console.error('Failed to save mobile push timeout:', e);
    }
  };
  const currentDeviceId = typeof localStorage !== 'undefined' ? localStorage.getItem('gvvr_device_id') : null;

  const fetchDevices = async () => {
    if (!currentUser?.id) return;
    try {
      setDevicesLoading(true);
      const res = await fetch(`/api/push-token?userId=${encodeURIComponent(currentUser.id)}`);
      if (res.ok) {
        const data = await res.json();
        setDevices(data.devices || []);
        if (data.mobilePushTimeoutMinutes !== undefined) {
          setMobilePushTimeout(Number(data.mobilePushTimeoutMinutes));
          localStorage.setItem('gvvr_mobile_push_timeout', String(data.mobilePushTimeoutMinutes));
        }
      }
    } catch (e) {
      console.error('Failed to fetch push devices:', e);
    } finally {
      setDevicesLoading(false);
    }
  };

  React.useEffect(() => {
    if (currentUser?.id) {
      fetchDevices();
    }
  }, [currentUser?.id]);

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('このデバイスのプッシュ通知登録を解除しますか？')) return;
    try {
      triggerHaptic('light');
      const res = await fetch('/api/push-token', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          deviceId
        })
      });
      if (res.ok) {
        fetchDevices();
      }
    } catch (e) {
      console.error('Failed to delete device:', e);
    }
  };
  const [isWebAuthnSupported, setIsWebAuthnSupported] = React.useState(true);

  const fetchPasskeys = async () => {
    try {
      const res = await fetch('/api/auth/webauthn/keys');
      if (res.ok) {
        const data = await res.json();
        setPasskeys(data);
      }
    } catch (e) {
      console.error('Failed to fetch passkeys:', e);
    }
  };

  React.useEffect(() => {
    setIsWebAuthnSupported(typeof window.PublicKeyCredential !== 'undefined');
    fetchPasskeys();
  }, []);

  const handleDeletePasskey = async (credentialId: string) => {
    if (!confirm('このパスキーを削除してもよろしいですか？\n削除すると、このパスキーを使用したログインはできなくなります。')) return;
    
    setPasskeyLoading(true);
    setPasskeyMessage(null);
    triggerHaptic('light');
    try {
      const res = await fetch(`/api/auth/webauthn/keys?id=${encodeURIComponent(credentialId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'パスキーの削除に失敗しました');
      }
      setPasskeyMessage({ type: 'success', text: 'パスキーを削除しました。' });
      triggerHaptic('success');
      await fetchPasskeys();
      
      if (currentUser) {
        const remaining = passkeys.filter(k => k.credential_id !== credentialId).length > 0;
        setCurrentUser({ ...currentUser, hasPasskey: remaining });
      }
    } catch (e: any) {
      console.error(e);
      setPasskeyMessage({ type: 'error', text: e.message || 'パスキーの削除中にエラーが発生しました' });
      triggerHaptic('warning');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRenamePasskey = async (credentialId: string, currentName: string) => {
    const newName = prompt('パスキーの新しい名前を入力してください:', currentName || 'パスキー');
    if (!newName || newName.trim() === '' || newName === currentName) return;
    
    setPasskeyLoading(true);
    setPasskeyMessage(null);
    triggerHaptic('light');
    try {
      const res = await fetch('/api/auth/webauthn/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: credentialId, name: newName.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'パスキー名の変更に失敗しました');
      }
      setPasskeyMessage({ type: 'success', text: 'パスキー名を変更しました。' });
      triggerHaptic('success');
      await fetchPasskeys();
    } catch (e: any) {
      console.error(e);
      setPasskeyMessage({ type: 'error', text: e.message || 'パスキー名の変更中にエラーが発生しました' });
      triggerHaptic('warning');
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRegisterPasskey = async () => {
    const keyNameInput = prompt('新しいパスキーの名前を入力してください (例: 自分のiPhone, 自宅のPC):', '');
    if (keyNameInput === null) return;
    const keyName = keyNameInput.trim() || 'パスキー';

    setPasskeyLoading(true);
    setPasskeyMessage(null);
    triggerHaptic('light');
    try {
      const optionsRes = await fetch('/api/auth/webauthn/register-options');
      if (!optionsRes.ok) {
        const err = await optionsRes.json().catch(() => ({}));
        throw new Error(err.error || '登録オプションの取得に失敗しました');
      }
      const options = await optionsRes.json();

      const credential = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch('/api/auth/webauthn/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential, keyName })
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err.error || 'パスキー検証に失敗しました');
      }

      setPasskeyMessage({ type: 'success', text: 'パスキーが正常に登録されました。次回からパスキーでログインできます。' });
      triggerHaptic('success');
      await fetchPasskeys();
      if (currentUser) {
        setCurrentUser({ ...currentUser, hasPasskey: true });
      }
    } catch (err: any) {
      console.error(err);
      setPasskeyMessage({ type: 'error', text: err.message || 'パスキーの登録中にエラーが発生しました' });
      triggerHaptic('warning');
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="animate-fade" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontWeight: 700, color: 'var(--text-main)' }}>設定</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '0px' }}>アカウント設定を管理します。</p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
        gap: '24px',
        alignItems: 'start',
        width: '100%'
      }}>
        <form onSubmit={handleUpdateProfile} className="glass card settings-card">
        <div>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '16px', color: 'var(--text-muted)' }}>Roblox ユーザー名</label>
          <div style={{ position: 'relative' }}>
            <UserIcon size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" value={currentUser.roblox_username || ''} onChange={e => setCurrentUser({...currentUser, roblox_username: e.target.value})} style={{ width: '100%', padding: '16px 16px 16px 48px', borderRadius: '12px', background: 'var(--input-bg)', border: '1px solid var(--glass-border)', color: 'var(--input-text)', fontSize: '1rem' }} />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '16px', color: 'var(--text-muted)' }}>テーマ設定（見た目）</label>
          <div className="theme-selector-container">
            <label className={`theme-selector-item ${theme === 'dark' ? 'active' : ''}`}>
              <input type="radio" value="dark" checked={theme === 'dark'} onChange={() => setTheme('dark')} style={{ accentColor: 'var(--primary)' }} />
              <Palette size={18} /> ダークモード
            </label>
            <label className={`theme-selector-item ${theme === 'light' ? 'active' : ''}`}>
              <input type="radio" value="light" checked={theme === 'light'} onChange={() => setTheme('light')} style={{ accentColor: 'var(--primary)' }} />
              <Palette size={18} /> ライトモード
            </label>
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '12px', fontSize: '16px', color: 'var(--text-muted)' }}>タイムラインの送信キー（キーボード操作時）</label>
          <div className="theme-selector-container">
            <label className={`theme-selector-item ${enterKeyBehavior === 'enter' ? 'active' : ''}`}>
              <input 
                type="radio" 
                value="enter" 
                checked={enterKeyBehavior === 'enter'} 
                onChange={() => { triggerHaptic('light'); setEnterKeyBehavior('enter'); }} 
                style={{ accentColor: 'var(--primary)' }} 
              />
              Enterで送信
            </label>
            <label className={`theme-selector-item ${enterKeyBehavior === 'shiftEnter' ? 'active' : ''}`}>
              <input 
                type="radio" 
                value="shiftEnter" 
                checked={enterKeyBehavior === 'shiftEnter'} 
                onChange={() => { triggerHaptic('light'); setEnterKeyBehavior('shiftEnter'); }} 
                style={{ accentColor: 'var(--primary)' }} 
              />
              Shift+Enterで送信
            </label>
          </div>
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '16px', borderRadius: '12px', fontSize: '1rem', justifyContent: 'center' }}>設定を保存</button>
      </form>

      {/* Windows Desktop Discord-style App Settings Card */}
      {window.electronAPI?.isDesktop && (
        <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.15)', borderRadius: '12px' }}>
              <Monitor size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>Windows デスクトップ設定</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Discordスタイルの常駐・システムトレイ・自動起動の動作を設定します。</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Setting 1: Autostart */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>Windows 起動時に自動起動</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>PC起動時に自動で立ち上がり、タスクトレイにサイレント常駐します。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={desktopAutostart} 
                  onChange={(e) => handleToggleDesktopSetting('openAtLogin', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: desktopAutostart ? 'var(--primary)' : '#444',
                  transition: '.4s', borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute', height: '20px', width: '20px',
                    left: desktopAutostart ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: desktopAutostart ? '#000' : '#fff',
                    transition: '.4s', borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>

            {/* Setting 2: Close to Tray */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>閉じるボタン（×）でトレイへ最小化</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>ウィンドウを閉じてもアプリを終了せず、タスクトレイで省電力待機します。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={desktopCloseToTray} 
                  onChange={(e) => handleToggleDesktopSetting('closeToTray', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: desktopCloseToTray ? 'var(--primary)' : '#444',
                  transition: '.4s', borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute', height: '20px', width: '20px',
                    left: desktopCloseToTray ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: desktopCloseToTray ? '#000' : '#fff',
                    transition: '.4s', borderRadius: '50%'
                  }} />
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Section (v2.0.2) - Only visible in native app version */}
      {isNative && (
        <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
              <Bell size={24} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>通知設定</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>受け取るリアルタイムプッシュ通知の種類を設定できます。</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>申請結果の通知</div>
                <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>市民権や車両登録申請の審査結果をプッシュ通知で受け取ります。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={pushSettings.resultsEnabled} 
                  onChange={(e) => onTogglePushSetting('resultsEnabled', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: pushSettings.resultsEnabled ? 'var(--primary)' : '#444',
                  transition: '0.3s',
                  borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: pushSettings.resultsEnabled ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: pushSettings.resultsEnabled ? '#000' : '#fff',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }} />
                </span>
              </label>
            </div>

            {currentUser?.role === 'admin' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>新規申請の管理者向け通知</div>
                    <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>他の市民から新しい申請が提出された際にプッシュ通知を受け取ります。</div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={pushSettings.adminEnabled} 
                      onChange={(e) => onTogglePushSetting('adminEnabled', e.target.checked)} 
                      style={{ opacity: 0, width: 0, height: 0 }} 
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      inset: 0,
                      backgroundColor: pushSettings.adminEnabled ? 'var(--primary)' : '#444',
                      transition: '0.3s',
                      borderRadius: '34px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '20px',
                        width: '20px',
                        left: pushSettings.adminEnabled ? '26px' : '4px',
                        bottom: '4px',
                        backgroundColor: pushSettings.adminEnabled ? '#000' : '#fff',
                        transition: '0.3s',
                        borderRadius: '50%',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                      }} />
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>登録編集申請の管理者向け通知</div>
                    <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>他の市民から車両登録情報の編集申請が提出された際にプッシュ通知を受け取ります。</div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={pushSettings.adminEditEnabled} 
                      onChange={(e) => onTogglePushSetting('adminEditEnabled', e.target.checked)} 
                      style={{ opacity: 0, width: 0, height: 0 }} 
                    />
                    <span style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      inset: 0,
                      backgroundColor: pushSettings.adminEditEnabled ? 'var(--primary)' : '#444',
                      transition: '0.3s',
                      borderRadius: '34px'
                    }}>
                      <span style={{
                        position: 'absolute',
                        content: '""',
                        height: '20px',
                        width: '20px',
                        left: pushSettings.adminEditEnabled ? '26px' : '4px',
                        bottom: '4px',
                        backgroundColor: pushSettings.adminEditEnabled ? '#000' : '#fff',
                        transition: '0.3s',
                        borderRadius: '50%',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                      }} />
                    </span>
                  </label>
                </div>
              </>
            )}

            <hr style={{ border: 'none', borderBottom: '1px solid var(--glass-border)', margin: '16px 0' }} />
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '8px' }}>市民タイムライン通知</div>

            {/* Timeline Like Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>「いいね」通知</div>
                <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>自分の投稿にいいねされた際に通知を受け取ります。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={pushSettings.timelineLikeEnabled} 
                  onChange={(e) => onTogglePushSetting('timelineLikeEnabled', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: pushSettings.timelineLikeEnabled ? 'var(--primary)' : '#444',
                  transition: '0.3s',
                  borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: pushSettings.timelineLikeEnabled ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: pushSettings.timelineLikeEnabled ? '#000' : '#fff',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }} />
                </span>
              </label>
            </div>

            {/* Timeline Comment Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>「コメント（返信）」通知</div>
                <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>自分の投稿に返信があった際に通知を受け取ります。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={pushSettings.timelineCommentEnabled} 
                  onChange={(e) => onTogglePushSetting('timelineCommentEnabled', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: pushSettings.timelineCommentEnabled ? 'var(--primary)' : '#444',
                  transition: '0.3s',
                  borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: pushSettings.timelineCommentEnabled ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: pushSettings.timelineCommentEnabled ? '#000' : '#fff',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }} />
                </span>
              </label>
            </div>

            {/* Timeline New Post Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>「新着投稿」通知</div>
                <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>他の市民が新しくタイムラインへ投稿した際に通知を受け取ります。</div>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
                <input 
                  type="checkbox" 
                  checked={pushSettings.timelineNewPostEnabled} 
                  onChange={(e) => onTogglePushSetting('timelineNewPostEnabled', e.target.checked)} 
                  style={{ opacity: 0, width: 0, height: 0 }} 
                />
                <span style={{
                  position: 'absolute',
                  cursor: 'pointer',
                  inset: 0,
                  backgroundColor: pushSettings.timelineNewPostEnabled ? 'var(--primary)' : '#444',
                  transition: '0.3s',
                  borderRadius: '34px'
                }}>
                  <span style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: pushSettings.timelineNewPostEnabled ? '26px' : '4px',
                    bottom: '4px',
                    backgroundColor: pushSettings.timelineNewPostEnabled ? '#000' : '#fff',
                    transition: '0.3s',
                    borderRadius: '50%',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }} />
                </span>
              </label>
            </div>

            {/* 登録中の通知デバイス一覧 */}
            {/* Discord-style Advanced Notification Settings */}
            <div style={{ marginTop: '12px', borderTop: '1px solid var(--glass-border)', paddingTop: '14px' }}>
              <button
                type="button"
                onClick={() => setShowAdvancedPushSettings(!showAdvancedPushSettings)}
                style={{
                  background: 'none',
                  border: 'none',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 2px',
                  cursor: 'pointer',
                  color: 'var(--text-main)',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600 }}>
                  {showAdvancedPushSettings ? '詳細通知設定を非表示' : '詳細通知設定を表示'}
                </span>
                {showAdvancedPushSettings ? (
                  <ChevronUp size={20} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <ChevronDown size={20} style={{ color: 'var(--text-muted)' }} />
                )}
              </button>

              {showAdvancedPushSettings && (
                <div style={{
                  marginTop: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                  borderRadius: '12px',
                  border: '1px solid var(--glass-border)',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: '1 1 280px' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>モバイル通知の一時的な停止</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                      パソコンでご利用中はモバイルデバイスにプッシュ通知が送信されません。この設定では、デスクトップが休止状態になってからモバイル通知が再開されるまでの時間を選択できます。
                    </div>
                  </div>

                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    <select
                      value={mobilePushTimeout}
                      onChange={(e) => handleMobilePushTimeoutChange(Number(e.target.value))}
                      style={{
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        backgroundColor: theme === 'light' ? '#f8fafc' : '#14171f',
                        color: 'var(--text-main)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '10px 36px 10px 16px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        outline: 'none',
                        minWidth: '110px'
                      }}
                    >
                      <option value={1}>1分</option>
                      <option value={2}>2分</option>
                      <option value={5}>5分</option>
                      <option value={10}>10分</option>
                      <option value={0}>なし（常にスマホにも送信）</option>
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: '16px', borderTop: '1px solid var(--glass-border)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>登録中の通知デバイス ({devices.length})</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>同じアカウントで複数のAndroid端末から個別に区別して同時に通知を受け取れます。</div>
                </div>
                <button
                  type="button"
                  onClick={fetchDevices}
                  disabled={devicesLoading}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '8px',
                    color: 'var(--primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: '0.2s'
                  }}
                  title="デバイス一覧を再取得"
                >
                  <RefreshCw size={13} className={devicesLoading ? 'spin' : ''} /> 更新
                </button>
              </div>

              {devices.length === 0 ? (
                <div style={{ padding: '12px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                  登録されているデバイスはありません（アプリ起動時に自動登録されます）
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {devices.map((dev) => {
                    const isCurrent = currentDeviceId && dev.device_id === currentDeviceId;
                    return (
                      <div
                        key={dev.device_id || dev.token_preview}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)',
                          borderRadius: '10px',
                          border: isCurrent ? '1px solid rgba(0,193,102,0.35)' : '1px solid var(--glass-border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(0,193,102,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Smartphone size={18} style={{ color: 'var(--primary)' }} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{dev.device_name || (dev.platform === 'android' ? 'Android端末' : '端末')}</span>
                              {isCurrent && (
                                <span style={{ fontSize: '0.72rem', padding: '2px 8px', background: 'rgba(0,193,102,0.15)', color: 'var(--primary)', borderRadius: '6px', fontWeight: 700 }}>
                                  この端末
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                              プラットフォーム: {dev.platform?.toUpperCase()} • 最終同期: {new Date(dev.updated_at).toLocaleString('ja-JP')}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDevice(dev.device_id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '8px',
                            transition: '0.2s'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ff6b6b'; e.currentTarget.style.background = 'rgba(255,107,107,0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                          title="この端末の登録を解除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Passkey Settings Section */}
      <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
            <Key size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>パスキー設定</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>指紋・顔認証や画面ロックによる安全なログインを設定します。</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isWebAuthnSupported ? (
            <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#ff8585', fontSize: '0.9rem', lineHeight: 1.5 }}>
              ⚠️ <strong>このアプリ内ブラウザ（または端末環境）はパスキーをサポートしていません。</strong><br />
              パスキーの新規登録や管理を行う場合は、お手数ですが Chrome、Safari、Edge などの標準ブラウザで本サイト（<a href="https://pizza-citzen-portal.pages.dev" target="_blank" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>https://pizza-citzen-portal.pages.dev</a>）にアクセスし、ログインした上でプロフィール画面から操作してください。
            </div>
          ) : (
            <>
              {passkeys.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)' }}>登録済みのパスキー ({passkeys.length})</div>
                  {passkeys.map(k => (
                    <div key={k.credential_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{k.key_name || '登録済みのキー'}</span>
                          <button
                            type="button"
                            onClick={() => handleRenamePasskey(k.credential_id, k.key_name || '')}
                            style={{ background: 'rgba(0, 193, 102, 0.1)', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                          >
                            名前変更
                          </button>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                          登録日時: {new Date(k.created_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePasskey(k.credential_id)}
                        disabled={passkeyLoading}
                        style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--error)', padding: '8px 16px', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', background: 'rgba(255,255,255,0.01)', borderRadius: '12px', border: '1px dashed var(--glass-border)' }}>
                  パスキーが登録されていません。登録すると、次回からDiscordのログインなしで素早くサインインできます。
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={passkeyLoading}
                  className="btn btn-primary"
                  style={{ padding: '16px 24px', borderRadius: '12px', fontSize: '0.95rem', cursor: 'pointer', width: '100%', justifyContent: 'center' }}
                >
                  {passkeyLoading ? '処理中...' : (passkeys.length > 0 ? '＋ 別のパスキーを追加' : 'パスキーを登録する')}
                </button>
              </div>
            </>
          )}

          {passkeyMessage && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              fontSize: '0.9rem',
              border: '1px solid',
              borderColor: passkeyMessage.type === 'success' ? 'rgba(0,193,102,0.3)' : 'rgba(239,68,68,0.3)',
              background: passkeyMessage.type === 'success' ? 'rgba(0,193,102,0.1)' : 'rgba(239,68,68,0.1)',
              color: passkeyMessage.type === 'success' ? 'var(--success)' : 'var(--error)'
            }}>
              {passkeyMessage.text}
            </div>
          )}
        </div>
      </div>

      {/* App Information Section */}
      <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'rgba(0,193,102,0.15)', borderRadius: '12px' }}>
            <Info size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>アプリ情報</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>現在のバージョン情報の確認ができます。</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>現在のバージョン</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '4px' }}>v{appVersion}</div>
          </div>
          {isNative && (
            <button
              type="button"
              onClick={onCheckUpdate}
              disabled={isCheckingUpdate}
              className="btn btn-primary"
              style={{ padding: '12px 20px', borderRadius: '10px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {isCheckingUpdate ? '確認中...' : '最新バージョンをチェック'}
            </button>
          )}
        </div>

        {isNative && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>起動時に自動更新をチェック</div>
              <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>アプリの起動時に自動で最新版を確認します。</div>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
              <input 
                type="checkbox" 
                checked={autoCheckUpdates} 
                onChange={(e) => onToggleAutoCheck(e.target.checked)} 
                style={{ opacity: 0, width: 0, height: 0 }} 
              />
              <span style={{
                position: 'absolute',
                cursor: 'pointer',
                inset: 0,
                backgroundColor: autoCheckUpdates ? 'var(--primary)' : '#444',
                transition: '0.3s',
                borderRadius: '34px'
              }}>
                <span style={{
                  position: 'absolute',
                  content: '""',
                  height: '20px',
                  width: '20px',
                  left: autoCheckUpdates ? '26px' : '4px',
                  bottom: '4px',
                  backgroundColor: autoCheckUpdates ? '#000' : '#fff',
                  transition: '0.3s',
                  borderRadius: '50%',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                }} />
              </span>
            </label>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>軽量モード (パフォーマンス優先)</div>
            <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>ガラスのブラー効果 (blur) やアニメーションを無効にし、低スペック端末の動作速度を向上させます。</div>
          </div>
          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
            <input 
              type="checkbox" 
              checked={liteMode} 
              onChange={(e) => onToggleLiteMode(e.target.checked)} 
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              inset: 0,
              backgroundColor: liteMode ? 'var(--primary)' : '#444',
              transition: '0.3s',
              borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '20px',
                width: '20px',
                left: liteMode ? '26px' : '4px',
                bottom: '4px',
                backgroundColor: liteMode ? '#000' : '#fff',
                transition: '0.3s',
                borderRadius: '50%',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
              }} />
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: theme === 'light' ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>データセーバー (低速回線向け)</div>
            <div style={{ fontSize: '16px', color: 'var(--text-muted)', marginTop: '4px' }}>タイムライン等の画像を低解像度でプレースホルダー表示し、タップするまで高画質画像のロードを抑制します。</div>
          </div>
          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', minWidth: '50px', height: '28px', cursor: 'pointer', flexShrink: 0 }}>
            <input 
              type="checkbox" 
              checked={dataSaverEnabled} 
              onChange={(e) => onToggleDataSaver(e.target.checked)} 
              style={{ opacity: 0, width: 0, height: 0 }} 
            />
            <span style={{
              position: 'absolute',
              cursor: 'pointer',
              inset: 0,
              backgroundColor: dataSaverEnabled ? 'var(--primary)' : '#444',
              transition: '0.3s',
              borderRadius: '34px'
            }}>
              <span style={{
                position: 'absolute',
                content: '""',
                height: '20px',
                width: '20px',
                left: dataSaverEnabled ? '26px' : '4px',
                bottom: '4px',
                backgroundColor: dataSaverEnabled ? '#000' : '#fff',
                transition: '0.3s',
                borderRadius: '50%',
                boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
              }} />
            </span>
          </label>
        </div>
      </div>

      {/* Device Features Test (Beta) Section */}
      {isNative && currentUser?.role === 'admin' && (
        <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
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
                  onClick={() => scheduleLocalNotification('テスト通知', 'これは即時テスト通知です。ぴっざぁ市民ポータルより。', 0, 'application_results_channel')}
                  className="btn glass"
                  style={{ padding: '12px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', gap: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  今すぐ通知をテスト
                </button>
                <button
                  onClick={() => scheduleLocalNotification('テスト通知 (ディレイ)', '3秒前に予約された通知です！', 3000, 'application_results_channel')}
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
                  onClick={() => scheduleLocalNotification('車両登録申請の結果', '車両「2024年式 トヨタ プリウス」（ナンバー: WIS-1234）の申請が承認されました。', 3000, 'application_results_channel')}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(0,193,102,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  🚗 車両「承認」通知をシミュレート
                </button>
                <button
                  onClick={() => scheduleLocalNotification('市民申請の結果', '市民登録申請が却下されました。理由: 写真のナンバープレート文字が不鮮明です。', 3000, 'application_results_channel')}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(239,68,68,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  🪪 市民申請「却下」通知をシミュレート
                </button>
                <button
                  onClick={() => scheduleLocalNotification('新規の車両登録申請', '新規の登録申請が届きました: Keabu_Robloxさんの「日産 スカイライン」', 3000, 'admin_notifications_channel')}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  👑 運営向け「新規申請」通知をシミュレート
                </button>
              </div>

              <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '20px', marginBottom: '8px' }}>Android 16 ライブアップデート通知のテスト</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                ※Android 16+で追加された ProgressStyle 通知のテスト表示です。タップするとダミーのダウンロード進捗（0%〜100%）がステータスバーや通知エリアに表示されます。
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    triggerHaptic('medium');
                    const liveUpdate = getLiveUpdate();
                    await liveUpdate.startDownload({ url: 'test' });
                  } catch (e: any) {
                    console.error('Failed to start LiveUpdate test:', e);
                    alert('テスト起動に失敗しました: ' + (e.message || e));
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'center', width: '100%', cursor: 'pointer', gap: '8px', fontWeight: 'bold', marginBottom: '20px' }}
              >
                ⚡ Live Update 通知（テスト）を起動
              </button>

              <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '20px', marginBottom: '8px' }}>Android 16 市民申請トラッカー（シミュレータ）</h5>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: 1.4 }}>
                ※市民申請の審査ステータス変化を、セグメントとマイルストーンでリアルタイム表示するシミュレータです。
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      triggerHaptic('light');
                      const segments = JSON.stringify([
                        { weight: 30, color: "#3B82F6" }, // Blue
                        { weight: 35, color: "#EAB308" }, // Yellow
                        { weight: 35, color: "#10B981" }  // Green
                      ]);
                      const points = JSON.stringify([
                        { position: 30, color: "#3B82F6" },
                        { position: 65, color: "#EAB308" }
                      ]);
                      await getLiveProgress().start({
                        title: '市民申請の審査状況',
                        text: '市民申請を受け付けました。自動採点中...',
                        progress: 30,
                        segments,
                        points
                      });
                    } catch (e: any) {
                      console.error('Failed simulator step 1:', e);
                      alert('シミュレータ起動に失敗しました: ' + (e.message || e));
                    }
                  }}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(59,130,246,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  📄 [シミュレータ] 1. 申請提出 (30%)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      triggerHaptic('medium');
                      const segments = JSON.stringify([
                        { weight: 30, color: "#3B82F6" },
                        { weight: 35, color: "#EAB308" },
                        { weight: 35, color: "#10B981" }
                      ]);
                      const points = JSON.stringify([
                        { position: 30, color: "#3B82F6" },
                        { position: 65, color: "#EAB308" }
                      ]);
                      await getLiveProgress().update({
                        title: '市民申請の審査状況',
                        text: '自動採点完了 (18/20問)。管理者の最終審査待ち...',
                        progress: 65,
                        segments,
                        points
                      });
                    } catch (e: any) {
                      console.error('Failed simulator step 2:', e);
                      alert('シミュレータ更新に失敗しました: ' + (e.message || e));
                    }
                  }}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(234,179,8,0.03)', cursor: 'pointer', color: 'var(--text-main)' }}
                >
                  📊 [シミュレータ] 2. 自動採点完了 (65%)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      triggerHaptic('success');
                      await getLiveProgress().stop({ title: '市民申請の審査状況' });
                    } catch (e: any) {
                      console.error('Failed simulator stop:', e);
                      alert('シミュレータ停止に失敗しました: ' + (e.message || e));
                    }
                  }}
                  className="btn glass"
                  style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', justifyContent: 'flex-start', border: '1px solid var(--glass-border)', background: 'rgba(239,68,68,0.03)', cursor: 'pointer', color: '#ef4444' }}
                >
                  🛑 トラッカー通知を停止
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* App Download Banner ONLY in Web Browser */}
      {!isNative && (
        <div className="glass card settings-card" style={{ borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0, 193, 102, 0.05)' }}>
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
    </div>
  );
};


