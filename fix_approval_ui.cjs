const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const startIdx = 274; // Line 275 (0-indexed)
const endIdx = 291;   // Line 291 (exclusive for slice means 291 index)

const newCode = `                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 420px))', gap: '24px' }}>
                  {vehicles.map(v => (
                    <div key={v.id} className="glass card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ height: '240px', width: '100%', position: 'relative' }}>
                        <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                          <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Clock size={14} /> 審査中
                          </div>
                        </div>
                      </div>
                      
                      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '4px', letterSpacing: '0.02em' }}>{v.year} {v.maker} {v.model}</div>
                          <div style={{ fontSize: '0.95rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <UserIcon size={14} />
                            </div>
                            {v.roblox_username}
                          </div>
                        </div>

                        <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: 'fit-content' }}>
                           <div style={{ background: 'linear-gradient(135deg, #1c2e4a, #2a4060)', color: '#ffffff', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{v.plate_region || 'WISCONSIN'}</div>
                           <div style={{ background: '#fff', color: '#000', padding: '6px 14px', fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace, sans-serif' }}>{v.plate}</div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                          <button className="btn btn-primary" onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ flex: 2, padding: '14px', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                            <CheckCircle2 size={20} /> 承認
                          </button>
                          <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ flex: 1, padding: '14px', justifyContent: 'center', color: 'var(--error)', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
                            <X size={20} /> 却下
                          </button>
                        </div>
                        
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>申請受領: {formatDate(v.created_at)}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>ID: {v.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  ))}`;

const part1 = lines.slice(0, startIdx);
const part2 = lines.slice(endIdx);
const newContent = part1.join('\n') + '\n' + newCode + '\n' + part2.join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully updated AdminDashboardView.tsx for Approval UI');
