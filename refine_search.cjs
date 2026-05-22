const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');
let lines = content.split('\n');

// 1. Find the lookup Tab
const lookupStart = lines.findIndex(l => l.includes("adminTab === 'lookup' && ("));
if (lookupStart === -1) {
    console.error('Lookup tab not found');
    process.exit(1);
}

// 2. Find the search bar closing div (roughly after lookupStart)
const searchBarEnd = lines.findIndex((l, i) => i > lookupStart && l.trim() === '</div>' && lines[i-1].includes('input type="text"'));
if (searchBarEnd === -1) {
    console.log('Falling back to finding search bar by pattern');
}

// 3. Define the new Control Bar
const controlsHtml = `
              {/* Controls Bar */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '6px', borderRadius: '14px', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
                  <button onClick={() => setLookupViewMode('grid')} className="btn" style={{ padding: '8px', background: lookupViewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: lookupViewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)' }} title="グリッド表示">
                    <LayoutGrid size={20} />
                  </button>
                  <button onClick={() => setLookupViewMode('list')} className="btn" style={{ padding: '8px', background: lookupViewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: lookupViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)' }} title="リスト表示">
                    <List size={20} />
                  </button>
                </div>
                <select 
                  className="glass" 
                  value={adminSortOrder} 
                  onChange={(e: any) => setAdminSortOrder(e.target.value)}
                  style={{ padding: '0 16px', height: '42px', borderRadius: '12px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '0.9rem', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="newest">登録順 (新しい順)</option>
                  <option value="oldest">登録順 (古い順)</option>
                  <option value="maker">メーカー順 (A-Z)</option>
                </select>
              </div>`;

// 4. Define the new results logic
const resultsHtml = `
               <div className={lookupViewMode === 'grid' ? "card-grid" : "list-view"}>
                  {allSearchVehicles.filter(v => {
                    const s = adminSearchTerm.toLowerCase();
                    return (v.plate?.toLowerCase().includes(s) || v.roblox_username?.toLowerCase().includes(s) || v.maker?.toLowerCase().includes(s) || v.model?.toLowerCase().includes(s));
                  }).sort((a, b) => {
                    if (adminSortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                    if (adminSortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                    if (adminSortOrder === 'maker') return (a.maker || '').localeCompare(b.maker || '');
                    return 0;
                  }).map(v => (
                    <div key={v.id} className="glass card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ height: lookupViewMode === 'grid' ? '220px' : '200px', width: lookupViewMode === 'grid' ? '100%' : '250px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                        <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                          <StatusBadge status={v.status} />
                        </div>
                      </div>
                      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: '16px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center' }}>
                        <div style={{ flex: 2 }}>
                          <div style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '4px', letterSpacing: '0.02em' }}>{v.year} {v.maker} {v.model}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserIcon size={14} />
                            {v.roblox_username}
                          </div>
                        </div>
                        
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'inline-flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', width: 'fit-content' }}>
                            <div style={{ background: 'linear-gradient(135deg, #1c2e4a, #2a4060)', color: '#ffffff', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{v.plate_region || 'WISCONSIN'}</div>
                            <div style={{ background: '#fff', color: '#000', padding: '6px 14px', fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace, sans-serif' }}>{v.plate}</div>
                          </div>
                        </div>
                        
                        <div style={{ flex: 1, textAlign: lookupViewMode === 'grid' ? 'left' : 'right', borderTop: lookupViewMode === 'grid' ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingTop: lookupViewMode === 'grid' ? '16px' : '0', marginTop: 'auto' }}>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>登録日: {formatDate(v.created_at)}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.5, color: 'var(--text-muted)' }}>ID: {v.id.slice(0,8)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>`;

// Find where result grid starts
const resultGridStart = lines.findIndex((l, i) => i > lookupStart && l.includes('<div style={{ display: \'grid\''));
if (resultGridStart === -1) {
    console.error('Grid start not found');
    process.exit(1);
}

// Find grid end (closing div)
let resultGridEnd = -1;
let openDivs = 1;
for (let i = resultGridStart + 1; i < lines.length; i++) {
    if (lines[i].includes('<div')) openDivs++;
    if (lines[i].includes('</div>')) openDivs--;
    if (openDivs === 0) {
        resultGridEnd = i;
        break;
    }
}

// Construct new lines
const newLines = [
    ...lines.slice(0, resultGridStart),
    controlsHtml,
    resultsHtml,
    ...lines.slice(resultGridEnd + 1)
];

fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
console.log('Successfully refined search UI');
