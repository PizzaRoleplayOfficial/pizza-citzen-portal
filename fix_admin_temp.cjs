const fs = require('fs');

let c = fs.readFileSync('src/views/AdminDashboardView.tsx', 'utf8');

// 1. Add handleTempAction to Props
c = c.replace(
  `handleUpdateStatus: (id: string, status: string) => void;`,
  `handleUpdateStatus: (id: string, status: string) => void;\n  handleTempAction?: (id: string, action: 'issue_temp'|'extend_temp'|'revoke_temp', days?: number) => void;`
);
c = c.replace(
  `handleUpdateStatus,`,
  `handleUpdateStatus,\n  handleTempAction,` // in the component function arguments
);

// 2. Add state for TempDialog
const stateTarget = `const [lookupVehicleType, setLookupVehicleType] = useState<'car' | 'trailer'>('car');`;
const stateAdd = `const [lookupVehicleType, setLookupVehicleType] = useState<'car' | 'trailer'>('car');\n  const [tempDialog, setTempDialog] = useState<{isOpen: boolean, vehicleId: string, action: 'issue_temp'|'extend_temp', days: number} | null>(null);`;
c = c.replace(stateTarget, stateAdd);

// 3. Add TempAction buttons helper function
const helperAdd = `
  const renderTempButtons = (v: any) => {
    if (!handleTempAction) return null;
    if (v.status === 'pending') {
      return (
        <button className="btn" onClick={(e) => { e.stopPropagation(); setTempDialog({ isOpen: true, vehicleId: v.id, action: 'issue_temp', days: 7 }); }} style={{ padding: '8px 16px', background: 'rgba(163, 230, 53, 0.15)', color: '#a3e635', border: '1px solid rgba(163, 230, 53, 0.3)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}>
          🅿️ 仮ナンバー発行
        </button>
      );
    }
    if (v.status === 'temp_approved' || v.status === 'temp_expired') {
      return (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" onClick={(e) => { e.stopPropagation(); setTempDialog({ isOpen: true, vehicleId: v.id, action: 'extend_temp', days: 7 }); }} style={{ padding: '8px 16px', background: 'rgba(163, 230, 53, 0.15)', color: '#a3e635', border: '1px solid rgba(163, 230, 53, 0.3)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}>
            ⏳ 延長
          </button>
          {v.status === 'temp_approved' && (
            <button className="btn" onClick={(e) => { e.stopPropagation(); if(confirm('仮ナンバーを失効させますか？')) handleTempAction(v.id, 'revoke_temp'); }} style={{ padding: '8px 16px', background: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.3)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 800 }}>
              🛑 失効
            </button>
          )}
        </div>
      );
    }
    return null;
  };
`;
c = c.replace(`const getEditingAnswerArray = (q: any) => {`, helperAdd + '\n  const getEditingAnswerArray = (q: any) => {');

// 4. Inject buttons into the 3 places

// a) Pending vehicles View (approx line 377) 
// Target: {v.status !== 'rejected' && ( ... <button btn-secondary rejected> )}
// Let's just find the flex container and append the new buttons.
c = c.replace(
  `<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>`,
  `<div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>\n                             {renderTempButtons(v)}`
);

// b) Lookup vehicles View (approx line 583)
c = c.replace(
  `<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>`,
  `<div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>\n                             {renderTempButtons(v)}`
);

// c) Header in Modal (approx line 976)
c = c.replace(
  `{selectedVehicleDetail.status !== 'rejected' && (`,
  `{renderTempButtons(selectedVehicleDetail)}\n                        {selectedVehicleDetail.status !== 'rejected' && (`
);

// 5. Add the Dialog UI at the bottom of the component
const dialogUI = `
      {/* Temp Plate Dialog */}
      {tempDialog && tempDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass animate-fade" style={{ background: '#111', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '400px', border: '1px solid var(--glass-border)' }}>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              🅿️ 仮ナンバー{tempDialog.action === 'issue_temp' ? '発行' : '延長'}
            </h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '0.9rem', lineHeight: 1.5 }}>
              有効日数を入力してください（7〜30日間）。
            </p>
            
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 700 }}>
                <span>日数</span>
                <span style={{ color: 'var(--primary)' }}>{tempDialog.days} 日</span>
              </div>
              <input 
                type="range" 
                min="1" max="30" 
                value={tempDialog.days} 
                onChange={(e) => setTempDialog({...tempDialog, days: parseInt(e.target.value)})}
                style={{ width: '100%', accentColor: 'var(--primary)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span>1日</span><span>30日</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setTempDialog(null)}
                className="btn" 
                style={{ flex: 1, padding: '12px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 700 }}
              >
                キャンセル
              </button>
              <button 
                onClick={() => {
                  if (handleTempAction) {
                    handleTempAction(tempDialog.vehicleId, tempDialog.action, tempDialog.days);
                    setTempDialog(null);
                  }
                }}
                className="btn btn-primary" 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontWeight: 800 }}
              >
                {tempDialog.action === 'issue_temp' ? '発行する' : '延長する'}
              </button>
            </div>
          </div>
        </div>
      )}
`;

c = c.replace(`{selectedUserForVehicles && (`, dialogUI + '\n      {selectedUserForVehicles && (');


fs.writeFileSync('src/views/AdminDashboardView.tsx', c, 'utf8');
console.log('SUCCESS: AdminDashboardView updated');
