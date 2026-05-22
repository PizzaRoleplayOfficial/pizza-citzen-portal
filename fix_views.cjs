const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix Sorting logic and label
let sortDropdownTarget = `                    { id: 'newest', label: '登録順 (新しい順)' },
                    { id: 'oldest', label: '登録順 (古い順)' },
                    { id: 'maker', label: 'メーカー順 (A-Z)' },
                    { id: 'userCount', label: '台数付きユーザー順' }`;
let sortDropdownReplace = `                    { id: 'newest', label: '登録順 (新しい順)' },
                    { id: 'oldest', label: '登録順 (古い順)' },
                    { id: 'maker', label: 'メーカー順 (A-Z)' },
                    { id: 'userCount', label: 'ユーザー名順 (A-Z)' }`;
content = content.replace(sortDropdownTarget, sortDropdownReplace);

let sortLogicTarget = `                    if (adminSortOrder === 'userCount') {
                       const countA = allSearchVehicles.filter(x => x.owner_id === a.owner_id).length;
                       const countB = allSearchVehicles.filter(x => x.owner_id === b.owner_id).length;
                       if (countB !== countA) return countB - countA;
                       return (a.roblox_username || '').localeCompare(b.roblox_username || '');
                    }`;
let sortLogicReplace = `                    if (adminSortOrder === 'userCount') {
                       return (a.roblox_username || '').localeCompare(b.roblox_username || '');
                    }`;
content = content.replace(sortLogicTarget, sortLogicReplace);

// 2. Fix Card JSX to correctly handle grid/list on mobile and desktop
// I will write a regex or replace the map section.
const cardMapTarget = `                  }).map(v => (
                    <div key={v.id} className="glass card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ height: lookupViewMode === 'grid' ? '220px' : '200px', width: lookupViewMode === 'grid' ? '100%' : '250px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                        <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                          <StatusBadge status={v.status} reason={v.reject_reason} />
                        </div>
                      </div>
                      <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: '16px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center' }}>`;

const cardMapReplace = `                  }).map(v => {
                    const isList = lookupViewMode === 'list';
                    return (
                    <div key={v.id} className="glass card view-anim" style={{ 
                      padding: 0, overflow: 'hidden', display: 'flex', 
                      flexDirection: isList ? (isMobile ? 'column' : 'row') : 'column', 
                      height: '100%' 
                    }}>
                      <div style={{ 
                        height: isList ? (isMobile ? '120px' : '100%') : '220px', 
                        width: isList ? (isMobile ? '100%' : '250px') : '100%', 
                        position: 'relative', overflow: 'hidden', flexShrink: 0,
                        borderRight: isList && !isMobile ? '1px solid var(--glass-border)' : 'none',
                        borderBottom: isList && !isMobile ? 'none' : '1px solid var(--glass-border)'
                      }}>
                        <div style={{ width: '100%', height: '100%', transform: isList && !isMobile ? 'scale(1.2)' : 'none', transformOrigin: 'center' }}>
                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} />
                        </div>
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                          <StatusBadge status={v.status} reason={v.reject_reason} />
                        </div>
                      </div>
                      <div style={{ 
                        padding: isMobile && isList ? '16px' : '24px', 
                        flex: 1, display: 'flex', 
                        flexDirection: isList && !isMobile ? 'row' : 'column', 
                        gap: isMobile && isList ? '8px' : '16px', 
                        alignItems: isList && !isMobile ? 'center' : 'stretch' 
                      }}>`;

content = content.replace(cardMapTarget, cardMapReplace);


// Fix the closing bracket for map
content = content.replace(`                        </div>
                      </div>
                    </div>
                  ))}
                </div>`, `                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('AdminDashboardView.tsx patched');
