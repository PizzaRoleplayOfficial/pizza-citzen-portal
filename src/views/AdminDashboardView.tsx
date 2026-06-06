import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users as UserIcon, 
  Car, 
  ClipboardList, 
  Search as SearchIcon, 
  BookOpen, 
  RefreshCw, 
  RotateCcw,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  X,
  Plus,
  Edit3,
  Menu,
  ShieldCheck,
  Home,
  LayoutGrid,
  Clock,
  List,
  Trash2,
  AlertTriangle,
  Activity,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { StatusBadge, CustomSortDropdown } from '../components/UIBase';
import { VehicleImageGallery } from '../components/VehicleImageGallery';
import { formatDate, parseUTCDate } from '../utils/helpers';
import { DashboardCharts } from '../components/DashboardCharts';
import { handleAvatarError } from '../utils/avatarFallback';
import { triggerHaptic } from '../utils/native';

interface AdminDashboardViewProps {
  adminTab: string;
  setAdminTabPersist: (tab: any) => void;
  vehicles: any[];
  allSearchVehicles: any[];
  allUsers: any[];
  allApplications: any[];
  allQuestionsAdmin: any[];
  editingQuestion: any;
  setEditingQuestion: (q: any) => void;
  isLoading: boolean;
  isMobile: boolean;
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
  handleManualRefresh: () => void;
  handleUpdateStatus: (id: string, status: string, days?: number) => void;
  handleDeleteVehicle: (id: string) => void;
  handleUpdateRole: (id: string, role: string) => void;
  handleReviewApplication: (userId: string, status: string, reason?: string) => void;
  handleWikiSync: (gameType: 'gv' | 'rc') => void;
  handleSaveQuestion: (q: any) => void;
  handleToggleQuestion: (id: string, active: number) => void;
  currentUser: any;
  setView: (view: string) => void;
  // Local states for sub-tabs if needed
  selectedUserForVehicles: any;
  setSelectedUserForVehicles: (user: any) => void;
  adminSearchTerm: string;
  setAdminSearchTerm: (term: string) => void;
  adminSortOrder: string;
  setAdminSortOrder: (order: string) => void;
  userSearchTerm: string;
  setUserSearchTerm: (term: string) => void;
  usersViewMode: 'grid' | 'list';
  setUsersViewMode: (mode: 'grid' | 'list') => void;
  lookupViewMode: 'grid' | 'list';
  setLookupViewMode: (mode: 'grid' | 'list') => void;
}

export const AdminDashboardView = ({
  adminTab,
  setAdminTabPersist,
  vehicles,
  allSearchVehicles,
  allUsers,
  allApplications,
  allQuestionsAdmin,
  editingQuestion,
  setEditingQuestion,
  isLoading,
  isMobile,
  showMobileMenu,
  setShowMobileMenu,
  handleManualRefresh,
  handleUpdateStatus,
  handleDeleteVehicle,
  handleUpdateRole,
  handleReviewApplication,
  handleWikiSync,
  handleSaveQuestion,
  handleToggleQuestion,
  currentUser,
  setView,
  selectedUserForVehicles,
  setSelectedUserForVehicles,
  adminSearchTerm,
  setAdminSearchTerm,
  adminSortOrder,
  setAdminSortOrder,
  userSearchTerm,
  setUserSearchTerm,
  usersViewMode,
  setUsersViewMode,
  lookupViewMode,
  setLookupViewMode
}: AdminDashboardViewProps) => {
  const [lookupSortOpen, setLookupSortOpen] = useState(false);
  const [lookupStatusFilter, setLookupStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'temp'>('all');
  const [adminGameFilter, setAdminGameFilter] = useState<'all' | 'gv' | 'rc'>('all');
  const [lookupTypeFilter, setLookupTypeFilter] = useState<'all' | 'car' | 'trailer'>('all');
  const [showAllActivities, setShowAllActivities] = useState(false);

  const contentRef = React.useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (contentRef.current && contentRef.current.scrollTop === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart !== null && contentRef.current && contentRef.current.scrollTop === 0) {
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

  React.useEffect(() => {
    if (!isMobile) {
      setShowMobileMenu(true);
    } else {
      setShowMobileMenu(false);
    }
  }, [isMobile, setShowMobileMenu]);
  const [tempApproveVehicle, setTempApproveVehicle] = useState<any | null>(null);
  const [tempDays, setTempDays] = useState<number>(15);

  const handleOpenTempApproveModal = (v: any) => {
    setTempApproveVehicle(v);
    setTempDays(15);
  };


  const getEditingAnswerArray = (q: any) => {
    try {
      const a = JSON.parse(q.answer || 'null');
      return Array.isArray(a) ? a : [a].filter(Boolean);
    } catch {
      return [q.answer].filter(Boolean);
    }
  };

  const handleViewUserVehicles = (user: { id: string, roblox_username: string }) => {
    setSelectedUserForVehicles(user);
    setAdminTabPersist('lookup');
    if (isMobile) setShowMobileMenu(false);
  };

  const getRelativeTimeString = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'たった今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays === 1) return '昨日';
    if (diffDays < 7) return `${diffDays}日前`;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const activities = React.useMemo(() => {
    const list: Array<{
      id: string;
      type: 'vehicle_pending' | 'vehicle_approved' | 'vehicle_rejected' | 'vehicle_temp' | 'vehicle_warning' | 'app_pending' | 'app_approved' | 'app_rejected';
      timestamp: Date;
      title: string;
      description: string;
      user: string;
      details?: string;
    }> = [];

    // 1. 車両データからの抽出
    if (Array.isArray(allSearchVehicles)) {
      allSearchVehicles
        .filter(v => adminGameFilter === 'all' || v.game_type === adminGameFilter)
        .forEach(v => {
        const submitTime = v.created_at ? parseUTCDate(v.created_at) : new Date();
        const reviewTime = v.reviewed_at ? parseUTCDate(v.reviewed_at) : (v.created_at ? parseUTCDate(v.created_at) : new Date());
        const makerModel = `${v.year} ${v.maker} ${v.model}`;
        const plateInfo = v.plate ? `[${v.plate}]` : '';

        if (v.status === 'pending') {
          list.push({
            id: `v-pend-${v.id}`,
            type: 'vehicle_pending',
            timestamp: submitTime,
            title: '車両申請 (審査待ち)',
            description: `${v.roblox_username} さんが新しい車両 ${makerModel} ${plateInfo} の承認申請を送信しました。`,
            user: v.roblox_username,
          });
        } else if (v.status === 'approved') {
          list.push({
            id: `v-appr-${v.id}`,
            type: 'vehicle_approved',
            timestamp: reviewTime,
            title: '車両完全承認',
            description: `${v.roblox_username} さんの ${makerModel} ${plateInfo} が完全承認されました。`,
            user: v.roblox_username,
          });
        } else if (v.status === 'approved_warning') {
          list.push({
            id: `v-warn-${v.id}`,
            type: 'vehicle_warning',
            timestamp: reviewTime,
            title: '車両承認 (非推奨)',
            description: `${v.roblox_username} さんの ${makerModel} ${plateInfo} が非推奨車両として承認されました。`,
            user: v.roblox_username,
          });
        } else if (v.status === 'rejected') {
          list.push({
            id: `v-rej-${v.id}`,
            type: 'vehicle_rejected',
            timestamp: reviewTime,
            title: '車両申請却下',
            description: `${v.roblox_username} さんの ${makerModel} ${plateInfo} の申請が却下されました。`,
            user: v.roblox_username,
            details: v.reject_reason || undefined
          });
        } else if (v.status === 'temp_approved' || v.status === 'temp') {
          list.push({
            id: `v-temp-${v.id}`,
            type: 'vehicle_temp',
            timestamp: reviewTime,
            title: '車両仮承認',
            description: `${v.roblox_username} さんの ${makerModel} ${plateInfo} が仮ナンバーとして承認されました。`,
            user: v.roblox_username,
          });
        }
      });
    }

    // 2. 市民申請からの抽出
    if (Array.isArray(allApplications)) {
      allApplications.forEach(app => {
        const submitTime = app.submitted_at ? parseUTCDate(app.submitted_at) : (app.created_at ? parseUTCDate(app.created_at) : new Date());
        
        if (app.status === 'pending') {
          list.push({
            id: `app-pend-${app.user_id}`,
            type: 'app_pending',
            timestamp: submitTime,
            title: '市民申請 (未審査)',
            description: `${app.roblox_username} さんが新規市民申請を送信しました。`,
            user: app.roblox_username,
          });
        } else if (app.status === 'approved') {
          const reviewTime = app.reviewed_at ? parseUTCDate(app.reviewed_at) : submitTime;
          list.push({
            id: `app-appr-${app.user_id}`,
            type: 'app_approved',
            timestamp: reviewTime,
            title: '市民権承認',
            description: `${app.roblox_username} さんの市民申請が承認され、市民権が付与されました。`,
            user: app.roblox_username,
          });
        } else if (app.status === 'rejected') {
          const reviewTime = app.reviewed_at ? parseUTCDate(app.reviewed_at) : submitTime;
          list.push({
            id: `app-rej-${app.user_id}`,
            type: 'app_rejected',
            timestamp: reviewTime,
            title: '市民申請却下',
            description: `${app.roblox_username} さんの市民申請が却下されました。`,
            user: app.roblox_username,
            details: app.reject_reason || undefined
          });
        }
      });
    }

    // 時間順にソート (新しい順)
    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 8);
  }, [allSearchVehicles, allApplications, adminGameFilter]);

  return (
    <div className="animate-fade" style={{ display: 'flex', minHeight: 'calc(100vh - 120px)', gap: '2px', background: 'var(--panel-bg)', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--glass-border)', position: 'relative' }}>
      
      {/* Mobile Overlay */}
      {isMobile && showMobileMenu && (
        <div 
          onClick={() => setShowMobileMenu(false)} 
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9998, backdropFilter: 'blur(2px)' }} 
        />
      )}

      {/* Admin Sidebar */}
      <div style={{ 
          background: 'var(--panel-bg)', 
          display: 'flex', 
          flexDirection: 'column', 
          flexShrink: 0,
          overflow: 'hidden',
          ...(isMobile ? {
            width: '260px',
            padding: 'calc(24px + env(safe-area-inset-top)) 12px 24px 12px',
            borderRight: '1px solid var(--glass-border)',
            position: 'fixed',
            top: 0, bottom: 0, left: 0,
            zIndex: 9999,
            boxShadow: showMobileMenu ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
            transform: showMobileMenu ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: showMobileMenu ? 'auto' : 'none'
          } : {
            position: 'sticky',
            top: 'clamp(12px, 1.2vw, 24px)',
            height: 'calc(100vh - clamp(24px, 2.4vw, 48px))',
            alignSelf: 'flex-start',
            width: showMobileMenu ? '260px' : '0px',
            padding: showMobileMenu ? '24px 12px' : '24px 0px',
            borderRight: showMobileMenu ? '1px solid var(--glass-border)' : '0px solid transparent',
            transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-right 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          })
        }}>
          <div style={{ padding: '0 12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between', minWidth: '236px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                <ShieldCheck size={20} color="#000" />
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-main)' }}>管理パネル</span>
            </div>
            <button 
              onClick={() => setShowMobileMenu(false)} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="メニューを閉じる"
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            {[
              { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
              { id: 'vehicles', label: '車両承認', icon: Car, count: vehicles.length },
              { id: 'applications', label: '市民申請', icon: ClipboardList, count: allApplications.filter((a:any) => a.status === 'pending').length },
              { id: 'lookup', label: '車両検索', icon: SearchIcon },
              { id: 'users', label: 'ユーザー管理', icon: UserIcon },
              { id: 'catalog', label: 'カタログ管理', icon: BookOpen },
              { id: 'questions', label: '問題管理', icon: ClipboardList }
            ].map(item => {
              const isActive = adminTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { 
                    setAdminTabPersist(item.id as any); 
                    if(isMobile) setShowMobileMenu(false);
                  }}
                  className={`admin-nav-btn ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="nav-badge">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '24px' }}>
          </div>
      </div>

      {/* Admin Content Area */}
      <div 
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ flex: 1, padding: isMobile ? '16px' : '40px', overflowY: 'auto', background: 'var(--admin-content-bg, transparent)', position: 'relative' }}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isMobile ? '18px' : '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!isMobile && !showMobileMenu && (
              <button 
                onClick={() => setShowMobileMenu(true)} 
                className="btn glass"
                style={{ 
                  background: 'rgba(255,255,255,0.05)', 
                  border: '1px solid var(--glass-border)', 
                  color: 'var(--text-main)', 
                  display: 'flex', 
                  padding: '8px', 
                  borderRadius: '10px',
                  cursor: 'pointer',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s' 
                }}
                title="メニューを開く"
              >
                <Menu size={20} />
              </button>
            )}
            <div>
              <h2 style={{ fontSize: isMobile ? '1.4rem' : '1.8rem', fontWeight: 800, marginBottom: '4px' }}>
                {adminTab === 'dashboard' ? 'ダッシュボード' : 
                adminTab === 'vehicles' ? '車両承認' : 
                adminTab === 'applications' ? '市民申請' : 
                adminTab === 'lookup' ? '車両検索' : 
                adminTab === 'users' ? 'ユーザー管理' : 
                adminTab === 'catalog' ? 'カタログ管理' : '問題管理'}
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.82rem' : '0.95rem' }}>ぴっざぁポータル</p>
            </div>
          </div>
          {!isMobile && (
            <button 
              onClick={handleManualRefresh} 
              disabled={isLoading}
              title="更新"
              style={{ 
                width: isMobile ? '38px' : '48px', 
                height: isMobile ? '38px' : '48px', 
                borderRadius: isMobile ? '10px' : '14px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                background: 'rgba(0, 193, 102, 0.12)',
                border: '1px solid rgba(0, 193, 102, 0.35)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0,
                padding: 0,
                outline: 'none',
                lineHeight: 1,
              }} 
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(0, 193, 102, 0.25)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(0, 193, 102, 0.12)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <RotateCcw size={isMobile ? 18 : 22} color="#00c166" strokeWidth={2.5} className={isLoading ? 'animate-spin' : undefined} />
            </button>
          )}
        </div>

        {/* ゲームフィルター (dashboard, vehicles, lookup タブでのみ表示) */}
        {(adminTab === 'dashboard' || adminTab === 'vehicles' || adminTab === 'lookup') && (
          <div style={{ marginBottom: isMobile ? '16px' : '24px' }}>
            <div style={{ display: 'flex', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '5px', borderRadius: '16px', border: '1px solid var(--glass-border)' }}>
              {[
                { id: 'all', label: '🎮 すべて', activeColor: 'var(--text-main)', bg: 'rgba(255,255,255,0.08)' },
                { id: 'gv', label: '🟢 Greenville', activeColor: 'var(--primary)', bg: 'rgba(0, 193, 102, 0.12)' },
                { id: 'rc', label: '🔵 RC', activeColor: 'var(--secondary)', bg: 'rgba(0, 160, 204, 0.12)' }
              ].map(opt => {
                const active = adminGameFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setAdminGameFilter(opt.id as any)}
                    style={{
                      flex: 1,
                      padding: isMobile ? '8px 12px' : '12px 24px',
                      borderRadius: '12px',
                      border: 'none',
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: active ? opt.bg : 'transparent',
                      color: active ? opt.activeColor : 'var(--text-muted)',
                      fontSize: isMobile ? '0.85rem' : '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {adminTab === 'dashboard' && (
          <div className="animate-fade">
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(280px, 1fr))', gap: isMobile ? '12px' : '24px' }}>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="glass card" style={{ 
                    padding: isMobile ? '12px 14px' : '32px', 
                    borderRadius: isMobile ? '16px' : '20px', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'row' : 'column', 
                    alignItems: isMobile ? 'center' : 'stretch',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    gap: isMobile ? '8px' : '16px', 
                    background: 'var(--panel-bg)', 
                    height: isMobile ? 'auto' : '180px' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', flex: 1 }}>
                      <div className="skeleton skeleton-circle" style={{ width: isMobile ? '20px' : '24px', height: isMobile ? '20px' : '24px', flexShrink: 0 }} />
                      <div className="skeleton skeleton-text" style={{ width: '50%' }} />
                    </div>
                    <div className="skeleton skeleton-title" style={{ width: isMobile ? '50px' : '40%', height: isMobile ? '24px' : '40px', marginTop: isMobile ? '0' : '8px' }} />
                  </div>
                ))
              ) : (
                <>
                  <div className="glass card" onClick={() => setAdminTabPersist('vehicles')} style={{ 
                    padding: isMobile ? '12px 14px' : '32px', 
                    borderRadius: isMobile ? '16px' : '20px', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'row' : 'column', 
                    alignItems: isMobile ? 'center' : 'stretch',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    gap: isMobile ? '8px' : '16px',  
                    cursor: 'pointer', 
                    background: 'var(--panel-bg)' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <Car size={isMobile ? 20 : 24} />
                      <h2 style={{ fontSize: isMobile ? '0.82rem' : '1.2rem', margin: 0, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>保留中の車両承認</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', marginLeft: isMobile ? 'auto' : '0' }}>
                      <div style={{ fontSize: isMobile ? '1.4rem' : '3rem', fontWeight: 800, lineHeight: 1 }}>
                        {vehicles.filter(v => adminGameFilter === 'all' || v.game_type === adminGameFilter).length} <span style={{ fontSize: isMobile ? '0.75rem' : '1.2rem', fontWeight: 500 }}>件</span>
                      </div>
                      {isMobile ? (
                        <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                      ) : (
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 'auto' }}>審査する <ChevronRight size={16} /></div>
                      )}
                    </div>
                  </div>

                  <div className="glass card" onClick={() => setAdminTabPersist('applications')} style={{ 
                    padding: isMobile ? '12px 14px' : '32px', 
                    borderRadius: isMobile ? '16px' : '20px', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'row' : 'column', 
                    alignItems: isMobile ? 'center' : 'stretch',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    gap: isMobile ? '8px' : '16px', 
                    cursor: 'pointer', 
                    background: 'var(--panel-bg)' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <ClipboardList size={isMobile ? 20 : 24} />
                      <h2 style={{ fontSize: isMobile ? '0.82rem' : '1.2rem', margin: 0, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>未審査の市民申請</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', marginLeft: isMobile ? 'auto' : '0' }}>
                      <div style={{ fontSize: isMobile ? '1.4rem' : '3rem', fontWeight: 800, lineHeight: 1 }}>
                        {allApplications.filter(a => a.status === 'pending').length} <span style={{ fontSize: isMobile ? '0.75rem' : '1.2rem', fontWeight: 500 }}>件</span>
                      </div>
                      {isMobile ? (
                        <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                      ) : (
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 'auto' }}>審査する <ChevronRight size={16} /></div>
                      )}
                    </div>
                  </div>

                  <div className="glass card" onClick={() => setAdminTabPersist('users')} style={{ 
                    padding: isMobile ? '12px 14px' : '32px', 
                    borderRadius: isMobile ? '16px' : '20px', 
                    display: 'flex', 
                    flexDirection: isMobile ? 'row' : 'column', 
                    alignItems: isMobile ? 'center' : 'stretch',
                    justifyContent: isMobile ? 'space-between' : 'flex-start',
                    gap: isMobile ? '8px' : '16px', 
                    cursor: 'pointer', 
                    background: 'var(--panel-bg)' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '12px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      <UserIcon size={isMobile ? 20 : 24} />
                      <h2 style={{ fontSize: isMobile ? '0.82rem' : '1.2rem', margin: 0, fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>登録ユーザー数</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', marginLeft: isMobile ? 'auto' : '0' }}>
                      <div style={{ fontSize: isMobile ? '1.4rem' : '3rem', fontWeight: 800, lineHeight: 1 }}>
                        {allUsers.length} <span style={{ fontSize: isMobile ? '0.75rem' : '1.2rem', fontWeight: 500 }}>人</span>
                      </div>
                      {isMobile ? (
                        <ChevronRight size={16} style={{ color: 'var(--primary)', opacity: 0.8 }} />
                      ) : (
                        <div style={{ color: 'var(--primary)', fontWeight: 600, marginTop: 'auto' }}>管理する <ChevronRight size={16} /></div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            {!isLoading && (
              <>
                <DashboardCharts 
                  vehicles={allSearchVehicles.filter(v => adminGameFilter === 'all' || v.game_type === adminGameFilter)} 
                  isMobile={isMobile}
                  onMakerClick={(maker) => {
                    if (maker === 'その他') return;
                    setAdminSearchTerm(maker);
                    setAdminTabPersist('lookup');
                  }}
                  onStatusClick={(status) => {
                    let filterVal: 'all' | 'approved' | 'pending' | 'rejected' | 'temp' = 'all';
                    if (status === 'approved') filterVal = 'approved';
                    else if (status === 'pending') filterVal = 'pending';
                    else if (status === 'rejected') filterVal = 'rejected';
                    else if (status === 'temp') filterVal = 'temp';
                    
                    setLookupStatusFilter(filterVal);
                    setAdminTabPersist('lookup');
                  }}
                />

                {/* 最近のアクティビティ・タイムライン */}
                <div className="glass card" style={{ padding: isMobile ? '16px 14px' : '28px 32px', borderRadius: isMobile ? '16px' : '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', marginTop: isMobile ? '16px' : '24px' }}>
                  <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.25rem', fontWeight: 800, marginBottom: isMobile ? '12px' : '24px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: isMobile ? '30px' : '36px', height: isMobile ? '30px' : '36px', borderRadius: '10px', background: 'rgba(0, 193, 102, 0.12)', border: '1px solid rgba(0, 193, 102, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Activity size={isMobile ? 16 : 20} color="var(--primary)" />
                    </div>
                    <span>最近のアクティビティ</span>
                    <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 'auto', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '20px' }}>
                      リアルタイム履歴
                    </span>
                  </h3>

                  {activities.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
                      現在アクティビティ履歴はありません。
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                      {/* タイムラインの縦線 */}
                      <div style={{ position: 'absolute', left: isMobile ? '18px' : '32px', top: '29px', bottom: '29px', width: '2px', background: 'linear-gradient(180deg, var(--primary) 0%, rgba(255,255,255,0.05) 100%)', zIndex: 0 }} />

                      {(isMobile && !showAllActivities ? activities.slice(0, 3) : activities).map((act, index) => {
                        // タイプに応じたアイコン、カラーの設定
                        let icon = <Clock size={14} color="#f59e0b" />;
                        let dotColor = '#f59e0b';
                        let badgeText = '申請';
                        let badgeBg = 'rgba(245, 158, 11, 0.12)';
                        let badgeBorder = 'rgba(245, 158, 11, 0.3)';

                        if (act.type === 'vehicle_approved' || act.type === 'app_approved') {
                          icon = <CheckCircle2 size={14} color="var(--success)" />;
                          dotColor = 'var(--success)';
                          badgeText = act.type === 'app_approved' ? '市民権承認' : '承認';
                          badgeBg = 'rgba(0, 193, 102, 0.12)';
                          badgeBorder = 'rgba(0, 193, 102, 0.3)';
                        } else if (act.type === 'vehicle_warning') {
                          icon = <AlertTriangle size={14} color="#f59e0b" />;
                          dotColor = '#f59e0b';
                          badgeText = '非推奨承認';
                          badgeBg = 'rgba(245, 158, 11, 0.12)';
                          badgeBorder = 'rgba(245, 158, 11, 0.3)';
                        } else if (act.type === 'vehicle_rejected' || act.type === 'app_rejected') {
                          icon = <X size={14} color="var(--error)" />;
                          dotColor = 'var(--error)';
                          badgeText = '却下';
                          badgeBg = 'rgba(255, 71, 87, 0.12)';
                          badgeBorder = 'rgba(255, 71, 87, 0.3)';
                        } else if (act.type === 'vehicle_temp') {
                          icon = <Plus size={14} color="#3b82f6" />;
                          dotColor = '#3b82f6';
                          badgeText = '仮承認';
                          badgeBg = 'rgba(59, 130, 246, 0.12)';
                          badgeBorder = 'rgba(59, 130, 246, 0.3)';
                        } else if (act.type === 'app_pending') {
                          icon = <ClipboardList size={14} color="#f59e0b" />;
                          dotColor = '#f59e0b';
                          badgeText = '市民申請';
                          badgeBg = 'rgba(245, 158, 11, 0.12)';
                          badgeBorder = 'rgba(245, 158, 11, 0.3)';
                        }

                        return (
                          <div 
                            key={act.id} 
                            style={{ 
                              display: 'flex', 
                              gap: isMobile ? '10px' : '16px', 
                              padding: isMobile ? '8px 4px' : '12px 16px', 
                              borderRadius: '12px', 
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                              cursor: 'default',
                              position: 'relative',
                              zIndex: 1,
                              background: 'transparent'
                            }}
                            onMouseOver={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                e.currentTarget.style.transform = 'translateX(4px)';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!isMobile) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.transform = 'translateX(0)';
                              }
                            }}
                          >
                            {/* ドット・アイコンコンテナ */}
                            <div style={{ 
                              width: isMobile ? '28px' : '34px', 
                              height: isMobile ? '28px' : '34px', 
                              borderRadius: '50%', 
                              background: 'var(--panel-bg)', 
                              border: `2px solid ${dotColor}`, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0,
                              boxShadow: `0 0 10px ${dotColor}22`
                            }}>
                              {icon}
                            </div>

                            {/* 内容 */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: isMobile ? '0.7rem' : '0.8rem', padding: isMobile ? '1px 6px' : '2px 8px', borderRadius: '6px', background: badgeBg, border: `1px solid ${badgeBorder}`, color: dotColor, fontWeight: 700 }}>
                                  {badgeText}
                                </span>
                                <span style={{ fontSize: isMobile ? '0.82rem' : '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
                                  {act.title}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                  {getRelativeTimeString(act.timestamp)}
                                </span>
                              </div>
                              <p style={{ fontSize: isMobile ? '0.78rem' : '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                                {act.description}
                              </p>
                              {act.details && (
                                <div style={{ fontSize: isMobile ? '0.72rem' : '0.8rem', background: 'rgba(255,255,255,0.02)', padding: isMobile ? '4px 8px' : '6px 12px', borderRadius: '6px', borderLeft: `3px solid ${dotColor}`, color: 'var(--text-muted)', marginTop: '4px' }}>
                                  理由: {act.details}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isMobile && activities.length > 3 && (
                    <button 
                      onClick={() => setShowAllActivities(!showAllActivities)}
                      className="btn btn-secondary"
                      style={{ 
                        width: '100%', 
                        padding: '10px', 
                        fontSize: '0.8rem', 
                        marginTop: '12px',
                        borderRadius: '10px',
                        justifyContent: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid var(--glass-border)',
                        color: 'var(--text-main)',
                        cursor: 'pointer'
                      }}
                    >
                      {showAllActivities ? '🔼 履歴をたたむ' : `🔽 さらに ${activities.length - 3} 件の履歴を表示`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {adminTab === 'vehicles' && (
          <div className="animate-fade">
             {isLoading ? (
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 420px))', gap: '24px' }}>
                 {[1, 2, 3].map(i => (
                   <div key={i} className="glass card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '480px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
                     <div className="skeleton" style={{ height: '240px', width: '100%' }} />
                     <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                       <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                       <div className="skeleton skeleton-title" style={{ width: '70%' }} />
                       <div className="skeleton skeleton-text" style={{ width: '50%', height: '20px', marginTop: '10px' }} />
                       <div style={{ display: 'flex', gap: '12px', marginTop: 'auto' }}>
                         <div className="skeleton skeleton-rect" style={{ flex: 1.2, height: '42px', borderRadius: '12px' }} />
                         <div className="skeleton skeleton-rect" style={{ flex: 1, height: '42px', borderRadius: '12px' }} />
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             ) : vehicles.filter(v => adminGameFilter === 'all' || v.game_type === adminGameFilter).length === 0 ? (
               <div className="glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>待機中の申請はありません。</div>
             ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(360px, 420px))', gap: isMobile ? '12px' : '24px' }}>
                  {vehicles.filter(v => adminGameFilter === 'all' || v.game_type === adminGameFilter).map(v => (
                    <div key={v.id} className="glass card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ height: isMobile ? '130px' : '240px', width: '100%', position: 'relative' }}>
                        <VehicleImageGallery vehicleId={v.id} imageData={v.image_data} fallbackQuery={`${v.year} ${v.maker} ${v.model}`} targetTrim={v.trim} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Clock size={14} /> 審査中
                          </div>
                          {v.is_temp_registration === 1 && (
                            <div style={{ background: 'rgba(255, 159, 67, 0.95)', backdropFilter: 'blur(8px)', color: '#000', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(255, 159, 67, 0.4)' }}>
                              <span>🅿️ 仮ナンバー希望</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ padding: isMobile ? '12px' : '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{
                                fontSize: '0.7rem',
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
                            <div style={{ color: 'var(--primary)', fontSize: isMobile ? '0.75rem' : '0.85rem', fontWeight: 600, marginBottom: '2px' }}>{v.year} {v.maker}</div>
                            <div style={{ fontWeight: 800, fontSize: isMobile ? '1rem' : '1.4rem', color: 'var(--text-main)', letterSpacing: '0.02em', lineHeight: 1.2 }}>{v.model}</div>
                            <div 
                              style={{ fontSize: isMobile ? '0.75rem' : '0.9rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', textDecoration: 'none', marginTop: isMobile ? '4px' : '10px' }}
                              onClick={() => handleViewUserVehicles({ id: v.owner_id, roblox_username: v.roblox_username })}
                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                              <div style={{ width: isMobile ? '16px' : '22px', height: isMobile ? '16px' : '22px', borderRadius: '50%', background: 'rgba(0, 255, 136, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <UserIcon size={isMobile ? 10 : 12} />
                              </div>
                              {v.roblox_username}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '6px' : '12px' }}>
                          <div>
                            <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>GRADE / TRIM</div>
                            <div style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.9rem', color: 'var(--text-main)' }}>{v.trim || '---'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>COLOR</div>
                            <div style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.9rem', color: 'var(--text-main)' }}>{v.color || '---'}</div>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: isMobile ? '0.55rem' : '0.65rem', color: 'var(--text-muted)', marginBottom: isMobile ? '4px' : '8px', letterSpacing: '0.05em' }}>LICENSE PLATE</div>
                          <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                            <div style={{ background: 'linear-gradient(135deg, #1c2e4a, #2a4060)', color: '#ffffff', padding: isMobile ? '3px 6px' : '6px 12px', fontSize: isMobile ? '0.55rem' : '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{v.plate_region || 'WISCONSIN'}</div>
                            <div style={{ background: '#fff', color: '#000', padding: isMobile ? '3px 8px' : '6px 14px', fontSize: isMobile ? '0.85rem' : '1.2rem', fontWeight: 800, fontFamily: 'monospace, sans-serif' }}>{v.plate}</div>
                          </div>
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '8px', paddingTop: '10px' }}>
                          <div style={{ display: 'flex', gap: isMobile ? '6px' : '8px' }}>
                            <button 
                              type="button"
                              className="btn" 
                              onClick={() => handleOpenTempApproveModal(v)} 
                              style={{ 
                                flex: 1.2,
                                padding: isMobile ? '8px' : '12px', 
                                justifyContent: 'center', 
                                fontWeight: 800, 
                                fontSize: isMobile ? '0.75rem' : '0.95rem', 
                                background: v.is_temp_registration === 1 ? 'linear-gradient(135deg, #ff9f43, #ffb142)' : 'rgba(255, 159, 67, 0.15)', 
                                color: v.is_temp_registration === 1 ? '#000' : '#ff9f43', 
                                border: v.is_temp_registration === 1 ? 'none' : '1px solid rgba(255, 159, 67, 0.3)', 
                                borderRadius: '10px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: isMobile ? '4px' : '8px', 
                                boxShadow: v.is_temp_registration === 1 ? '0 2px 8px rgba(255, 159, 67, 0.3)' : 'none', 
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              <span>{isMobile ? '🅿️ 仮' : '🅿️ 仮承認'}</span>
                            </button>
                            <button className="btn btn-primary" onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ flex: 1, padding: isMobile ? '8px' : '12px', justifyContent: 'center', fontWeight: 800, fontSize: isMobile ? '0.75rem' : '0.95rem', display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px', borderRadius: '10px' }}>
                              <CheckCircle2 size={isMobile ? 12 : 18} /> <span>{v.is_temp_registration === 1 ? (isMobile ? '通常' : '通常承認') : (isMobile ? '完全' : '完全承認')}</span>
                            </button>
                          </div>
                          <div style={{ display: 'flex', gap: isMobile ? '6px' : '8px' }}>
                            <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'approved_warning')} style={{ flex: 1, padding: isMobile ? '8px' : '10px', justifyContent: 'center', color: '#FFA114', background: 'rgba(255, 161, 20, 0.1)', border: '1px solid rgba(255, 161, 20, 0.2)', fontSize: isMobile ? '0.75rem' : '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', borderRadius: '10px' }}>
                              <AlertTriangle size={isMobile ? 12 : 16} /> {isMobile ? '非推奨' : '非推奨承認'}
                            </button>
                            <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ flex: 1, padding: isMobile ? '8px' : '10px', justifyContent: 'center', color: 'var(--error)', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)', fontSize: isMobile ? '0.75rem' : '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '6px', borderRadius: '10px' }}>
                              <X size={isMobile ? 12 : 16} /> 却下
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.8 }}>
                          <span>申請受領: {formatDate(v.created_at)}</span>
                          <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>ID: {v.id.slice(0, 8)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
        )}

        {adminTab === 'applications' && (
          <div className="animate-fade">
            {isLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[1, 2].map(i => (
                  <div key={i} className="glass card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--panel-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className="skeleton skeleton-text" style={{ width: '30%', height: '20px' }} />
                      <div className="skeleton skeleton-text short" style={{ width: '20%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '8px' }} />
                      <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '8px' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : allApplications.filter(a => a.status === 'pending').length === 0 ? (
              <div className="glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>待機中の申請はありません。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {allApplications.filter(a => a.status === 'pending').map(app => (
                  <div key={app.user_id} className="glass card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{app.roblox_username}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{formatDate(app.created_at)}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary" onClick={() => handleReviewApplication(app.user_id, 'approved')} style={{ padding: '10px 20px' }}>承認</button>
                      <button className="btn btn-secondary" onClick={() => handleReviewApplication(app.user_id, 'rejected')} style={{ padding: '10px 20px', color: 'var(--error)' }}>却下</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {adminTab === 'lookup' && (
           <div className="animate-fade">
              {/* Selected User Filter Info */}
              {selectedUserForVehicles && (
                <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--primary)', color: '#000', padding: '12px 20px', borderRadius: '14px', fontWeight: 700, boxShadow: '0 8px 24px rgba(0, 193, 102, 0.3)' }}>
                  <UserIcon size={20} />
                  <span>{selectedUserForVehicles.roblox_username} の車両を表示中</span>
                  <button 
                    onClick={() => setSelectedUserForVehicles(null)}
                    style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.1)', border: 'none', color: '#000', cursor: 'pointer', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}
                    title="フィルターをクリア"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}

              <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <SearchIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input type="text" placeholder="ナンバープレート、ユーザー名、車両名..." value={adminSearchTerm} onChange={e => setAdminSearchTerm(e.target.value)} className="glass" style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '12px', border: 'none', background: 'var(--panel-bg)' }} />
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
                      const active = lookupStatusFilter === tag.id;
                      return (
                        <button
                          key={tag.id}
                          onClick={() => setLookupStatusFilter(tag.id as any)}
                          className={`filter-tag-btn ${active ? `active ${tag.className}` : ''}`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 700, minWidth: '80px' }}>車両タイプ:</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {[
                      { id: 'all', label: 'すべて' },
                      { id: 'car', label: '🚗 マイカー' },
                      { id: 'trailer', label: '🚛 トレーラー' }
                    ].map(tag => {
                      const active = lookupTypeFilter === tag.id;
                      return (
                        <button
                          key={tag.id}
                          onClick={() => setLookupTypeFilter(tag.id as any)}
                          className={`filter-tag-btn ${active ? 'active' : ''}`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

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
                <CustomSortDropdown 
                  value={adminSortOrder}
                  onChange={setAdminSortOrder}
                  options={[
                    { id: 'newest', label: '登録順 (新しい順)' },
                    { id: 'oldest', label: '登録順 (古い順)' },
                    { id: 'maker', label: 'メーカー順 (A-Z)' },
                    { id: 'userCount', label: '台数付きユーザー順' }
                  ]}
                />
              </div>

               <div className={lookupViewMode === 'grid' ? "card-grid" : "list-view"}>
                  {isLoading ?
                    [1, 2, 3].map(i => (
                      <div key={i} className="glass card animate-fade" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', height: lookupViewMode === 'grid' ? (isMobile ? '280px' : '380px') : 'auto', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}>
                        <div style={{ height: (isMobile && lookupViewMode === 'grid') ? '130px' : (lookupViewMode === 'grid' ? '220px' : '200px'), width: lookupViewMode === 'grid' ? '100%' : (isMobile ? '100px' : '250px'), minHeight: lookupViewMode === 'grid' ? 'auto' : (isMobile ? '100px' : '200px'), position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                          <div className="skeleton" style={{ width: '100%', height: '100%' }} />
                        </div>
                        <div style={{ padding: isMobile ? '12px' : '24px', flex: 1, display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: isMobile ? '10px' : '16px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                          <div style={{ flex: 2 }}>
                            <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: '8px' }} />
                            <div className="skeleton skeleton-title" style={{ width: '60%', marginBottom: '12px' }} />
                            <div className="skeleton skeleton-text short" style={{ width: '40%', marginBottom: '12px' }} />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', width: '120px' }}>
                              <div className="skeleton skeleton-text" style={{ width: '100%', height: '12px' }} />
                              <div className="skeleton skeleton-text" style={{ width: '100%', height: '12px' }} />
                            </div>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div className="skeleton skeleton-rect" style={{ width: '120px', height: '36px', borderRadius: '6px' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: lookupViewMode === 'grid' ? '12px' : '0' }}>
                            <div className="skeleton skeleton-rect" style={{ width: '70px', height: '32px', borderRadius: '8px' }} />
                            <div className="skeleton skeleton-rect" style={{ width: '70px', height: '32px', borderRadius: '8px' }} />
                          </div>
                        </div>
                      </div>
                    ))
                  :
                    allSearchVehicles.filter(v => {
                    // Filter by selected user id if exists
                    if (selectedUserForVehicles && v.owner_id !== selectedUserForVehicles.id) return false;

                    // Filter by game type
                    if (adminGameFilter !== 'all' && v.game_type !== adminGameFilter) return false;

                    // Filter by status tag
                    if (lookupStatusFilter !== 'all') {
                      if (lookupStatusFilter === 'approved' && v.status !== 'approved' && v.status !== 'approved_warning') return false;
                      if (lookupStatusFilter === 'pending' && v.status !== 'pending') return false;
                      if (lookupStatusFilter === 'rejected' && v.status !== 'rejected') return false;
                      if (lookupStatusFilter === 'temp' && v.status !== 'temp_approved') return false;
                    }

                    // Filter by type tag
                    if (lookupTypeFilter !== 'all') {
                      const isTrailer = (v as any).vehicle_type === 'trailer';
                      if (lookupTypeFilter === 'car' && isTrailer) return false;
                      if (lookupTypeFilter === 'trailer' && !isTrailer) return false;
                    }

                    const s = adminSearchTerm.toLowerCase();
                    return (v.plate?.toLowerCase().includes(s) || v.roblox_username?.toLowerCase().includes(s) || v.maker?.toLowerCase().includes(s) || v.model?.toLowerCase().includes(s));
                  }).sort((a, b) => {
                    if (adminSortOrder === 'newest') return parseUTCDate(b.created_at).getTime() - parseUTCDate(a.created_at).getTime();
                    if (adminSortOrder === 'oldest') return parseUTCDate(a.created_at).getTime() - parseUTCDate(b.created_at).getTime();
                    if (adminSortOrder === 'maker') return (a.maker || '').localeCompare(b.maker || '');
                    if (adminSortOrder === 'userCount') {
                       const countA = allSearchVehicles.filter(x => x.owner_id === a.owner_id).length;
                       const countB = allSearchVehicles.filter(x => x.owner_id === b.owner_id).length;
                       if (countB !== countA) return countB - countA;
                       return (a.roblox_username || '').localeCompare(b.roblox_username || '');
                    }
                    return 0;
                  }).map(v => (
                     <div key={v.id} className="glass card animate-fade" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                       <div style={{ height: (isMobile && lookupViewMode === 'grid') ? '130px' : (lookupViewMode === 'grid' ? '220px' : '200px'), width: lookupViewMode === 'grid' ? '100%' : '250px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                         <VehicleImageGallery vehicleId={v.id} imageData={v.image_data} fallbackQuery={`${v.year} ${v.maker} ${v.model}`} targetTrim={v.trim} />
                        <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10 }}>
                           <StatusBadge status={v.status} reason={v.reject_reason} tempExpiresAt={v.temp_expires_at} />
                        </div>
                      </div>
                      <div style={{ padding: isMobile ? '12px' : '24px', flex: 1, display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: isMobile ? '10px' : '16px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center' }}>
                        <div style={{ flex: 2 }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{
                              fontSize: '0.7rem',
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
                          <div style={{ fontWeight: 800, fontSize: isMobile ? '0.95rem' : '1.25rem', color: 'var(--text-main)', marginBottom: '4px', letterSpacing: '0.02em', lineHeight: 1.2 }}>{v.year} {v.maker} {v.model}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: isMobile ? '8px' : '16px' }}>
                            <div 
                              style={{ fontSize: isMobile ? '0.75rem' : '0.9rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                              onClick={() => handleViewUserVehicles({ id: v.owner_id, roblox_username: v.roblox_username })}
                              onMouseOver={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseOut={(e) => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              <UserIcon size={14} />
                              {v.roblox_username}
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '20px', background: 'rgba(0,193,102,0.1)', border: '1px solid rgba(0,193,102,0.25)', color: 'var(--primary)', fontWeight: 700 }}>
                              🚗 {allSearchVehicles.filter((x: any) => x.owner_id === v.owner_id).length} 台
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: isMobile ? '6px' : '12px', marginBottom: isMobile ? '8px' : '16px' }}>
                            <div>
                              <div style={{ fontSize: isMobile ? '0.55rem' : '0.6rem', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>GRADE / TRIM</div>
                              <div style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'var(--text-main)' }}>{v.trim || '---'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: isMobile ? '0.55rem' : '0.6rem', color: 'var(--text-muted)', marginBottom: '2px', letterSpacing: '0.05em' }}>COLOR</div>
                              <div style={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'var(--text-main)' }}>{v.color || '---'}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ flex: 1, marginBottom: isMobile ? '8px' : '0' }}>
                          <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                            <div style={{ background: 'linear-gradient(135deg, #1c2e4a, #2a4060)', color: '#ffffff', padding: isMobile ? '3px 6px' : '4px 10px', fontSize: '0.75rem', fontWeight: 700, display: 'flex', alignItems: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>{v.plate_region || 'WISCONSIN'}</div>
                            <div style={{ background: '#fff', color: '#000', padding: isMobile ? '3px 8px' : '4px 12px', fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace, sans-serif' }}>{v.plate}</div>
                          </div>
                        </div>
                        
                        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: lookupViewMode === 'grid' ? 'column' : 'row', gap: isMobile ? '8px' : '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', alignItems: lookupViewMode === 'grid' ? 'stretch' : 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', gap: isMobile ? '6px' : '8px', flexWrap: 'wrap' }}>
                             {v.status !== 'rejected' && (
                                <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'rejected')} style={{ padding: isMobile ? '4px 8px' : '6px 12px', color: 'var(--error)', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid rgba(255, 71, 87, 0.2)', fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 700, borderRadius: '8px' }}>
                                  <X size={isMobile ? 12 : 14} /> 却下
                                </button>
                             )}
                             {(v.status === 'rejected' || v.status === 'pending') && (
                                <>
                                  <button className="btn btn-primary" onClick={() => handleUpdateStatus(v.id, 'approved')} style={{ padding: isMobile ? '4px 8px' : '6px 12px', fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 700, borderRadius: '8px' }}>
                                    <CheckCircle2 size={isMobile ? 12 : 14} /> 承認
                                  </button>
                                  <button className="btn btn-secondary" onClick={() => handleUpdateStatus(v.id, 'approved_warning')} style={{ padding: isMobile ? '4px 8px' : '6px 12px', color: '#FFA114', background: 'rgba(255, 161, 20, 0.1)', border: '1px solid rgba(255, 161, 20, 0.2)', fontSize: isMobile ? '0.7rem' : '0.8rem', fontWeight: 700, borderRadius: '8px' }}>
                                    <AlertTriangle size={isMobile ? 12 : 14} /> 非推奨
                                  </button>
                                </>
                             )}
                          </div>
                          
                          <div style={{ textAlign: lookupViewMode === 'grid' ? 'left' : 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(v.created_at)}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.5, color: 'var(--text-muted)' }}>{v.id.slice(0,8)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
               </div>
           </div>
        )}

        {adminTab === 'users' && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
             {/* ユーザー用 検索/レイアウト操作バー */}
             <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
                 <SearchIcon size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                 <input 
                   type="text" 
                   placeholder="ユーザー名、Robloxユーザー名で検索..." 
                   value={userSearchTerm} 
                   onChange={e => setUserSearchTerm(e.target.value)} 
                   className="glass" 
                   style={{ width: '100%', padding: '12px 12px 12px 42px', borderRadius: '12px', border: 'none', background: 'var(--panel-bg)', color: 'var(--text-main)', fontSize: '0.95rem' }} 
                 />
               </div>
               
               <div style={{ display: 'flex', gap: '8px', background: 'var(--panel-bg)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                 <button onClick={() => setUsersViewMode('grid')} className="btn" style={{ padding: '8px', background: usersViewMode === 'grid' ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderRadius: '8px', color: usersViewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="グリッド表示">
                   <LayoutGrid size={18} />
                 </button>
                 <button onClick={() => setUsersViewMode('list')} className="btn" style={{ padding: '8px', background: usersViewMode === 'list' ? 'rgba(255,255,255,0.08)' : 'transparent', border: 'none', borderRadius: '8px', color: usersViewMode === 'list' ? 'var(--text-main)' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="リスト表示">
                   <List size={18} />
                 </button>
               </div>
             </div>

             {/* ユーザー表示グリッド/リスト */}
             <div className={usersViewMode === 'grid' ? 'user-grid' : 'user-list'}>
               {isLoading ? (
                 [1, 2, 3, 4].map(i => (
                   <div key={i} className="glass card" style={{ padding: '24px', borderRadius: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '16px', height: '175px' }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <div className="skeleton skeleton-circle" style={{ width: '44px', height: '44px' }} />
                       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                         <div className="skeleton skeleton-text" style={{ width: '50%', height: '16px' }} />
                         <div className="skeleton skeleton-text short" style={{ width: '30%', height: '12px' }} />
                       </div>
                     </div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                       <div className="skeleton skeleton-rect" style={{ width: '80px', height: '26px', borderRadius: '12px' }} />
                       <div className="skeleton skeleton-rect" style={{ width: '100px', height: '32px', borderRadius: '8px' }} />
                     </div>
                   </div>
                 ))
               ) : (
                 allUsers.filter(u => {
                   const s = userSearchTerm.toLowerCase();
                   return u.username.toLowerCase().includes(s) || (u.roblox_username || '').toLowerCase().includes(s);
                 }).map(u => {
                   const count = allSearchVehicles.filter((v: any) => v.owner_id === u.id).length;
                   const isSelf = u.id === currentUser.id;
                   
                   return (
                     <div key={u.id} className="glass card animate-fade user-card" style={{
                       padding: '24px',
                       borderRadius: '20px',
                       background: 'var(--panel-bg)',
                       border: '1px solid var(--glass-border)',
                       display: 'flex',
                       flexDirection: usersViewMode === 'grid' ? 'column' : 'row',
                       alignItems: usersViewMode === 'grid' ? 'stretch' : 'center',
                       justifyContent: 'space-between',
                       gap: '20px',
                       position: 'relative',
                       overflow: 'hidden',
                       transition: 'transform 0.2s, box-shadow 0.2s',
                       boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
                     }}>
                       {/* 管理者と一般で上部のアクセントカラーを変更 */}
                       <div style={{
                         position: 'absolute',
                         top: 0, left: 0, right: 0,
                         height: '3px',
                         background: u.role === 'admin' ? 'linear-gradient(90deg, var(--primary) 0%, #00d2fc 100%)' : 'rgba(255,255,255,0.05)'
                       }} />

                       {/* 左側: プロフィール情報 */}
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1.5 }}>
                         <div style={{ position: 'relative', flexShrink: 0 }}>
                           <img 
                             src={u.avatar} 
                             alt="User Avatar" 
                             onError={(e) => handleAvatarError(e, u.username)}
                             style={{ 
                               width: '48px', 
                               height: '48px', 
                               borderRadius: '12px', 
                               background: '#fff', 
                               objectFit: 'cover',
                               border: `2px solid ${u.role === 'admin' ? 'var(--primary)' : 'var(--glass-border)'}`,
                               boxShadow: u.role === 'admin' ? '0 0 12px rgba(0, 193, 102, 0.25)' : 'none'
                             }} 
                           />
                           {u.role === 'admin' && (
                             <span style={{
                               position: 'absolute',
                               bottom: '-4px',
                               right: '-4px',
                               background: 'var(--primary)',
                               color: '#000',
                               borderRadius: '50%',
                               width: '16px',
                               height: '16px',
                               display: 'flex',
                               alignItems: 'center',
                               justifyContent: 'center',
                               fontWeight: 800,
                               fontSize: '0.65rem',
                               boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                             }} title="管理者メンバー">🛡️</span>
                           )}
                         </div>

                         <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                           <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                             <span>{u.username}</span>
                             {isSelf && (
                               <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', fontWeight: 500 }}>自分</span>
                             )}
                           </div>
                           <span 
                             style={{ 
                               fontSize: '0.78rem', 
                               color: 'var(--primary)', 
                               fontWeight: 700, 
                               cursor: 'pointer',
                               display: 'inline-flex',
                               alignItems: 'center',
                               gap: '4px',
                               transition: 'color 0.2s'
                             }}
                             onClick={() => handleViewUserVehicles({ id: u.id, roblox_username: u.roblox_username || '' })}
                             onMouseOver={(e) => e.currentTarget.style.color = '#00ff88'}
                             onMouseOut={(e) => e.currentTarget.style.color = 'var(--primary)'}
                             title="クリックして車両を表示"
                           >
                             Roblox: {u.roblox_username || '未設定'}
                           </span>
                         </div>
                       </div>

                       {/* 中央: 車両台数と権限表示バッジ */}
                       <div style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '12px',
                         flexWrap: 'wrap',
                         flex: 1.2,
                         justifyContent: usersViewMode === 'grid' ? 'space-between' : 'flex-start'
                       }}>
                         <span
                           style={{ 
                             display: 'inline-flex', 
                             alignItems: 'center', 
                             gap: '6px', 
                             padding: '6px 14px', 
                             borderRadius: '20px', 
                             background: count > 0 ? 'rgba(0,193,102,0.1)' : 'rgba(255,255,255,0.03)', 
                             border: count > 0 ? '1px solid rgba(0,193,102,0.25)' : '1px solid var(--glass-border)', 
                             color: count > 0 ? 'var(--primary)' : 'var(--text-muted)', 
                             fontWeight: 700, 
                             fontSize: '0.82rem', 
                             cursor: count > 0 ? 'pointer' : 'default',
                             transition: 'all 0.2s'
                           }}
                           onClick={() => count > 0 && handleViewUserVehicles({ id: u.id, roblox_username: u.roblox_username || '' })}
                           onMouseOver={(e) => { if (count > 0) { e.currentTarget.style.background = 'rgba(0,193,102,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
                           onMouseOut={(e) => { if (count > 0) { e.currentTarget.style.background = 'rgba(0,193,102,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
                         >
                           🚗 {count} 台登録
                         </span>

                         <span style={{ 
                           fontSize: '0.75rem',
                           fontWeight: 700,
                           padding: '4px 10px',
                           borderRadius: '10px',
                           background: u.role === 'admin' ? 'rgba(0,193,102,0.12)' : 'rgba(255,255,255,0.03)',
                           border: u.role === 'admin' ? '1px solid rgba(0,193,102,0.2)' : '1px solid var(--glass-border)',
                           color: u.role === 'admin' ? 'var(--primary)' : 'var(--text-muted)',
                           letterSpacing: '0.05em'
                         }}>
                           {u.role === 'admin' ? '管理者' : '一般'}
                         </span>
                       </div>

                       {/* 右側: 操作アクションボタン */}
                       <div style={{ 
                         display: 'flex', 
                         alignItems: 'center', 
                         justifyContent: usersViewMode === 'grid' ? 'stretch' : 'flex-end',
                         flex: 1,
                         width: usersViewMode === 'grid' ? '100%' : 'auto'
                       }}>
                         {!isSelf ? (
                           <button 
                             className="btn btn-secondary" 
                             onClick={() => handleUpdateRole(u.id, u.role === 'admin' ? 'user' : 'admin')} 
                             style={{ 
                               width: '100%',
                               padding: '10px 16px', 
                               fontSize: '0.85rem',
                               fontWeight: 700,
                               borderRadius: '12px',
                               justifyContent: 'center',
                               border: u.role === 'admin' ? '1px solid rgba(255, 71, 87, 0.25)' : '1px solid var(--glass-border)',
                               background: u.role === 'admin' ? 'rgba(255, 71, 87, 0.04)' : 'rgba(255,255,255,0.03)',
                               color: u.role === 'admin' ? 'var(--error)' : 'var(--text-main)',
                               transition: 'all 0.2s',
                               cursor: 'pointer',
                               display: 'flex',
                               alignItems: 'center',
                               gap: '6px'
                             }}
                             onMouseOver={(e) => {
                               e.currentTarget.style.background = u.role === 'admin' ? 'rgba(255, 71, 87, 0.12)' : 'rgba(255,255,255,0.08)';
                               e.currentTarget.style.transform = 'translateY(-1px)';
                             }}
                             onMouseOut={(e) => {
                               e.currentTarget.style.background = u.role === 'admin' ? 'rgba(255, 71, 87, 0.04)' : 'rgba(255,255,255,0.03)';
                               e.currentTarget.style.transform = 'translateY(0)';
                             }}
                           >
                             {u.role === 'admin' ? '🛡️ 一般へ降格' : '⚡ 管理者へ昇格'}
                           </button>
                         ) : (
                           <span style={{ 
                             width: '100%',
                             textAlign: 'center',
                             fontSize: '0.75rem',
                             color: 'var(--text-muted)',
                             fontStyle: 'italic',
                             padding: '10px 0'
                           }}>
                             ログイン中（操作不可）
                           </span>
                         )}
                       </div>
                     </div>
                   );
                 })
               )}
             </div>
          </div>
        )}

        {adminTab === 'catalog' && (
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
        )}

        {adminTab === 'questions' && (
          <div className="animate-fade">
             <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
               <button className="btn btn-primary" onClick={() => setEditingQuestion({ question: '', type: 'radio', choices: [], answer: null, sort_order: allQuestionsAdmin.length + 1 })} style={{ padding: '10px 20px' }}><Plus size={16} /> 問題を追加</button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {allQuestionsAdmin.map(q => (
                 <div key={q.id} className="glass" style={{ padding: '20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: q.is_active ? 1 : 0.6 }}>
                   <div>
                     <span style={{ color: 'var(--primary)', fontWeight: 700, marginRight: '8px' }}>問{q.sort_order}</span>
                     <span>{q.question}</span>
                   </div>
                   <div style={{ display: 'flex', gap: '8px' }}>
                     <button className="btn btn-secondary" onClick={() => setEditingQuestion(q)} style={{ padding: '6px' }}><Edit3 size={14} /></button>
                     <button className="btn btn-secondary" onClick={() => handleToggleQuestion(q.id, q.is_active)} style={{ padding: '6px', color: q.is_active ? 'var(--error)' : 'var(--success)' }}>{q.is_active ? '停止' : '再開'}</button>
                   </div>
                 </div>
               ))}
             </div>

             {editingQuestion && (
               <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
                 <div className="glass card" style={{ width: '500px', padding: '32px' }}>
                   <h3 style={{ marginBottom: '20px' }}>問題を編集</h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <input type="text" value={editingQuestion.question} onChange={e => setEditingQuestion({...editingQuestion, question: e.target.value})} placeholder="問題文" className="glass" style={{ width: '100%', padding: '12px' }} />
                     <select value={editingQuestion.type} onChange={e => setEditingQuestion({...editingQuestion, type: e.target.value})} className="glass" style={{ width: '100%', padding: '12px' }}>
                       <option value="radio">ラジオボタン</option>
                       <option value="checkbox">チェックボックス</option>
                       <option value="text">テキスト入力</option>
                     </select>
                     <div style={{ display: 'flex', gap: '8px' }}>
                       <button className="btn btn-primary" onClick={() => handleSaveQuestion(editingQuestion)} style={{ flex: 1 }}>保存</button>
                       <button className="btn btn-secondary" onClick={() => setEditingQuestion(null)} style={{ flex: 1 }}>閉じる</button>
                     </div>
                   </div>
                 </div>
               </div>
             )}
          </div>
        )}

      </div>

      {tempApproveVehicle && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,16,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '24px' }} className="animate-fade">
          <div className="glass card" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: '24px', background: 'var(--panel-bg)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🅿️ 仮ナンバー承認</span>
              </h3>
              <button onClick={() => setTempApproveVehicle(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px', lineHeight: 1.5 }}>
              <strong>{tempApproveVehicle.roblox_username}</strong> の <strong>{tempApproveVehicle.year} {tempApproveVehicle.maker} {tempApproveVehicle.model}</strong> に対して、仮ナンバーの有効期間を選択してください。
            </p>
            
            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>有効期間 (Days)</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ff9f43' }}>{tempDays} <span style={{ fontSize: '1rem', fontWeight: 600 }}>日間</span></span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="90" 
                value={tempDays} 
                onChange={(e) => setTempDays(Number(e.target.value))} 
                style={{ 
                  width: '100%', 
                  accentColor: '#ff9f43',
                  height: '6px',
                  borderRadius: '3px',
                  background: 'rgba(255,255,255,0.1)',
                  outline: 'none',
                  cursor: 'pointer'
                }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                <span>1日</span>
                <span>30日</span>
                <span>60日</span>
                <span>90日</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="button"
                className="btn btn-secondary" 
                onClick={() => setTempApproveVehicle(null)} 
                style={{ flex: 1, padding: '14px', borderRadius: '12px', justifyContent: 'center' }}
              >
                キャンセル
              </button>
              <button 
                type="button"
                className="btn" 
                onClick={() => {
                  handleUpdateStatus(tempApproveVehicle.id, 'temp_approved', tempDays);
                  setTempApproveVehicle(null);
                }} 
                style={{ 
                  flex: 1.5, 
                  padding: '14px', 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #ff9f43, #ffb142)', 
                  color: '#000', 
                  border: 'none', 
                  fontWeight: 800, 
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(255, 159, 67, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}
              >
                <CheckCircle2 size={18} /> 承認する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
