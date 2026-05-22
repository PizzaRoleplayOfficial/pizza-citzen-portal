const fs = require('fs');
const filePath = 'src/views/AdminDashboardView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add states
const stateTarget = `  const [lookupSortOpen, setLookupSortOpen] = useState(false);`;
const newStates = `  const [lookupSortOpen, setLookupSortOpen] = useState(false);
  const [userSortOrder, setUserSortOrder] = useState('newest');
  const [selectedUserDetailsId, setSelectedUserDetailsId] = useState<string | null>(null);`;
content = content.replace(stateTarget, newStates);

// 2. Add Modal UI at the end, just before `</div>\n    </div>\n  );\n}`
// Wait, I will just append it before the very last `</div>`
const modalUI = `      {/* User Details Modal */}
      {selectedUserDetailsId && (() => {
        const u = allUsers.find(x => x.id === selectedUserDetailsId);
        if (!u) return null;
        const count = allSearchVehicles.filter((v: any) => v.owner_id === u.id).length;
        const userVehicles = allSearchVehicles.filter((v: any) => v.owner_id === u.id);
        const userApp = allApplications.find((a: any) => a.user_id === u.id);

        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '16px' : '40px' }}>
            <div onClick={() => setSelectedUserDetailsId(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
            <div className="glass card animate-fade" style={{ position: 'relative', width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', background: 'var(--panel-bg)', borderRadius: '24px', padding: isMobile ? '20px' : '40px' }}>
              
              <button 
                onClick={() => setSelectedUserDetailsId(null)}
                style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--text-main)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
              >
                <X size={20} />
              </button>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                <UserIcon size={24} style={{ color: 'var(--primary)' }} /> ユーザー詳細
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
                {/* Profile Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-muted)' }}>プロフィール</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <img src={u.avatar} style={{ width: '64px', height: '64px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.1)' }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{u.username}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Discord ID: {u.id}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Roblox ID</span>
                      <span style={{ fontWeight: 700 }}>{u.roblox_username || '未設定'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>登録台数</span>
                      <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{count} 台</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>役職</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-main)', fontWeight: 700 }}>{u.role === 'admin' ? '管理者' : '一般ユーザー'}</span>
                        {u.id !== currentUser.id && (
                             <button className="btn btn-secondary" onClick={() => handleUpdateRole(u.id, u.role === 'admin' ? 'user' : 'admin')} style={{ padding: '4px 8px', fontSize: '0.75rem' }}>
                               {u.role === 'admin' ? '降格' : '昇格'}
                             </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Application Section */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-muted)' }}>市民申請ステータス</h3>
                  {userApp ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>ステータス</div>
                        <StatusBadge status={userApp.status} reason={userApp.reject_reason} />
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>自動採点スコア</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{userApp.auto_score !== null ? \`\${userApp.auto_score} / \${userApp.auto_score_max}\` : 'N/A'}</div>
                      </div>
                      <div style={{ marginBottom: 'auto' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>申請日時</div>
                        <div style={{ fontSize: '0.95rem' }}>{formatDate(userApp.created_at || userApp.submitted_at)}</div>
                      </div>

                      {userApp.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                          <button className="btn btn-primary" onClick={() => handleReviewApplication(userApp.user_id, 'approved')} style={{ flex: 1, padding: '10px' }}>承認する</button>
                          <button className="btn btn-secondary" onClick={() => handleReviewApplication(userApp.user_id, 'rejected')} style={{ flex: 1, padding: '10px', color: 'var(--error)' }}>却下する</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>
                      <ClipboardList size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                      <p>申請記録がありません</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicles Section */}
              <div style={{ marginTop: '24px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-muted)' }}>保有車両リスト</h3>
                  {count > 0 && (
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => { setSelectedUserDetailsId(null); handleViewUserVehicles({ id: u.id, roblox_username: u.roblox_username || '' }); }}
                      style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                    >
                      <SearchIcon size={14} /> 車両検索で全て見る
                    </button>
                  )}
                </div>

                {count > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {userVehicles.map((v: any) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '80px', height: '50px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, position: 'relative' }}>
                          <VehicleImageGallery imageData={v.image_data} fallbackQuery={\`\${v.year} \${v.maker} \${v.model}\`} targetTrim={v.trim} containerHeight="100%" />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '4px' }}>{v.year} {v.maker} {v.model}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', background: '#fff', color: '#000', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{v.plate}</span>
                            <StatusBadge status={v.status} reason={v.reject_reason} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>保有車両はありません</div>
                )}
              </div>

            </div>
          </div>
        );
      })()}`;

const endOfFileTarget = `    </div>
  );
};`;
content = content.replace(endOfFileTarget, `${modalUI}\n${endOfFileTarget}`);


// 3. Replace the old users tab
// I will grab the block correctly. Wait, regex matching might be safer if line formatting is unpredictable.
// Using string split and matching
let result = '';
// Actually, let me just build the new users UI block and replace the old one.
const oldUsersTabRegex = /\{adminTab === 'users' && \(\s*<div className="animate-fade">[\s\S]*?<\/div>[\s\r\n]*\)\}/;

const newUsersTab = `{adminTab === 'users' && (
          <div className="animate-fade">
             {/* Controls Bar for Users */}
             <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
               <div style={{ position: 'relative', flex: 1 }}>
                 <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                 <input type="text" placeholder="ユーザー名、Roblox ID、Discord ID..." value={userSearchTerm} onChange={e => setUserSearchTerm(e.target.value)} className="glass" style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: 'none', background: 'var(--panel-bg)' }} />
               </div>
             </div>

             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '6px', borderRadius: '14px', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
                 <button onClick={() => setUsersViewMode('grid')} className="btn" style={{ padding: '8px', background: usersViewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: usersViewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)' }} title="グリッド表示">
                   <LayoutGrid size={20} />
                 </button>
                 <button onClick={() => setUsersViewMode('list')} className="btn" style={{ padding: '8px', background: usersViewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: usersViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)' }} title="リスト表示">
                   <List size={20} />
                 </button>
               </div>
               <CustomSortDropdown 
                 value={userSortOrder}
                 onChange={setUserSortOrder}
                 options={[
                   { id: 'newest', label: '登録順(新しい順)' },
                   { id: 'oldest', label: '登録順(古い順)' },
                   { id: 'name', label: 'ユーザー名順(A-Z)' },
                   { id: 'vehicles', label: '保有車両数順' },
                   { id: 'role', label: '役職順' }
                 ]}
               />
             </div>

             <div className={usersViewMode === 'grid' ? "card-grid" : "list-view"}>
               {allUsers.filter(u => {
                 const s = userSearchTerm.toLowerCase();
                 return (u.username?.toLowerCase().includes(s) || u.roblox_username?.toLowerCase().includes(s) || u.id.includes(s));
               }).sort((a, b) => {
                 if (userSortOrder === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
                 if (userSortOrder === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                 if (userSortOrder === 'name') return (a.username || '').localeCompare(b.username || '');
                 if (userSortOrder === 'vehicles') {
                   const countA = allSearchVehicles.filter((v: any) => v.owner_id === a.id).length;
                   const countB = allSearchVehicles.filter((v: any) => v.owner_id === b.id).length;
                   return countB - countA;
                 }
                 if (userSortOrder === 'role') return a.role === 'admin' ? -1 : 1;
                 return 0;
               }).map(u => {
                 const isList = usersViewMode === 'list';
                 const count = allSearchVehicles.filter((v: any) => v.owner_id === u.id).length;
                 const userApp = allApplications.find((a: any) => a.user_id === u.id);
                 
                 return (
                   <div key={u.id} className="glass card view-anim" style={{ 
                     padding: isList ? (isMobile ? '16px' : '20px') : '24px', 
                     borderRadius: '20px', 
                     display: 'flex', 
                     flexDirection: isList ? (isMobile ? 'column' : 'row') : 'column', 
                     alignItems: isList && !isMobile ? 'center' : 'stretch',
                     gap: '16px',
                     border: '1px solid var(--glass-border)'
                   }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: isList && !isMobile ? 2 : 'none' }}>
                       <img src={u.avatar} style={{ width: isList ? '48px' : '64px', height: isList ? '48px' : '64px', borderRadius: '12px' }} />
                       <div>
                         <div style={{ fontWeight: 800, fontSize: isList ? '1.1rem' : '1.2rem', marginBottom: '4px' }}>{u.username}</div>
                         <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.roblox_username ? \`\${u.roblox_username}\` : 'Roblox ID未設定'}</div>
                       </div>
                     </div>
                     
                     <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', flex: isList && !isMobile ? 3 : 'none', justifyContent: isList && !isMobile ? 'space-between' : 'flex-start' }}>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>役職</span>
                         <span style={{ fontSize: '0.85rem', fontWeight: 700, color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-main)' }}>{u.role === 'admin' ? '管理者' : '一般'}</span>
                       </div>
                       
                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>市民申請</span>
                         {userApp ? (
                           <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center', margin: '-4px 0 -8px 0' }}>
                             <StatusBadge status={userApp.status} reason={userApp.reject_reason} />
                           </div>
                         ) : (
                           <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>未申請</span>
                         )}
                       </div>

                       <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>車両</span>
                         <span style={{ fontSize: '0.85rem', fontWeight: 700, color: count > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>🚗 {count} 台</span>
                       </div>
                     </div>

                     <div style={{ marginLeft: isList && !isMobile ? 'auto' : '0', marginTop: isList && !isMobile ? '0' : '8px' }}>
                       <button 
                         className="btn btn-primary" 
                         onClick={() => setSelectedUserDetailsId(u.id)} 
                         style={{ width: isList && !isMobile ? 'auto' : '100%', padding: '10px 20px', fontSize: '0.9rem', justifyContent: 'center' }}
                       >
                         詳細を見る
                       </button>
                     </div>
                   </div>
                 );
               })}
             </div>
          </div>
        )}`;

content = content.replace(oldUsersTabRegex, newUsersTab);

if (!content.includes(newUsersTab.slice(0, 100))) {
  console.error("REGEX MATCH FAILED! Trying substring match.");
  // try basic slice replace
  const startStr = "{adminTab === 'users' && (";
  const endStr = `        {adminTab === 'catalog' && (`;
  const startIdx = content.indexOf(startStr);
  const endIdx = content.indexOf(endStr);
  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx);
    content = before + newUsersTab + "\n\n  " + after;
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully wrote AdminDashboardView.tsx modifications.');
