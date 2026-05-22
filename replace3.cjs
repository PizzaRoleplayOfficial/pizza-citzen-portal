const fs = require('fs');
const path = require('path');

// 1. AdminDashboardView.tsx
const adminDashboardPath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let adminContent = fs.readFileSync(adminDashboardPath, 'utf8');

// We need to import CustomSortDropdown
adminContent = adminContent.replace(
  "import { StatusBadge } from '../components/UIBase';",
  "import { StatusBadge, CustomSortDropdown } from '../components/UIBase';"
);

// We need to remove the massive inline dropdown from earlier and replace with CustomSortDropdown
const dropdownStart = `<div style={{ position: 'relative' }}>`;
const findIndexAdmin = adminContent.indexOf(dropdownStart);

if (findIndexAdmin !== -1) {
    // I know this is hacky via code, let me just exact-replace the block.
    // wait, earlier I replaced `<select>` with `<div style={{ position: 'relative' }}>...` up to `</div>`.
    // Instead of regex hacking, I'll just restore AdminDashboardView.tsx to what it was right BEFORE that last bad inline addition, or I can just use a regex.
}
// Actually, it's safer to just replace the exact large string that I injected earlier.
const injectedDropdown = `<div style={{ position: 'relative' }}>
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

const newComponentUsageAdmin = `<CustomSortDropdown 
                  value={adminSortOrder}
                  onChange={setAdminSortOrder}
                  options={[
                    { id: 'newest', label: '登録順 (新しい順)' },
                    { id: 'oldest', label: '登録順 (古い順)' },
                    { id: 'maker', label: 'メーカー順 (A-Z)' },
                    { id: 'userCount', label: '台数付きユーザー順' }
                  ]}
                />`;

adminContent = adminContent.replace(injectedDropdown, newComponentUsageAdmin);
fs.writeFileSync(adminDashboardPath, adminContent, 'utf8');
console.log("Updated AdminDashboardView.tsx to use CustomSortDropdown");

// 2. MyGarageView.tsx
const myGaragePath = path.join(__dirname, 'src', 'views', 'MyGarageView.tsx');
let myGarageContent = fs.readFileSync(myGaragePath, 'utf8');

myGarageContent = myGarageContent.replace(
  "import { StatusBadge } from '../components/UIBase';",
  "import { StatusBadge, CustomSortDropdown } from '../components/UIBase';"
);

const oldGarageSelect = `<select 
                className="glass" 
                value={garageSortOrder} 
                onChange={(e: any) => setGarageSortOrder(e.target.value)}
                style={{ padding: '0 16px', height: '42px', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
              >
                <option value="newest">登録順 (新しい順)</option>
                <option value="oldest">登録順 (古い順)</option>
                <option value="maker">メーカー順 (A-Z)</option>
              </select>`;

const newGarageDropdown = `<CustomSortDropdown 
                value={garageSortOrder}
                onChange={setGarageSortOrder}
                options={[
                  { id: 'newest', label: '登録順 (新しい順)' },
                  { id: 'oldest', label: '登録順 (古い順)' },
                  { id: 'maker', label: 'メーカー順 (A-Z)' }
                ]}
              />`;

myGarageContent = myGarageContent.replace(oldGarageSelect, newGarageDropdown);
fs.writeFileSync(myGaragePath, myGarageContent, 'utf8');
console.log("Updated MyGarageView.tsx to use CustomSortDropdown");
