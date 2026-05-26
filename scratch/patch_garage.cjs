const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'views', 'MyGarageView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Helper to verify matching
const verifyMatch = (regex, name) => {
  if (!regex.test(content)) {
    console.warn(`WARNING: Match failed for ${name}`);
  } else {
    console.log(`MATCHED: ${name}`);
  }
};

// 1. MyGarageView 内の先頭に activeGame ステートを定義する
const garageStateRegex = /const \[garageSearchTerm, setGarageSearchTerm\] = useState\(''\);/;
verifyMatch(garageStateRegex, "activeGame state injection");
content = content.replace(garageStateRegex, `const [activeGame, setActiveGame] = useState<'gv' | 'rc'>('gv');\r\n  const [garageSearchTerm, setGarageSearchTerm] = useState('');`);

// 2. カウント表示のゲーム別フィルタリング
const countRegex = /🚗 \{vehicles\.filter\(\(v: any\) => v\.vehicle_type !== 'trailer'\)\.length\} 台[\s\S]*?🚛 \{vehicles\.filter\(\(v: any\) => v\.vehicle_type === 'trailer'\)\.length\} 台/;
verifyMatch(countRegex, "Vehicle count filtering");
content = content.replace(countRegex, `🚗 {vehicles.filter((v: any) => v.vehicle_type !== 'trailer' && (v.game_type || 'gv') === activeGame).length} 台\r\n                  </span>\r\n                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600 }}>\r\n                    🚛 {vehicles.filter((v: any) => v.vehicle_type === 'trailer' && (v.game_type || 'gv') === activeGame).length} 台`);

// 3. デスクトップ用車両追加での game_type: activeGame 連動
const desktopAddVehicleRegex = /setFormData\(\{\s*maker:\s*'',\s*model:\s*'',\s*year:\s*2024,\s*trim:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username,\s*image_data:\s*''\s*\}\);/;
verifyMatch(desktopAddVehicleRegex, "Desktop add vehicle activeGame sync");
content = content.replace(desktopAddVehicleRegex, `setFormData({ game_type: activeGame, maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });`);

// 4. デスクトップ用トレーラー追加での game_type: activeGame 連動
const desktopAddTrailerRegex = /setTrailerFormData\(\{\s*model:\s*'',\s*maker:\s*'',\s*trailer_type:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username,\s*image_data:\s*''\s*\}\);/;
verifyMatch(desktopAddTrailerRegex, "Desktop add trailer activeGame sync");
content = content.replace(desktopAddTrailerRegex, `setTrailerFormData({ game_type: activeGame, model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });`);

// 5. 検索バーの下に「ゲーム専用セグメントタブ (Gv / RC)」を追加する
const searchBarBottomRegex = /\{#\* Search Bar - Mirrored from Vehicle Lookup for consistency \*#\}\r?\n\s*<div style=\{\{\s*marginBottom:\s*'24px'[\s\S]*?<\/div>\r?\n\s*<\/div>/;
// Let's do a more robust string replace for the searchBar end
const searchBarEndStr = `onChange={(e: any) => setGarageSearchTerm(e.target.value)}
                className="glass"
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: 'none', background: 'var(--panel-bg)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
          </div>`;

const searchBarReplacement = `${searchBarEndStr}

          {/* ゲーム専用セグメントタブ (Gv / RC) (v1.8.0) */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '5px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              <button
                onClick={() => { triggerHaptic('light'); setActiveGame('gv'); }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: activeGame === 'gv' ? 'rgba(0, 193, 102, 0.15)' : 'transparent',
                  color: activeGame === 'gv' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderBottom: activeGame === 'gv' ? '2px solid var(--primary)' : '2px solid transparent'
                }}
              >
                🎮 Greenville (Gv)
              </button>
              <button
                onClick={() => { triggerHaptic('light'); setActiveGame('rc'); }}
                style={{
                  flex: 1,
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  background: activeGame === 'rc' ? 'rgba(0, 160, 204, 0.15)' : 'transparent',
                  color: activeGame === 'rc' ? 'var(--secondary)' : 'var(--text-muted)',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  borderBottom: activeGame === 'rc' ? '2px solid var(--secondary)' : '2px solid transparent'
                }}
              >
                🎮 Rensselaer County (RC)
              </button>
            </div>
          </div>`;

if (content.indexOf(searchBarEndStr) !== -1) {
  console.log("MATCHED: search bar end insertion point");
  content = content.replace(searchBarEndStr, searchBarReplacement);
} else {
  console.warn("WARNING: search bar end insertion point NOT matched!");
}

// 6. フィルター条件に activeGame 条件を追加する
const filterMatchRegex = /vehicles\r?\n\s*\.filter\(v => \{\r?\n\s*const typeMatch = \(v as any\)\.vehicle_type === garageTab \|\| \(!\(v as any\)\.vehicle_type && garageTab === 'car'\);\r?\n\s*if \(!typeMatch\) return false;/;
verifyMatch(filterMatchRegex, "filter match block");
content = content.replace(filterMatchRegex, `vehicles
                .filter(v => {
                  const typeMatch = (v as any).vehicle_type === garageTab || (!(v as any).vehicle_type && garageTab === 'car');
                  if (!typeMatch) return false;
                  
                  // Game type filter (Greenville / RC)
                  const gameMatch = (v.game_type || 'gv') === activeGame;
                  if (!gameMatch) return false;`);

// 7. 各車両カードに Greenville / RC の識別バッジを表示する
const cardHeaderRegex = /<div className="garage-card-header">\r?\n\s*<div>\r?\n\s*<div className="garage-card-meta">/;
verifyMatch(cardHeaderRegex, "garage-card-header insertion point");
content = content.replace(cardHeaderRegex, `<div className="garage-card-header">
                      <div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{
                            fontSize: '0.65rem',
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: v.game_type === 'rc' ? 'rgba(0, 160, 204, 0.15)' : 'rgba(0, 193, 102, 0.15)',
                            color: v.game_type === 'rc' ? 'var(--secondary)' : 'var(--primary)',
                            border: v.game_type === 'rc' ? '1px solid rgba(0, 160, 204, 0.3)' : '1px solid rgba(0, 193, 102, 0.3)'
                          }}>
                            {v.game_type === 'rc' ? '🔵 RC' : '🟢 Greenville'}
                          </span>
                        </div>
                        <div className="garage-card-meta">`);

// 8. モバイル用画像から自動登録での activeGame 連動
const mobileOcrAddRegex = /if \(!currentUser\.roblox_username\) \{ alert\("ユーザー名を設定してください"\); setView\('profile'\); return; \}\r?\n\s*setShowBetaAutoFillModal\(true\);/;
verifyMatch(mobileOcrAddRegex, "Mobile OCR add activeGame sync");
content = content.replace(mobileOcrAddRegex, `if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                      setFormData(prev => ({ ...prev, game_type: activeGame }));
                      setShowBetaAutoFillModal(true);`);

// 9. モバイル用手動登録での activeGame 連動
const mobileAddVehicleRegex = /setFormData\(\{\s*maker:\s*'',\s*model:\s*'',\s*year:\s*2024,\s*trim:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username,\s*image_data:\s*''\s*\}\);/;
verifyMatch(mobileAddVehicleRegex, "Mobile manual add vehicle activeGame sync");
content = content.replace(mobileAddVehicleRegex, `setFormData({ game_type: activeGame, maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });`);

// 10. モバイル用手動トレーラー登録での activeGame 連動
const mobileAddTrailerRegex = /setTrailerFormData\(\{\s*model:\s*'',\s*maker:\s*'',\s*trailer_type:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username,\s*image_data:\s*''\s*\}\);/;
verifyMatch(mobileAddTrailerRegex, "Mobile manual add trailer activeGame sync");
content = content.replace(mobileAddTrailerRegex, `setTrailerFormData({ game_type: activeGame, model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });`);

fs.writeFileSync(filePath, content, 'utf8');
console.log("SUCCESS: MyGarageView.tsx patched successfully!");
