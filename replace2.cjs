const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "}: AdminDashboardViewProps) => {",
  "}: AdminDashboardViewProps) => {\n  const [lookupSortOpen, setLookupSortOpen] = useState(false);\n"
);

const oldSelect = `<select 
                  className="glass" 
                  value={adminSortOrder} 
                  onChange={(e: any) => setAdminSortOrder(e.target.value)}
                  style={{ padding: '0 16px', height: '42px', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="newest">登録順 (新しい順)</option>
                  <option value="oldest">登録順 (古い順)</option>
                  <option value="maker">メーカー順 (A-Z)</option>
                </select>`;

const newDropdown = `<div style={{ position: 'relative' }}>
                  <button 
                    onClick={() => setLookupSortOpen(!lookupSortOpen)}
                    className="glass"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px', height: '42px', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer' }}
                  >
                    {adminSortOrder === 'newest' ? '登録順 (新しい順)' : adminSortOrder === 'oldest' ? '登録順 (古い順)' : adminSortOrder === 'maker' ? 'メーカー順 (A-Z)' : '台数付きユーザー順'}
                    <ChevronRight size={16} style={{ transform: lookupSortOpen ? 'rotate(90deg)' : 'rotate(0)', transition: '0.2s', marginLeft: '4px' }} />
                  </button>
                  {lookupSortOpen && (
                    <div className="glass animate-fade" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden', zIndex: 100, minWidth: '100%', whiteSpace: 'nowrap', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      {[
                        { id: 'newest', label: '登録順 (新しい順)' },
                        { id: 'oldest', label: '登録順 (古い順)' },
                        { id: 'maker', label: 'メーカー順 (A-Z)' },
                        { id: 'userCount', label: '台数付きユーザー順' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => { setAdminSortOrder(opt.id); setLookupSortOpen(false); }}
                          style={{ display: 'block', width: '100%', padding: '12px 16px', border: 'none', background: adminSortOrder === opt.id ? 'var(--primary)' : 'transparent', color: adminSortOrder === opt.id ? '#000' : 'var(--text-main)', textAlign: 'left', fontWeight: adminSortOrder === opt.id ? 700 : 500, fontSize: '0.9rem', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                          onMouseOver={(e) => { if(adminSortOrder !== opt.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                          onMouseOut={(e) => { if(adminSortOrder !== opt.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>`;

content = content.replace(oldSelect, newDropdown);

const oldSortLogic = `}).sort((a, b) => {
                    if (adminSortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    if (adminSortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                    if (adminSortOrder === 'maker') return (a.maker || '').localeCompare(b.maker || '');
                    return 0;
                  })`;

const newSortLogic = `}).sort((a, b) => {
                    if (adminSortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    if (adminSortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                    if (adminSortOrder === 'maker') return (a.maker || '').localeCompare(b.maker || '');
                    if (adminSortOrder === 'userCount') {
                       const countA = allSearchVehicles.filter(x => x.owner_id === a.owner_id).length;
                       const countB = allSearchVehicles.filter(x => x.owner_id === b.owner_id).length;
                       if (countB !== countA) return countB - countA;
                       return (a.roblox_username || '').localeCompare(b.roblox_username || '');
                    }
                    return 0;
                  })`;

content = content.replace(oldSortLogic, newSortLogic);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Updated AdminDashboardView.tsx");
