const fs = require('fs');

let app = fs.readFileSync('src/App.tsx', 'utf8');

// Top Nav
app = app.replace('<LayoutDashboard size={18} /> さがす(ガレージ)', '<LayoutDashboard size={18} /> ガレージ');
app = app.replace('<ClipboardList size={18} /> やること(市民申請)', '<ClipboardList size={18} /> 市民申請');
app = app.replace('<UserIcon size={18} /> メニュー(設定)', '<UserIcon size={18} /> 設定');

// Home Cards
app = app.replace('🪪 やること(市民申請)', '🪪 市民申請');
app = app.replace('🚗 さがす(ガレージ)', '🚗 ガレージ');
app = app.replace('⚙️ メニュー(設定)', '⚙️ 設定');

// Mobile Bottom Nav
app = app.replace(`<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>さがす</span>`, `<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>ガレージ</span>`);
app = app.replace(`<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>やること</span>`, `<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>申請</span>`);
app = app.replace(`<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>メニュー</span>`, `<span style={{ fontSize: '0.7rem', fontWeight: 600 }}>設定</span>`);

fs.writeFileSync('src/App.tsx', app, 'utf8');
console.log('SUCCESS');
