import React, { useState, useEffect, useRef } from 'react';
import { Lock, ClipboardList, RotateCcw, LayoutGrid, List, Plus, Trash2, Edit3, Search as SearchIcon } from 'lucide-react';
import { StatusBadge, CustomSortDropdown } from '../components/UIBase';
import { VehicleImageGallery } from '../components/VehicleImageGallery';
import { formatDate, parseUTCDate } from '../utils/helpers';
import { triggerHaptic } from '../utils/native';

interface MyGarageViewProps {
  myApplication: any;
  vehicles: any[];
  isLoading: boolean;
  handleManualRefresh: () => void;
  garageTab: 'car' | 'trailer';
  setGarageTab: (tab: 'car' | 'trailer') => void;
  garageViewMode: 'grid' | 'list';
  setGarageViewMode: (mode: 'grid' | 'list') => void;
  garageSortOrder: string;
  setGarageSortOrder: (order: string) => void;
  setView: (view: any) => void;
  currentUser: any;
  setShowBetaAutoFillModal: (b: boolean) => void;
  setFormData: (data: any) => void;
  setEditingVehicleId: (id: string | null) => void;
  setShowAddModal: (b: boolean) => void;
  setTrailerFormData: (data: any) => void;
  setShowTrailerModal: (b: boolean) => void;
  handleStartEdit: (v: any) => void;
  handleDeleteVehicle: (id: string) => void;
  isMobile?: boolean;
}

export const MyGarageView = ({
  myApplication,
  vehicles,
  isLoading,
  handleManualRefresh,
  garageTab,
  setGarageTab,
  garageViewMode,
  setGarageViewMode,
  garageSortOrder,
  setGarageSortOrder,
  setView,
  currentUser,
  setShowBetaAutoFillModal,
  setFormData,
  setEditingVehicleId,
  setShowAddModal,
  setTrailerFormData,
  setShowTrailerModal,
  handleStartEdit,
  handleDeleteVehicle,
  isMobile = false
}: MyGarageViewProps) => {
  const [garageSearchTerm, setGarageSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'temp'>('all');
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // FAB外タップで閉じる
  useEffect(() => {
    if (!fabOpen) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [fabOpen]);

  return (
    <>
      <div className="animate-fade">
        {myApplication?.status !== 'approved' ? (
        <div style={{ textAlign: 'center', padding: '80px 24px' }}>
          <Lock size={64} style={{ color: 'var(--text-muted)', marginBottom: '24px', opacity: 0.5 }} />
          <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-main)' }}>マイガレージはロック中</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.8 }}>車両を登録するには、まず<strong>市民申請</strong>に合格する必要があります。</p>
          <button className="btn btn-primary" onClick={() => setView('apply')} style={{ padding: '14px 32px', fontSize: '1rem' }}>
            <ClipboardList size={18} /> 市民申請へ →
          </button>
        </div>
      ) : (
        <>
          <div className="view-header">
            <div>
              <h2 style={{ fontSize: '2.4rem', marginBottom: '8px', fontWeight: 700, color: 'var(--text-main)' }}>ガレージ</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>管理中の車両一覧です。</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600 }}>
                    🚗 {vehicles.filter((v: any) => v.vehicle_type !== 'trailer').length} 台
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600 }}>
                    🚛 {vehicles.filter((v: any) => v.vehicle_type === 'trailer').length} 台
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => { triggerHaptic('medium'); handleManualRefresh(); }} style={{ padding: '10px 16px' }} disabled={isLoading}>
                <RotateCcw size={18} className={isLoading ? 'animate-spin' : undefined} strokeWidth={2.5} />
              </button>
              {/* Auto-fill beta button: desktop only, in header */}
              {garageTab === 'car' && !isMobile && (
                <button className="btn btn-secondary" onClick={() => {
                  triggerHaptic('light');
                  if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                  setShowBetaAutoFillModal(true);
                }} style={{ padding: '10px 16px', borderRadius: '12px', border: '1px dashed var(--primary)', color: 'var(--primary)', background: 'rgba(0,193,102,0.1)' }}>
                  ✨ 画像から自動登録 (Beta)
                </button>
              )}
              {/* Add button: desktop only — mobile uses FAB */}
              {!isMobile && (
                garageTab === 'car' ? (
                  <button className="btn btn-primary" onClick={() => {
                    triggerHaptic('light');
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                    setEditingVehicleId(null);
                    setShowAddModal(true);
                  }} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }}>
                    <Plus size={20} /> 車両を追加
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => {
                    triggerHaptic('light');
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setTrailerFormData({ model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                    setShowTrailerModal(true);
                  }} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', background: 'var(--primary)', color: '#000' }}>
                    <Plus size={20} /> トレーラーを追加
                  </button>
                )
              )}
            </div>
          </div>

          {/* Search Bar - Mirrored from Vehicle Lookup for consistency */}
          <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="車名、メーカー、ナンバープレートで検索..."
                value={garageSearchTerm}
                onChange={(e: any) => setGarageSearchTerm(e.target.value)}
                className="glass"
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: 'none', background: 'var(--panel-bg)', color: 'var(--text-main)', fontSize: '0.95rem', outline: 'none' }}
              />
            </div>
          </div>

          {/* Filter Tags */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px', background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: '80px' }}>ステータス:</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'すべて', className: '' },
                  { id: 'approved', label: '承認済み', className: 'success' },
                  { id: 'pending', label: '審査中', className: 'warning' },
                  { id: 'rejected', label: '却下', className: 'error' },
                  { id: 'temp', label: '仮承認', className: 'info' }
                ].map(tag => {
                  const active = statusFilter === tag.id;
                  return (
                    <button
                      key={tag.id}
                      onClick={() => { triggerHaptic('light'); setStatusFilter(tag.id as any); }}
                      className={`filter-tag-btn ${active ? `active ${tag.className}` : ''}`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tab switcher and Controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '24px', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '6px', borderRadius: '14px', width: 'fit-content', border: '1px solid var(--glass-border)' }}>
              {([['car', '🚗 マイカー'], ['trailer', '🚛 トレーラー']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => { triggerHaptic('light'); setGarageTab(tab); }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '10px',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: '0.2s',
                    background: garageTab === tab ? 'var(--primary)' : 'transparent',
                    color: garageTab === tab ? '#000' : 'var(--text-muted)',
                    fontSize: '0.95rem'
                  }}
                >{label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', background: 'var(--panel-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)', height: '42px' }}>
                 <button onClick={() => { triggerHaptic('light'); setGarageViewMode('grid'); }} className="btn" style={{ padding: '8px', background: garageViewMode === 'grid' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: garageViewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)' }} title="グリッド表示">
                   <LayoutGrid size={20} />
                 </button>
                 <button onClick={() => { triggerHaptic('light'); setGarageViewMode('list'); }} className="btn" style={{ padding: '8px', background: garageViewMode === 'list' ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', borderRadius: '8px', color: garageViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)' }} title="リスト表示">
                   <List size={20} />
                 </button>
              </div>
              <CustomSortDropdown 
                value={garageSortOrder}
                onChange={(val) => { triggerHaptic('light'); setGarageSortOrder(val); }}
                options={[
                  { id: 'newest', label: '登録順 (新しい順)' },
                  { id: 'oldest', label: '登録順 (古い順)' },
                  { id: 'maker', label: 'メーカー順 (A-Z)' }
                ]}
              />
            </div>
          </div>
          

          <div className={garageViewMode === 'grid' ? "card-grid" : "list-view"}>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="glass card" style={{ padding: '0', borderRadius: '16px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '400px' }}>
                  <div className="skeleton" style={{ height: '200px', width: '100%' }} />
                  <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                    <div>
                      <div className="skeleton skeleton-text" style={{ width: '40%', marginBottom: '8px' }} />
                      <div className="skeleton skeleton-title" style={{ width: '70%', marginBottom: '12px' }} />
                      <div className="skeleton skeleton-text short" style={{ width: '30%' }} />
                    </div>
                    <div style={{ marginTop: 'auto', display: 'flex', gap: '16px' }}>
                      <div className="skeleton skeleton-rect" style={{ flex: 1, height: '44px', borderRadius: '12px' }} />
                      <div className="skeleton skeleton-rect" style={{ flex: 1, height: '44px', borderRadius: '12px' }} />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              vehicles
                .filter(v => {
                  const typeMatch = (v as any).vehicle_type === garageTab || (!(v as any).vehicle_type && garageTab === 'car');
                  if (!typeMatch) return false;
                  
                  // Status filter
                  if (statusFilter !== 'all') {
                    if (statusFilter === 'approved' && v.status !== 'approved' && v.status !== 'approved_warning') return false;
                    if (statusFilter === 'pending' && v.status !== 'pending') return false;
                    if (statusFilter === 'rejected' && v.status !== 'rejected') return false;
                    if (statusFilter === 'temp' && v.status !== 'temp_approved') return false;
                  }

                  if (!garageSearchTerm.trim()) return true;
                  const q = garageSearchTerm.toLowerCase();
                  return (
                    (v.maker || '').toLowerCase().includes(q) ||
                    (v.model || '').toLowerCase().includes(q) ||
                    (v.plate || '').toLowerCase().includes(q) ||
                    (v.trim || '').toLowerCase().includes(q) ||
                    (v.color || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  if (garageSortOrder === 'newest') return parseUTCDate(b.created_at).getTime() - parseUTCDate(a.created_at).getTime();
                  if (garageSortOrder === 'oldest') return parseUTCDate(a.created_at).getTime() - parseUTCDate(b.created_at).getTime();
                  if (garageSortOrder === 'maker') return (a.maker || '').localeCompare(b.maker || '');
                  return 0;
                })
                .map(v => (
                <div key={v.id} className="glass card garage-card animate-fade">
                  <div className="garage-card-image"><VehicleImageGallery vehicleId={v.id} imageData={v.image_data} fallbackQuery={`${v.year} ${v.maker} ${v.model}`} targetTrim={v.trim} /></div>
                  <div className="garage-card-body">
                    <div className="garage-card-header">
                      <div>
                        <div className="garage-card-meta">{(v as any).vehicle_type === 'trailer' ? '🚛 ' : ''}{v.year ? `${v.year} ` : ''}{v.maker}</div>
                        <h3 className="garage-card-title">{v.model}</h3>
                        <div className="garage-card-date">申請: {formatDate(v.created_at)}</div>
                      </div>
                      <div className="garage-card-status">
                        <StatusBadge status={v.status} reason={v.reject_reason} tempExpiresAt={v.temp_expires_at} />
                      </div>
                    </div>
                    {v.status === 'rejected' && v.reject_reason && (
                      <div style={{ padding: '16px', background: 'rgba(239,68,68,0.1)', borderLeft: '4px solid var(--error)', borderRadius: '4px', marginBottom: '24px', color: 'var(--error)' }}>
                        <strong>却下理由:</strong> {v.reject_reason}
                      </div>
                    )}
                    {v.status === 'approved_warning' && v.reject_reason && (
                      <div style={{ padding: '16px', background: 'rgba(255,161,20,0.1)', borderLeft: '4px solid #FFA114', borderRadius: '4px', marginBottom: '24px', color: '#FFA114' }}>
                        <strong>非推奨理由:</strong> {v.reject_reason}
                      </div>
                    )}

                    <div className="garage-card-fields">
                      <div>
                        <div className="garage-card-field-title">{(v as any).vehicle_type === 'trailer' ? 'TRAILER TYPE' : 'GRADE / TRIM'}</div>
                        <div className="garage-card-field-value">{(v as any).vehicle_type === 'trailer' ? ((v as any).trailer_type || '---') : (v.trim || '---')}</div>
                      </div>
                      <div>
                        <div className="garage-card-field-title">COLOR</div>
                        <div className="garage-card-field-value">{v.color || '---'}</div>
                      </div>
                    </div>

                    <div className="garage-card-footer">
                      <div className="garage-card-plate-section">
                        <div className="garage-card-plate-title">LICENSE PLATE</div>
                        <div className="garage-card-plate">
                          <div className="garage-card-plate-region">
                            {v.plate_region || 'WISCONSIN'}
                          </div>
                          <div className="garage-card-plate-number">
                            {v.plate || 'ABC-1234'}
                          </div>
                        </div>
                       </div>

                      <div className="garage-card-actions">
                        <button className="btn btn-secondary" onClick={() => handleStartEdit(v)}>
                          <Edit3 size={16} /> 編集
                        </button>
                        <button className="btn btn-secondary btn-delete" onClick={() => handleDeleteVehicle(v.id)} style={{ color: 'var(--error)' }}>
                          <Trash2 size={16} /> 削除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {!isLoading && vehicles.filter(v => (v as any).vehicle_type === garageTab || (!(v as any).vehicle_type && garageTab === 'car')).length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px dashed var(--glass-border)' }}>
              {garageTab === 'car' ? 'ガレージに車両がありません。「車両を追加」ボタンから登録してください。' : '登録済みのトレーラーがありません。「トレーラーを追加」ボタンから登録してください。'}
            </div>
          )}
        </>
      )}
      </div>

      {/* ====== Mobile FAB Speed Dial ====== */}
      {isMobile && myApplication?.status === 'approved' && (
        <div ref={fabRef} style={{ position: 'fixed', bottom: '88px', right: '16px', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>

          {/* Speed Dial Items */}
          {fabOpen && (
            <>
              {/* 画像から自動登録 (Beta) — only for cars */}
              {garageTab === 'car' && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    animation: 'fabItemIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
                    animationDelay: '0.04s',
                  }}
                >
                  <span style={{
                    background: 'var(--panel-bg)', border: '1px solid var(--glass-border)',
                    color: 'var(--text-main)', padding: '7px 14px', borderRadius: '20px',
                    fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(12px)',
                  }}>✨ 画像から自動登録 (Beta)</span>
                  <button
                    onClick={() => {
                      setFabOpen(false);
                      triggerHaptic('light');
                      if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                      setShowBetaAutoFillModal(true);
                    }}
                    style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'rgba(0,255,136,0.15)', border: '1.5px dashed var(--primary)',
                      color: 'var(--primary)', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', fontSize: '1.2rem',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.3)', flexShrink: 0,
                    }}
                    aria-label="画像から自動登録"
                  >✨</button>
                </div>
              )}

              {/* 手動登録 */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  animation: 'fabItemIn 0.18s cubic-bezier(0.34,1.56,0.64,1) both',
                }}
              >
                <span style={{
                  background: 'var(--panel-bg)', border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)', padding: '7px 14px', borderRadius: '20px',
                  fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(12px)',
                }}>{garageTab === 'car' ? '🚗 手動登録' : '🚛 手動登録'}</span>
                <button
                  onClick={() => {
                    setFabOpen(false);
                    triggerHaptic('medium');
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    if (garageTab === 'car') {
                      setFormData({ maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                      setEditingVehicleId(null);
                      setShowAddModal(true);
                    } else {
                      setTrailerFormData({ model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                      setShowTrailerModal(true);
                    }
                  }}
                  style={{
                    width: '48px', height: '48px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #00c166 100%)',
                    color: '#000', border: 'none', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                    boxShadow: '0 2px 12px rgba(0,255,136,0.3)', flexShrink: 0,
                    fontSize: '1.3rem',
                  }}
                  aria-label={garageTab === 'car' ? '車両を手動登録' : 'トレーラーを手動登録'}
                >✏️</button>
              </div>
            </>
          )}

          {/* Main FAB button */}
          <button
            onClick={() => {
              triggerHaptic('medium');
              if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
              setFabOpen(prev => !prev);
            }}
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: fabOpen
                ? 'rgba(255,255,255,0.12)'
                : 'linear-gradient(135deg, var(--primary) 0%, #00c166 100%)',
              color: fabOpen ? 'var(--text-main)' : '#000',
              border: fabOpen ? '1.5px solid var(--glass-border)' : 'none',
              boxShadow: fabOpen
                ? '0 2px 16px rgba(0,0,0,0.4)'
                : '0 4px 20px rgba(0,255,136,0.45), 0 2px 8px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.22s cubic-bezier(0.34,1.56,0.64,1)',
              transform: fabOpen ? 'rotate(45deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
            onTouchStart={e => { if (!fabOpen) e.currentTarget.style.transform = 'scale(0.91)'; }}
            onTouchEnd={e => { if (!fabOpen) e.currentTarget.style.transform = 'scale(1)'; }}
            title={garageTab === 'car' ? '車両を追加' : 'トレーラーを追加'}
            aria-label={fabOpen ? 'メニューを閉じる' : (garageTab === 'car' ? '車両を追加' : 'トレーラーを追加')}
            aria-expanded={fabOpen}
          >
            <Plus size={24} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}
    </>
  );
};
