const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// ===== 1. Add registrationMode and tempRegDays state after showAddModal =====
const stateTarget = "  const [showAddModal, setShowAddModal] = useState(false);";
const stateReplacement = `  const [showAddModal, setShowAddModal] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<'normal' | 'temp'>('normal');
  const [tempRegDays, setTempRegDays] = useState(5);`;
content = content.replace(stateTarget, stateReplacement);

// ===== 2. Update handleSubmitVehicle payload =====
const payloadTarget = `      const payload = { ...formData, owner_id: currentUser.id };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });`;
const payloadReplacement = `      const isTempReg = !editingVehicleId && registrationMode === 'temp';
      const payload = {
        ...formData,
        owner_id: currentUser.id,
        ...(isTempReg ? {
          is_temp_registration: true,
          temp_duration_days: tempRegDays,
          requested_temp_plate: formData.plate,
        } : {})
      };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });`;
content = content.replace(payloadTarget, payloadReplacement);

// Also reset registrationMode when modal closes
const resetTarget = `        setShowAddModal(false);
        setEditingVehicleId(null);
        setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });`;
const resetReplacement = `        setShowAddModal(false);
        setEditingVehicleId(null);
        setRegistrationMode('normal');
        setTempRegDays(5);
        setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });`;
content = content.replace(resetTarget, resetReplacement);

// ===== 3. Add registration mode selector UI before the License Plate Number field =====
// Find the License Plate Number div and insert before it
const plateTarget = `              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number</label>
                 <input type="text" placeholder="例: ABC-1234" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, background: 'var(--input-bg)' }} />
              </div>`;
const plateReplacement = `              {/* Registration Mode Selector - only for new vehicles */}
              {!editingVehicleId && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setRegistrationMode('normal')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid',
                      borderColor: registrationMode === 'normal' ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                      background: registrationMode === 'normal' ? 'rgba(0,193,102,0.12)' : 'var(--input-bg)',
                      color: registrationMode === 'normal' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                    }}
                  >
                    🚗 通常登録
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegistrationMode('temp')}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid',
                      borderColor: registrationMode === 'temp' ? '#f59e0b' : 'rgba(255,255,255,0.1)',
                      background: registrationMode === 'temp' ? 'rgba(245,158,11,0.12)' : 'var(--input-bg)',
                      color: registrationMode === 'temp' ? '#f59e0b' : 'var(--text-muted)',
                      fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer'
                    }}
                  >
                    🅿️ 仮ナンバー申請
                  </button>
                </div>
              )}

              {!editingVehicleId && registrationMode === 'temp' && (
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', fontSize: '0.85rem', color: '#f59e0b' }}>
                  🅿️ 仮ナンバー申請として送信されます。管理者が承認後に仮ナンバーが発行されます。
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>仮ナンバー有効期間:</label>
                    <input
                      type="number" min={1} max={30} value={tempRegDays}
                      onChange={e => setTempRegDays(Number(e.target.value))}
                      className="glass"
                      style={{ width: '70px', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.4)', color: 'var(--text-main)', background: 'var(--input-bg)', fontSize: '0.9rem' }}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>日間</span>
                  </div>
                </div>
              )}

              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: registrationMode === 'temp' ? '#f59e0b' : 'var(--text-muted)' }}>
                   {registrationMode === 'temp' ? '🅿️ 希望仮ナンバー' : 'License Plate Number'}
                 </label>
                 <input type="text" placeholder={registrationMode === 'temp' ? '例: 仮-1234' : '例: ABC-1234'} value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: \`2px solid \${registrationMode === 'temp' ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}\`, color: 'var(--text-main)', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, background: 'var(--input-bg)' }} />
              </div>`;
content = content.replace(plateTarget, plateReplacement);

// Verify changes
console.log('Has registrationMode state:', content.includes("useState<'normal' | 'temp'>('normal')"));
console.log('Has is_temp_registration payload:', content.includes('is_temp_registration'));
console.log('Has temp mode UI:', content.includes('仮ナンバー申請として送信'));

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Done');
