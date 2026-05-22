const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Find the License Plate Number div using index positions
const labelIdx = content.indexOf('License Plate Number</label>');
const divStart = content.lastIndexOf('<div>', labelIdx);
const divEnd = content.indexOf('</div>', labelIdx) + '</div>'.length;

const oldBlock = content.substring(divStart, divEnd);
console.log('Old block (first 150):', JSON.stringify(oldBlock.substring(0, 150)));

const newBlock = `{/* Registration Mode Selector */}
              {!editingVehicleId && (
                <div style={{ display: 'flex', gap: '8px' }}>
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

const newContent = content.substring(0, divStart) + newBlock + content.substring(divEnd);

console.log('Has temp UI:', newContent.includes('仮ナンバー申請として送信'));
console.log('Has registrationMode check:', newContent.includes("registrationMode === 'temp' ?"));

fs.writeFileSync('src/App.tsx', newContent, 'utf8');
console.log('Done');
