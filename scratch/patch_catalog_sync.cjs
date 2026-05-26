const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'views', 'AdminDashboardView.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// カタログセクションの一括置換
const targetRegex = /\{adminTab === 'catalog' && \(\s*<div className="animate-fade">[\s\S]*?<\/div>\s*\)\}/;

const replacement = `{adminTab === 'catalog' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             <div className="glass card" style={{ padding: '32px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
               <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>🟢 Greenville (Gv) カタログ同期</h3>
               <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Greenville Wiki から最新の車両データを取得し、Gv用の車両カタログデータベースを同期・更新します。</p>
               <button className="btn btn-primary" onClick={() => handleWikiSync('gv')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--primary) 0%, #00c166 100%)', border: 'none' }}>
                 <RefreshCw size={18} /> WikiからGvカタログを同期
               </button>
             </div>

             <div className="glass card" style={{ padding: '32px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
               <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>🔵 Rensselaer County (RC) カタログ同期</h3>
               <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Rensselaer County Wiki から最新の車両データを取得し、RC用の車両カタログデータベースを同期・更新します。</p>
               <button className="btn btn-primary" onClick={() => handleWikiSync('rc')} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--secondary) 0%, #0099bb 100%)', border: 'none' }}>
                 <RefreshCw size={18} /> WikiからRCカタログを同期
               </button>
             </div>
          </div>
        )}`;

if (targetRegex.test(content)) {
  content = content.replace(targetRegex, replacement);
  
  // 修復インデント
  content = content.replace(/fontWeight:\s*700,\s*\r?\n\s*borderRadius:\s*'12px',/, "fontWeight: 700,\r\n                               borderRadius: '12px',");
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log("SUCCESS: AdminDashboardView.tsx patched successfully!");
} else {
  console.log("ERROR: Target catalog section not found in AdminDashboardView.tsx");
}
