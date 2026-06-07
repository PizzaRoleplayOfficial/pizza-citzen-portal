import React from 'react';
import { CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';

interface ApplicationFormViewProps {
  myApplication: any;
  isLoading: boolean;
  questions: any[];
  currentUser: any;
  applyAnswers: Record<string, string | string[]>;
  applySubmitting: boolean;
  setApplyAnswers: React.Dispatch<React.SetStateAction<Record<string, string | string[]>>>;
  handleSubmitApplication: (e: React.FormEvent) => void;
  handleManualRefresh: () => void;
  setView: (view: any) => void;
  isMobile: boolean;
}

export const ApplicationFormView = ({
  myApplication,
  isLoading,
  questions,
  currentUser,
  applyAnswers,
  applySubmitting,
  setApplyAnswers,
  handleSubmitApplication,
  handleManualRefresh,
  setView,
  isMobile
}: ApplicationFormViewProps) => {
  return (
    <div className="animate-fade">
      <div className="view-header" style={{ marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '2.4rem', marginBottom: '8px', fontWeight: 700, color: 'var(--text-main)' }}>市民申請</h2>
          <p style={{ color: 'var(--text-muted)' }}>申請が承認されると車両登録が可能になります。</p>
        </div>
        <button className="btn btn-secondary" onClick={handleManualRefresh} style={{ padding: '10px 16px' }} disabled={isLoading}>
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {myApplication?.status === 'approved' && (
        <div className="glass settings-card" style={{ borderRadius: '20px', textAlign: 'center', border: '1px solid var(--success)', background: 'rgba(0, 255, 0, 0.05)' }}>
          <CheckCircle2 size={64} style={{ color: 'var(--success)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px', color: 'var(--success)' }}>申請が承認されました！</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>マイガレージから車両を登録できます。</p>
          <button className="btn btn-primary" onClick={() => setView('garage')} style={{ padding: '14px 32px' }}>マイガレージへ →</button>
        </div>
      )}

      {myApplication?.status === 'pending' && (
        <div className="glass settings-card" style={{ borderRadius: '20px', textAlign: 'center' }}>
          <Clock size={64} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>審査中です</h3>
          <p style={{ color: 'var(--text-muted)' }}>運営が確認中です。しばらくお待ちください。</p>
        </div>
      )}

      {myApplication?.status === 'rejected' && (
        <div className="glass settings-card" style={{ borderRadius: '20px', marginBottom: '32px', border: '1px solid var(--error)', background: 'rgba(255,50,50,0.05)' }}>
          <XCircle size={48} style={{ color: 'var(--error)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: 'var(--error)' }}>申請が却下されました</h3>
          {myApplication.reject_reason && <p style={{ color: 'var(--text-muted)', marginBottom: '8px' }}>理由: {myApplication.reject_reason}</p>}
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>下記のフォームで再申請できます。</p>
        </div>
      )}

      {(!myApplication || myApplication.status === 'rejected') && (
        questions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>問題が設定されていません。管理者にお問い合わせください。</div>
        ) : (
          <form onSubmit={handleSubmitApplication}>
            <div className="glass" style={{ padding: '32px', borderRadius: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '8px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Roblox ユーザー名</label>
                  <input className="glass" value={currentUser.roblox_username || ''} readOnly style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discord ユーザー名</label>
                  <input className="glass" value={currentUser.username} readOnly style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                </div>
              </div>
              {!currentUser.roblox_username && <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '8px' }}>⚠️ <a onClick={() => setView('profile')} style={{ cursor: 'pointer', textDecoration: 'underline' }}>プロフィールでRobloxユーザー名を先に設定してください。</a></p>}
            </div>

            {questions.map((q: any) => (
              <div key={q.id} className="glass" style={{ padding: '28px', borderRadius: '16px', marginBottom: '16px' }}>
                <p style={{ fontWeight: 600, marginBottom: '16px', lineHeight: 1.6 }}><span style={{ color: 'var(--primary)' }}>【問{q.sort_order}】</span> {q.question}</p>
                {q.type === 'radio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(JSON.parse(q.choices || '[]') as string[]).map((c: string) => (
                      <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 14px', borderRadius: '10px', background: applyAnswers[q.id] === c ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${applyAnswers[q.id] === c ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, transition: '0.2s' }}>
                        <input type="radio" name={q.id} value={c} checked={applyAnswers[q.id] === c} onChange={() => setApplyAnswers(p => ({ ...p, [q.id]: c }))} style={{ accentColor: 'var(--primary)' }} />
                        <span style={{ fontSize: '0.9rem' }}>{c}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'checkbox' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(JSON.parse(q.choices || '[]') as string[]).map((c: string) => {
                      const checked = Array.isArray(applyAnswers[q.id]) && applyAnswers[q.id].includes(c);
                      return (
                        <label key={c} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '10px 14px', borderRadius: '10px', background: checked ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${checked ? 'var(--primary)' : 'rgba(255,255,255,0.08)'}`, transition: '0.2s' }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const prev: string[] = Array.isArray(applyAnswers[q.id]) ? applyAnswers[q.id] : [];
                            setApplyAnswers(p => ({ ...p, [q.id]: checked ? prev.filter(x => x !== c) : [...prev, c] }));
                          }} style={{ accentColor: 'var(--primary)' }} />
                          <span style={{ fontSize: '0.9rem' }}>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {q.type === 'text' && (
                  <textarea value={(applyAnswers[q.id] as string) || ''} onChange={e => setApplyAnswers(p => ({ ...p, [q.id]: e.target.value }))} rows={3} placeholder="回答を入力してください" className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.95rem', background: 'var(--input-bg)', resize: 'vertical' }} />
                )}
              </div>
            ))}
            <button type="submit" disabled={applySubmitting || !currentUser.roblox_username} className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: '1rem', borderRadius: '12px', marginTop: '8px', opacity: !currentUser.roblox_username ? 0.5 : 1 }}>
              {applySubmitting ? '送信中...' : (myApplication?.status === 'rejected' ? '再申請する' : '申請を送信する')}
            </button>
          </form>
        )
      )}
    </div>
  );
};
