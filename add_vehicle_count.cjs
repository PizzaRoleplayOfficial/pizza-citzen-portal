const fs = require('fs');
const filePath = 'src/views/AdminDashboardView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1) ヘッダーに「登録台数」カラムを追加
content = content.replace(
  `                   <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                     <th style={{ padding: '20px' }}>ユーザー</th>
                     <th style={{ padding: '20px' }}>役職</th>
                     <th style={{ padding: '20px' }}>操作</th>
                   </tr>`,
  `                   <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                     <th style={{ padding: '20px' }}>ユーザー</th>
                     <th style={{ padding: '20px' }}>登録台数</th>
                     <th style={{ padding: '20px' }}>役職</th>
                     <th style={{ padding: '20px' }}>操作</th>
                   </tr>`
);

// 2) 各行に台数セルを追加（役職セルの前に挿入）
content = content.replace(
  `                       </td>
                       <td style={{ padding: '20px' }}>
                         <span style={{ color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>{u.role === 'admin' ? '管理者' : '一般'}</span>
                       </td>`,
  `                       </td>
                       <td style={{ padding: '20px' }}>
                         {(() => {
                           const count = allSearchVehicles.filter((v: any) => v.owner_id === u.id).length;
                           return (
                             <span
                               style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', background: count > 0 ? 'rgba(0,193,102,0.1)' : 'rgba(255,255,255,0.05)', border: count > 0 ? '1px solid rgba(0,193,102,0.3)' : '1px solid rgba(255,255,255,0.08)', color: count > 0 ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', cursor: count > 0 ? 'pointer' : 'default' }}
                               onClick={() => count > 0 && handleViewUserVehicles({ id: u.id, roblox_username: u.roblox_username || '' })}
                             >
                               🚗 {count} 台
                             </span>
                           );
                         })()}
                       </td>
                       <td style={{ padding: '20px' }}>
                         <span style={{ color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>{u.role === 'admin' ? '管理者' : '一般'}</span>
                       </td>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done: Added vehicle count column to user table');
