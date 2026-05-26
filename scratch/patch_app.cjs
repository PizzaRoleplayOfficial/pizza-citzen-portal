const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'App.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Helper to verify matching
const verifyMatch = (regex, name) => {
  if (!regex.test(content)) {
    console.warn(`WARNING: Match failed for ${name}`);
  } else {
    console.log(`MATCHED: ${name}`);
  }
};

// 1. carModels の下に loadCatalog 関数を定義する
const carModelsRegex = /const \[carModels, setCarModels\] = useState<Record<string, string\[\]>>\(\{\}\);/;
verifyMatch(carModelsRegex, "carModels definition");
const loadCatalogCode = `const [carModels, setCarModels] = useState<Record<string, string[]>>({});
  const loadCatalog = async (gameType: 'gv' | 'rc') => {
    try {
      const res = await fetch(\`/api/catalog?gameType=\${gameType}\`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.catalog) {
          setCarModels(data.catalog);
          return;
        }
      }
    } catch (e) {
      console.error(\`Failed to load \${gameType} dynamic catalog, falling back:\`, e);
    }
    if (gameType === 'gv') {
      fetch('/data/car_models.json')
        .then(r => r.json())
        .then(data => setCarModels(data as Record<string, string[]>))
        .catch(e => console.error("Failed to load car models catalog:", e));
    } else {
      setCarModels({
        "Chevrolet": ["Caprice", "Tahoe", "Impala", "Silverado"],
        "Ford": ["Crown Victoria", "Explorer", "F-150", "Taurus"],
        "Dodge": ["Charger", "Durango", "Ram"],
        "Toyota": ["Camry", "Prius", "RAV4"]
      });
    }
  };`;
content = content.replace(carModelsRegex, loadCatalogCode);

// 2. 初期ロード時の fetch を loadCatalog('gv') に切り替える
const initialLoadRegex = /\/\/ Load external vehicle catalog\r?\n\s*fetch\('\/data\/car_models\.json'\)\r?\n\s*\.then\(r => r\.json\(\)\)\r?\n\s*\.then\(data => setCarModels\(data as Record<string, string\[\]>\)\)\r?\n\s*\.catch\(e => console\.error\("Failed to load car models catalog:", e\)\);/;
verifyMatch(initialLoadRegex, "Initial vehicle catalog fetch");
content = content.replace(initialLoadRegex, "// Load external vehicle catalog\r\n    loadCatalog('gv');");

// 3. formData の初期値に game_type: 'gv' を追加する
const formDataRegex = /const \[formData, setFormData\] = useState\(\{\r?\n\s*maker: '',/;
verifyMatch(formDataRegex, "formData initial state");
content = content.replace(formDataRegex, `const [formData, setFormData] = useState({
    game_type: 'gv',
    maker: '',`);

// 4. trailerFormData の初期値に game_type: 'gv' を追加する
const trailerFormDataRegex = /const \[trailerFormData, setTrailerFormData\] = useState\(\{\r?\n\s*model: '',/;
verifyMatch(trailerFormDataRegex, "trailerFormData initial state");
content = content.replace(trailerFormDataRegex, `const [trailerFormData, setTrailerFormData] = useState({
    game_type: 'gv',
    model: '',`);

// 5. handleSubmitTrailer のクリア処理を修正する
const clearTrailerRegex = /setTrailerFormData\(\{\s*model:\s*'',\s*maker:\s*'',\s*trailer_type:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username\s*\|\|\s*'',\s*image_data:\s*''\s*\}\);/;
verifyMatch(clearTrailerRegex, "handleSubmitTrailer clear data");
content = content.replace(clearTrailerRegex, `setTrailerFormData({ game_type: 'gv', model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });`);

// 6. handleSubmitVehicle のクリア処理を修正する
const clearVehicleRegex = /setFormData\(\{\s*maker:\s*'',\s*model:\s*'',\s*year:\s*2024,\s*trim:\s*'',\s*color:\s*'',\s*plate:\s*'',\s*plate_region:\s*'WISCONSIN',\s*roblox_username:\s*currentUser\.roblox_username\s*\|\|\s*'',\s*image_data:\s*''\s*\}\);/;
verifyMatch(clearVehicleRegex, "handleSubmitVehicle clear data");
content = content.replace(clearVehicleRegex, `setFormData({ game_type: 'gv', maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });`);

// 7. handleStartEdit に game_type セットを追加する (Trailer)
const handleStartEditRegex = /const isTrailer = \(v as any\)\.vehicle_type === 'trailer';\r?\n\s*if \(isTrailer\) \{\r?\n\s*setTrailerFormData\(\{\r?\n\s*model: v\.model, maker: v\.maker/;
verifyMatch(handleStartEditRegex, "handleStartEdit Trailer definition");
content = content.replace(handleStartEditRegex, `const isTrailer = (v as any).vehicle_type === 'trailer';
    if (isTrailer) {
      setTrailerFormData({
        game_type: (v as any).game_type || 'gv',
        model: v.model, maker: v.maker`);

// 8. handleStartEdit に game_type セットを追加する (Normal)
const handleStartEditNormalRegex = /\} else \{\s*setFormData\(\{\r?\n\s*maker: v\.maker/;
verifyMatch(handleStartEditNormalRegex, "handleStartEdit Normal definition");
content = content.replace(handleStartEditNormalRegex, `} else {      setFormData({
        game_type: (v as any).game_type || 'gv',
        maker: v.maker`);

// 9. Wiki-image の fetch を gameType 対応にする
const wikiImageRegex = /fetch\(\`\/api\/wiki-image\?v=4&q=\\\${encodeURIComponent\(query\)}\\\${formData\.trim \? \`&trim=\\\${encodeURIComponent\(formData\.trim\)}\` : ''\}\`\)/;
verifyMatch(wikiImageRegex, "wikiImage fetch call");
content = content.replace(wikiImageRegex, `fetch(\`/api/wiki-image?v=4&q=\${encodeURIComponent(query)}&gameType=\${formData.game_type}\${formData.trim ? \`&trim=\${encodeURIComponent(formData.trim)}\` : ''}\`)`);

const wikiImageDepsRegex = /\} \), \[formData\.maker, formData\.model, formData\.year, formData\.trim, showAddModal\]\);/;
const alternativeDepsRegex = /\}, \[formData\.maker, formData\.model, formData\.year, formData\.trim, showAddModal\]\);/;
if (wikiImageDepsRegex.test(content)) {
  verifyMatch(wikiImageDepsRegex, "wikiImage dependencies format 1");
  content = content.replace(wikiImageDepsRegex, `}, [formData.maker, formData.model, formData.year, formData.trim, formData.game_type, showAddModal]);`);
} else {
  verifyMatch(alternativeDepsRegex, "wikiImage dependencies format 2");
  content = content.replace(alternativeDepsRegex, `}, [formData.maker, formData.model, formData.year, formData.trim, formData.game_type, showAddModal]);`);
}

// 10. handleWikiSync のマルチゲーム化
const handleWikiSyncRegex = /const handleWikiSync = async \(\) => \{\r?\n\s*if \(!confirm\('Wikiから最新の車両データを取得し、カタログを更新しますか？'\)\) return;\r?\n\s*try \{\r?\n\s*const res = await fetch\('\/api\/catalog', \{ method: 'POST' \}\);/;
verifyMatch(handleWikiSyncRegex, "handleWikiSync definition");
content = content.replace(handleWikiSyncRegex, `const handleWikiSync = async (gameType: 'gv' | 'rc') => {
    const gameName = gameType === 'rc' ? 'Rensselaer County (RC)' : 'Greenville (Gv)';
    if (!confirm(\`\${gameName} のWikiから最新の車両データを取得し、カタログを更新しますか？\\n（この処理には1分程度かかる場合があります）\`)) return;
    try {
      const res = await fetch(\`/api/catalog?gameType=\${gameType}\`, { method: 'POST' });`);

// 11. Sync 完了時のアラート・カタログ再読込を handleWikiSync に追加する
const handleWikiSyncSuccessRegex = /if \(res\.ok\) \{\r?\n\s*alert\('カタログの同期が完了しました。'\);\r?\n\s*\} else \{/;
verifyMatch(handleWikiSyncSuccessRegex, "handleWikiSync success block");
content = content.replace(handleWikiSyncSuccessRegex, `if (res.ok) {
        alert(\`\${gameName} のカタログ同期が完了しました。\`);
        loadCatalog(gameType);
      } else {`);

// 12. showAddModal フォームの最上部にゲーム選択トグルを追加する
const showAddModalFormTopRegex = /<form onSubmit=\{handleSubmitVehicle\} style=\{\{ display: 'flex', flexDirection: 'column', gap: isMobile \? '16px' : '20px' \}\}>/;
verifyMatch(showAddModalFormTopRegex, "showAddModal form start");
const addModalGameToggle = `<form onSubmit={handleSubmitVehicle} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              {/* ゲーム選択トグル (Gv / RC) */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>対象ゲーム (Target Game)</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, game_type: 'gv', maker: '', model: '' }));
                      loadCatalog('gv');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: formData.game_type === 'gv' ? 'rgba(0, 193, 102, 0.2)' : 'transparent',
                      color: formData.game_type === 'gv' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: formData.game_type === 'gv' ? '0 2px 8px rgba(0, 193, 102, 0.15)' : 'none'
                    }}
                  >
                    🟢 Greenville (Gv)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, game_type: 'rc', maker: '', model: '' }));
                      loadCatalog('rc');
                    }}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: formData.game_type === 'rc' ? 'rgba(0, 160, 204, 0.2)' : 'transparent',
                      color: formData.game_type === 'rc' ? 'var(--secondary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: formData.game_type === 'rc' ? '0 2px 8px rgba(0, 160, 204, 0.15)' : 'none'
                    }}
                  >
                    🔵 Rensselaer County (RC)
                  </button>
                </div>
              </div>`;
content = content.replace(showAddModalFormTopRegex, addModalGameToggle);

// 13. showAddModal プレビューテキストの Greenville / RC Wiki 切り替え
const previewTextRegex = /📖 Greenville Wiki より参照画像/;
verifyMatch(previewTextRegex, "showAddModal preview text");
content = content.replace(previewTextRegex, "📖 {formData.game_type === 'rc' ? 'Rensselaer County' : 'Greenville'} Wiki より参照画像");

// 14. showTrailerModal フォームの最上部にゲーム選択トグルを追加する
const showTrailerModalFormTopRegex = /<form onSubmit=\{handleSubmitTrailer\} style=\{\{ display: 'flex', flexDirection: 'column', gap: isMobile \? '16px' : '20px' \}\}>/;
verifyMatch(showTrailerModalFormTopRegex, "showTrailerModal form start");
const trailerModalGameToggle = `<form onSubmit={handleSubmitTrailer} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              {/* ゲーム選択トグル (Gv / RC) */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>対象ゲーム (Target Game)</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => setTrailerFormData(prev => ({ ...prev, game_type: 'gv' }))}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: trailerFormData.game_type === 'gv' ? 'rgba(0, 193, 102, 0.2)' : 'transparent',
                      color: trailerFormData.game_type === 'gv' ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: trailerFormData.game_type === 'gv' ? '0 2px 8px rgba(0, 193, 102, 0.15)' : 'none'
                    }}
                  >
                    🟢 Greenville (Gv)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailerFormData(prev => ({ ...prev, game_type: 'rc' }))}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: trailerFormData.game_type === 'rc' ? 'rgba(0, 160, 204, 0.2)' : 'transparent',
                      color: trailerFormData.game_type === 'rc' ? 'var(--secondary)' : 'var(--text-muted)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: trailerFormData.game_type === 'rc' ? '0 2px 8px rgba(0, 160, 204, 0.15)' : 'none'
                    }}
                  >
                    🔵 Rensselaer County (RC)
                  </button>
                </div>
              </div>`;
content = content.replace(showTrailerModalFormTopRegex, trailerModalGameToggle);

fs.writeFileSync(filePath, content, 'utf8');
console.log("SUCCESS: App.tsx patched successfully!");
