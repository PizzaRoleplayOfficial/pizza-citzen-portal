import React, { useState, useEffect, useRef } from 'react';
import { Lock, ClipboardList, RotateCcw, LayoutGrid, List, Plus, Trash2, Edit3, Search as SearchIcon, Loader2 } from 'lucide-react';
import { StatusBadge, CustomSortDropdown } from '../components/UIBase';
import { VehicleImageGallery } from '../components/VehicleImageGallery';
import { formatDate, parseUTCDate } from '../utils/helpers';
import { triggerHaptic } from '../utils/native';

export const GarageTiltCard = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.5s ease',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((centerY - y) / centerY) * 10; // Max 10 degrees
    const rotateY = ((x - centerX) / centerX) * 10;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: 'transform 0.1s ease-out, box-shadow 0.1s ease-out',
      boxShadow: '0 20px 45px rgba(0, 0, 0, 0.55), 0 0 20px rgba(0, 193, 102, 0.08)',
      zIndex: 10
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.5s ease',
      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
    });
  };

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        ...tiltStyle,
        position: 'relative'
      }}
    >
      {children}
    </div>
  );
};

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
  dataSaverEnabled?: boolean;
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
  isMobile = false,
  dataSaverEnabled = false
}: MyGarageViewProps) => {
  const [activeGame, setActiveGame] = useState<'gv' | 'rc'>('gv');
  const [garageSearchTerm, setGarageSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'temp'>('all');
  const [fabOpen, setFabOpen] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);

  // Pull-to-refresh swipe gesture states
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart !== null && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStart;
      if (diff > 0) {
        setPullProgress(Math.min(diff / 2, 80)); // Cap progress at 80px pull
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullProgress >= 60) {
      triggerHaptic('light');
      handleManualRefresh();
    }
    setTouchStart(null);
    setPullProgress(0);
  };

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
      <div 
        className="animate-fade"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh swipe indicator on mobile */}
        {isMobile && pullProgress > 0 && (
          <div style={{
            height: `${pullProgress}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            transition: touchStart === null ? 'height 0.2s ease' : 'none',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '16px',
            border: '1px solid var(--glass-border)',
            color: 'var(--primary)',
            fontSize: '0.85rem',
            fontWeight: 700,
            gap: '8px',
            marginBottom: '16px'
          }}>
            <Loader2 size={16} className={pullProgress >= 60 ? 'animate-spin' : undefined} />
            {pullProgress >= 60 ? '指を離して更新...' : '下に引っぱって更新...'}
          </div>
        )}
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
                    🚗 {vehicles.filter((v: any) => v.vehicle_type !== 'trailer' && (v.game_type || 'gv') === activeGame).length} 台
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', fontSize: '0.8rem', fontWeight: 600 }}>
                    🚛 {vehicles.filter((v: any) => v.vehicle_type === 'trailer' && (v.game_type || 'gv') === activeGame).length} 台
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {!isMobile && (
                <button className="btn btn-secondary" onClick={() => { triggerHaptic('medium'); handleManualRefresh(); }} style={{ padding: '10px 16px' }} disabled={isLoading}>
                  <RotateCcw size={18} className={isLoading ? 'animate-spin' : undefined} strokeWidth={2.5} />
                </button>
              )}
              {/* Auto-fill beta button: desktop only, in header */}
              {garageTab === 'car' && !isMobile && (
                <button className="btn btn-secondary" onClick={() => {
                  triggerHaptic('light');
                  if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                      setFormData(prev => ({ ...prev, game_type: activeGame }));
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
                    setFormData({ game_type: activeGame, maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                    setEditingVehicleId(null);
                    setShowAddModal(true);
                  }} style={{ padding: '10px 24px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }}>
                    <Plus size={20} /> 車両を追加
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => {
                    triggerHaptic('light');
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setTrailerFormData({ game_type: activeGame, model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
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
                garageViewMode === 'grid' ? (
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
                ) : (
                  <div key={i} className="glass card garage-card animate-fade" style={{ background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="garage-card-image">
                      <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                    </div>
                    <div className="garage-card-body">
                      <div className="garage-card-header">
                        <div style={{ flex: 1 }}>
                          <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: '8px' }} />
                          <div className="skeleton skeleton-title" style={{ width: '60%', marginBottom: '8px' }} />
                          <div className="skeleton skeleton-text short" style={{ width: '20%' }} />
                        </div>
                        <div className="skeleton skeleton-rect" style={{ width: '80px', height: '24px', borderRadius: '8px' }} />
                      </div>
                      <div className="garage-card-fields">
                        <div>
                          <div className="skeleton skeleton-text" style={{ width: '50px', height: '12px' }} />
                        </div>
                        <div>
                          <div className="skeleton skeleton-text" style={{ width: '50px', height: '12px' }} />
                        </div>
                      </div>
                      <div className="garage-card-footer">
                        <div className="garage-card-plate-section">
                          <div className="skeleton skeleton-rect" style={{ width: '120px', height: '36px', borderRadius: '6px' }} />
                        </div>
                        <div className="garage-card-actions">
                          <div className="skeleton skeleton-rect" style={{ width: '70px', height: '36px', borderRadius: '8px' }} />
                          <div className="skeleton skeleton-rect" style={{ width: '70px', height: '36px', borderRadius: '8px' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ))
            ) : (
              vehicles
                .filter(v => {
                  const typeMatch = (v as any).vehicle_type === garageTab || (!(v as any).vehicle_type && garageTab === 'car');
                  if (!typeMatch) return false;
                  
                  // Game type filter (Greenville / RC)
                  const gameMatch = (v.game_type || 'gv') === activeGame;
                  if (!gameMatch) return false;
                  
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
                <GarageTiltCard key={v.id} className="glass card garage-card animate-fade">
                  <div className="garage-card-image"><VehicleImageGallery vehicleId={v.id} imageData={v.image_data} fallbackQuery={`${v.year} ${v.maker} ${v.model}`} targetTrim={v.trim} dataSaverEnabled={dataSaverEnabled} /></div>
                  <div className="garage-card-body">
                    <div className="garage-card-header">
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
                </GarageTiltCard>
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

      {/* Disable duplicate mobile FAB since it is integrated into bottom nav bar */}
      {false && isMobile && myApplication?.status === 'approved' && (
        <div ref={fabRef} style={{ position: 'fixed', bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))', right: '24px', zIndex: 1001, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>

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
                      setFormData({ game_type: activeGame, maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                      setEditingVehicleId(null);
                      setShowAddModal(true);
                    } else {
                      setTrailerFormData({ game_type: activeGame, model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
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
              width: '64px',
              height: '64px',
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
            <Plus size={28} strokeWidth={3} style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}
    </>
  );
};
