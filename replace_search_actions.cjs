const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `<div style={{ flex: 1, textAlign: lookupViewMode === 'grid' ? 'left' : 'right', borderTop: lookupViewMode === 'grid' ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: lookupViewMode === 'grid' ? '12px' : '0', marginTop: 'auto' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>登録日: {formatDate(v.created_at)}</div>
                          <div style={{ fontSize: '0.65rem', opacity: 0.5, color: 'var(--text-muted)' }}>ID: {v.id.slice(0,8)}</div>
                        </div>`;

const replacement = `<div style={{ marginTop: 'auto', display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                             {v.status !== 'rejected' && (
                                <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ padding: '6px 12px', color: 'var(--error)', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)', fontSize: '0.8rem', fontWeight: 700 }}>
                                  <X size={14} /> 却下
                                </button>
                             )}
                             {(v.status === 'rejected' || v.status === 'pending') && (
                                <>
                                  <button className="btn btn-primary" onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700 }}>
                                    <CheckCircle2 size={14} /> 承認
                                  </button>
                                  <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'approved_warning')} style={{ padding: '6px 12px', color: '#FFA114', background: 'rgba(255, 161, 20, 0.1)', border: '1px solid rgba(255, 161, 20, 0.2)', fontSize: '0.8rem', fontWeight: 700 }}>
                                    <AlertTriangle size={14} /> 非推奨
                                  </button>
                                </>
                             )}
                          </div>
                          
                          <div style={{ textAlign: lookupViewMode === 'grid' ? 'left' : 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(v.created_at)}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, color: 'var(--text-muted)' }}>{v.id.slice(0,8)}</div>
                          </div>
                        </div>`;

content = content.replace(target, replacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminDashboardView.tsx updated with search action buttons');
