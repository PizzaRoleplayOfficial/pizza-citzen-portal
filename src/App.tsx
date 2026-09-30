import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Tesseract from 'tesseract.js';
import { LandingView } from './views/LandingView';
import { ApplicationFormView } from './views/ApplicationFormView';
import { MyGarageView } from './views/MyGarageView';
import { ProfileView } from './views/ProfileView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { TimelineView } from './views/TimelineView';
import { DirectMessagesView } from './views/DirectMessagesView';
import { MaintenanceView } from './views/MaintenanceView';
import { 
  Car, 
  Plus, 
  Search as SearchIcon, 
  LogOut, 
  ShieldCheck, 
  Trash2, 
  Edit3,
  CheckCircle2,
  Clock,
  XCircle,
  LayoutDashboard,
  LayoutGrid,
  List,
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ArrowLeft,
  Image as ImageIcon,
  ClipboardList,
  Lock,
  X,
  Palette,
  Home,
  BookOpen,
  RefreshCw,
  RotateCcw,
  Menu,
  Info,
  MessageSquare,
  Mail,
  Bell,
  Heart,
  AlertTriangle,
  Flame,
  MessageCircle
} from 'lucide-react';
import { isNative, pickImagesNative, pickImageFilesNative } from './utils/native';
import { 
  checkLatestRelease, 
  downloadAndInstallApk, 
  isNewerVersion, 
  CURRENT_VERSION 
} from './utils/updater';
import { fetchWikiCatalog, saveCatalogToDatabase } from './utils/wikiSync';

// carModels is now loaded dynamically via useEffect

type VehicleStatus = 'approved' | 'pending' | 'rejected';

interface Vehicle {
  id: string;
  owner_id: string;
  maker: string;
  model: string;
  year: number;
  trim: string;
  color: string;
  plate: string;
  plate_region: string;
  status: VehicleStatus;
  reject_reason?: string;
  created_at?: string;
  reviewed_at?: string;
  roblox_username: string;
  discord_username?: string;
  discord_avatar?: string;
  image_data?: string;
}

interface User {
  id: string;
  username: string;
  avatar: string;
  role: 'user' | 'admin';
  roblox_username?: string;
}

const INITIAL_USER: User = {
  id: '12345',
  username: 'Keabu_Roblox',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Keabu',
  role: 'user'
};

import { StatusBadge, parseImages, getImageUrl } from './components/UIBase';
import { compressImage, compressDualImage } from './utils/helpers';
import { useIsMobile } from './hooks/useIsMobile';
import { ImageLightbox } from './components/ImageLightbox';
import { VehicleImageGallery } from './components/VehicleImageGallery';
import { formatDate, parseUTCDate } from './utils/helpers';
import { triggerHaptic, scheduleLocalNotification, requestNotificationPermission, startBackgroundPoll, stopBackgroundPoll, updateBackgroundPollCache, registerPushNotifications, unregisterPushNotifications, updateApplicationTrackerNotification, getLiveProgress, updateVehicleTrackerNotification } from './utils/native';
import { Capacitor } from '@capacitor/core';
import { handleAvatarError } from './utils/avatarFallback';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BackGesture } from './utils/backGesture';
import { getOutbox, removeFromOutbox } from './utils/outbox';

const VEHICLE_REJECT_TEMPLATES = [
  "ナンバープレートが不鮮明 / 判別できません",
  "ナンバープレートの書式が異なります（ひらがな・分類番号等の誤り）",
  "添付画像が暗すぎる、または見づらい状態です",
  "スポーツカー / スーパーカー等の登録対象外の車両です",
  "登録済みの同一車両（重複申請）です"
];

const CITIZEN_REJECT_TEMPLATES = [
  "Robloxユーザー名が不一致、または存在しません",
  "添付画像（市民権等の証明）が不足、または不鮮明です",
  "申請内容に不備、または不審な点があります",
  "テストの解答が基準に満たない、またはいたずら申請です"
];

const VEHICLE_WARNING_TEMPLATES = [
  "ウィング / スポイラー等のパーツ非推奨（公道走行注意）",
  "極端なローダウン / シャコタン仕様",
  "その他、公道における安全性が懸念されるカスタム"
];


export default function App() {
  const [backProgress, setBackProgress] = useState<number>(0);
  const [isBackSwiping, setIsBackSwiping] = useState<boolean>(false);
  const [carModels, setCarModels] = useState<Record<string, string[]>>({});
  const loadCatalog = async (gameType: 'gv' | 'rc') => {
    try {
      const res = await fetch(`/api/catalog?gameType=${gameType}`);
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.carModels) {
          setCarModels(data.carModels);
          return;
        } else if (data && data.catalog) {
          setCarModels(data.catalog);
          return;
        }
      }
    } catch (e) {
      console.error(`Failed to load ${gameType} dynamic catalog, falling back:`, e);
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
  };
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USER);
  const [maintenanceInfo, setMaintenanceInfo] = useState<{
    enabled: boolean;
    title: string;
    message: string;
    estimatedEnd?: string;
    discordUrl?: string;
    updatedAt?: string | null;
  } | null>(null);
  const [isCheckingMaintenance, setIsCheckingMaintenance] = useState(false);

  const fetchSystemStatus = async () => {
    try {
      setIsCheckingMaintenance(true);
      const res = await fetch('/api/system-status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.maintenance) {
          setMaintenanceInfo(data.maintenance);
        }
      }
    } catch (e) {
      console.error('Failed to fetch system status:', e);
    } finally {
      setIsCheckingMaintenance(false);
    }
  };

  const handleUpdateMaintenance = async (info: any) => {
    try {
      const res = await fetch('/api/system-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maintenance: info })
      });
      if (res.ok) {
        const data = await res.json() as any;
        if (data && data.maintenance) {
          setMaintenanceInfo(data.maintenance);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to update maintenance mode:', e);
      return false;
    }
  };

  const handleAdminLogin = async () => {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: 'https://pizza-citzen-portal.pages.dev/api/auth/login?source=app' });
    } else {
      window.location.href = '/api/auth/login';
    }
  };
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pushSettings, setPushSettings] = useState({
    resultsEnabled: localStorage.getItem('gvvr_push_results') !== 'false',
    adminEnabled: localStorage.getItem('gvvr_push_admin') !== 'false',
    adminEditEnabled: localStorage.getItem('gvvr_push_admin_edit') !== 'false',
    timelineLikeEnabled: localStorage.getItem('gvvr_push_timeline_like') !== 'false',
    timelineCommentEnabled: localStorage.getItem('gvvr_push_timeline_comment') !== 'false',
    timelineNewPostEnabled: localStorage.getItem('gvvr_push_timeline_new_post') !== 'false'
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('gvvr_theme') as 'dark' | 'light') || 'light';
  });
  const [enterKeyBehavior, setEnterKeyBehavior] = useState<'enter' | 'shiftEnter'>(
    (localStorage.getItem('gvvr_enter_key_behavior') as 'enter' | 'shiftEnter') || 'enter'
  );
  const [liteMode, setLiteMode] = useState<boolean>(() => {
    const cached = localStorage.getItem('gvvr_lite_mode');
    if (cached !== null) {
      return cached === 'true';
    }
    // 自動判定: CPU 4コア以下、または RAM 4GB未満の場合デフォルトON
    const cpuCores = navigator.hardwareConcurrency || 8;
    const deviceMemory = (navigator as any).deviceMemory || 8;
    return cpuCores <= 4 || deviceMemory < 4;
  });

  const handleToggleLiteMode = (enabled: boolean) => {
    setLiteMode(enabled);
    localStorage.setItem('gvvr_lite_mode', String(enabled));
    triggerHaptic('light');
  };

  const [dataSaverEnabled, setDataSaverEnabled] = useState<boolean>(() => {
    return localStorage.getItem('gvvr_data_saver') === 'true';
  });

  const handleToggleDataSaver = (enabled: boolean) => {
    setDataSaverEnabled(enabled);
    localStorage.setItem('gvvr_data_saver', String(enabled));
    triggerHaptic('light');
  };

  // 軽量モードのボディクラスのトグル
  useEffect(() => {
    document.body.classList.toggle('lite-mode', liteMode);
  }, [liteMode]);


  useEffect(() => {
    localStorage.setItem('gvvr_enter_key_behavior', enterKeyBehavior);
  }, [enterKeyBehavior]);

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    isNative ? localStorage.getItem('gvvr_sidebar_collapsed') === 'true' : false
  );

  const toggleSidebar = () => {
    const nextState = !sidebarCollapsed;
    setSidebarCollapsed(nextState);
    if (isNative) {
      localStorage.setItem('gvvr_sidebar_collapsed', String(nextState));
    }
    triggerHaptic('light');
  };


  const getInitialHashState = () => {
    const hash = window.location.hash.replace('#', '');
    const parts = hash.split('/');
    const mainView = parts[0];
    const subTab = parts[1];
    const validViews = ['home', 'intro', 'garage', 'admin', 'profile', 'apply', 'timeline', 'messages'];
    const validSubTabs = ['dashboard', 'vehicles', 'users', 'lookup', 'applications', 'questions', 'catalog', 'maintenance'];
    
    return {
      view: (validViews.includes(mainView) ? mainView : 'home') as 'home' | 'intro' | 'garage' | 'admin' | 'profile' | 'apply' | 'timeline' | 'messages',
      adminTab: (mainView === 'admin' && subTab && validSubTabs.includes(subTab) ? subTab : null) as any
    };
  };

  const initialParsed = getInitialHashState();
  const [view, setView] = useState<'home' | 'intro' | 'garage' | 'admin' | 'profile' | 'apply' | 'timeline' | 'messages'>(initialParsed.view);
  const [dmTargetConversationId, setDmTargetConversationId] = useState<string | null>(null);
  const [dmTargetUserId, setDmTargetUserId] = useState<string | null>(null);
  const [unreadDmCount, setUnreadDmCount] = useState<number>(0);
  const [isNavigatingBack, setIsNavigatingBack] = useState<boolean>(false);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState<boolean>(false);
  // Poll unread DM count
  const fetchUnreadDmCount = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/dm?action=unread_total&userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setUnreadDmCount(data.unread_total || 0);
      }
    } catch (e) {
      // silent
    }
  };

  useEffect(() => {
    fetchUnreadDmCount();
    // 高速未読数同期 (4秒間隔)
    const interval = setInterval(() => {
      if (!document.hidden && currentUser?.id) {
        fetchUnreadDmCount();
      }
    }, 8000);

    const handleOpenDmEvent = (e: any) => {
      if (e.detail?.targetUserId) {
        setDmTargetUserId(e.detail.targetUserId);
        setView('messages');
      } else if (e.detail?.conversationId) {
        setDmTargetConversationId(e.detail.conversationId);
        setView('messages');
      }
    };
    window.addEventListener('gv-open-dm', handleOpenDmEvent);

    // 通知センターやDM既読時の即時バッジ更新リスナー
    const handleNotifRefresh = () => {
      fetchUnreadDmCount();
      fetchNotifications();
    };
    window.addEventListener('gv-notifications-refresh', handleNotifRefresh);

    return () => {
      clearInterval(interval);
      window.removeEventListener('gv-open-dm', handleOpenDmEvent);
      window.removeEventListener('gv-notifications-refresh', handleNotifRefresh);
    };
  }, [currentUser?.id]);

  // PC/Web利用時のリアルタイム存在検知 (PC操作中にスマホアプリへ二重プッシュ通知を送らない制御)
  useEffect(() => {
    if (!currentUser?.id || isNative) return;

    const pingPresence = (status = 'online') => {
      if (document.hidden && status === 'online') return;
      try {
        fetch('/api/user-presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, platform: 'web', status }),
          keepalive: true
        }).catch(() => {});
      } catch {}
    };

    pingPresence('online');
    const presenceTimer = setInterval(() => {
      pingPresence('online');
    }, 35000);

    const handleVis = () => {
      if (!document.hidden) pingPresence('online');
    };

    const handleBeforeUnload = () => {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/user-presence',
          new Blob([JSON.stringify({ userId: currentUser.id, platform: 'web', status: 'offline' })], { type: 'application/json' })
        );
      }
    };

    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(presenceTimer);
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser?.id, isNative]);


  const [adminTab, setAdminTab] = useState<'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog' | 'maintenance'>(
    initialParsed.adminTab || (sessionStorage.getItem('gvvr_adminTab') as any) || 'dashboard'
  );
  const setAdminTabPersist = (tab: 'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog' | 'maintenance') => {
    sessionStorage.setItem('gvvr_adminTab', tab);
    setAdminTab(tab);
    triggerHaptic('light');
    
    // Hash-based sub-tab routing configuration
    const targetHash = tab === 'dashboard' ? 'admin' : `admin/${tab}`;
    if (window.location.hash.replace('#', '') !== targetHash) {
      if (tab !== 'dashboard' && adminTab !== 'dashboard') {
        // Switching sub-tab to sub-tab replaces history stack to avoid cluttering back gestures
        const url = new URL(window.location.href);
        url.hash = targetHash;
        window.history.replaceState(null, '', url.toString());
      } else {
        window.location.hash = targetHash;
      }
    }
  };

  const handlePushNotificationAction = (data: { action: string; tab?: string }) => {
    console.log('Push notification redirect action:', data);
    triggerHaptic('medium');

    if (data.action === 'admin') {
      setView('admin');
      if (data.tab) {
        setAdminTabPersist(data.tab as any);
      }
    } else if (data.action === 'garage') {
      setView('garage');
    } else if (data.action === 'apply') {
      setView('apply');
    } else if (data.action === 'home') {
      setView('home');
    } else if (data.action === 'timeline') {
      setView('timeline');
    } else if (data.action && data.action.startsWith('dm')) {
      setView('messages');
      const convMatch = data.action.match(/conversationId=([^&]+)/);
      const partnerMatch = data.action.match(/partnerId=([^&]+)/);
      if (convMatch) setDmTargetConversationId(convMatch[1]);
      if (partnerMatch) setDmTargetUserId(partnerMatch[1]);
    }
  };

  const [wikiPreviewUrl, setWikiPreviewUrl] = useState<string | null>(null);
  const [wikiSyncProgress, setWikiSyncProgress] = useState<string | null>(null);
  const [wikiTrims, setWikiTrims] = useState<string[]>([]);
  const [wikiColors, setWikiColors] = useState<string[]>([]);
  const [wikiLoading, setWikiLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allSearchVehicles, setAllSearchVehicles] = useState<Vehicle[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQuickActionSheet, setShowQuickActionSheet] = useState(false);
  const [triggerTimelineComposer, setTriggerTimelineComposer] = useState(false);
  
  const handleMobilePlusClick = () => {
    triggerHaptic('medium');
    if (view === 'timeline') {
      setTriggerTimelineComposer(true);
    } else {
      setShowQuickActionSheet(true);
    }
  };

  const [registrationMode, setRegistrationMode] = useState<'normal' | 'temp'>('normal');
  const [showTrailerModal, setShowTrailerModal] = useState(false);
  const [showBetaAutoFillModal, setShowBetaAutoFillModal] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [garageTab, setGarageTab] = useState<'car' | 'trailer'>('car');
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [selectedUserForVehicles, setSelectedUserForVehicles] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const isMobile = useIsMobile();

  const [holoPos, setHoloPos] = useState({ x: 50, y: 50, active: false });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [inAppToast, setInAppToast] = useState<{ title: string; desc: string; type?: 'success' | 'warning' | 'error' | 'info'; action?: () => void } | null>(null);

  // Auto close toast after 4.5 seconds
  useEffect(() => {
    if (!inAppToast) return;
    const timer = setTimeout(() => {
      setInAppToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [inAppToast]);

  // Listen for global custom events to show toast notifications
  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ title: string; desc: string; type?: 'success' | 'warning' | 'error' | 'info'; action?: () => void }>;
      if (customEvent.detail) {
        setInAppToast({
          title: customEvent.detail.title,
          desc: customEvent.detail.desc,
          type: customEvent.detail.type || 'info',
          action: customEvent.detail.action
        });
      }
    };
    window.addEventListener('gv-toast', handleGlobalToast);
    return () => window.removeEventListener('gv-toast', handleGlobalToast);
  }, []);

  // Notifications related states (v2.2.0)
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [targetTimelinePostId, setTargetTimelinePostId] = useState<string | null>(null);
  const [recentTimelinePosts, setRecentTimelinePosts] = useState<any[]>([]);

  useEffect(() => {
    if (view === 'home' && isLoggedIn) {
      fetch('/api/timeline?limit=3')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.posts) {
            setRecentTimelinePosts(data.posts.slice(0, 3));
          }
        })
        .catch(err => console.error('Failed to load recent timeline posts:', err));
    }
  }, [view, isLoggedIn]);
  const lastNotificationIdRef = React.useRef<string | null>(null);

  const fetchNotifications = async () => {
    if (!isLoggedIn || !currentUser?.id) return;
    try {
      const res = await fetch(`/api/notifications?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        const newNotifications = data.notifications || [];

        // Triggers Web Browser/Native notification if a new unread notification is retrieved via polling
        if (lastNotificationIdRef.current !== null && newNotifications.length > 0) {
          const newUnread = newNotifications.filter((n: any) => 
            n.is_read === 0 && 
            !notifications.some((old: any) => old.id === n.id)
          );
          if (newUnread.length > 0) {
            const newest = newUnread[0];
            
            // Push system notification (Web環境のみ。アプリではFCMが直接届くため重複防止)
            if (!isNative) {
              scheduleLocalNotification(
                newest.title || 'ぴっざぁ市民ポータル',
                newest.body || '新しい通知が届きました。',
                0
              );
            }

            // Trigger beautiful in-app sliding glassmorphic toast
            setInAppToast({
              title: newest.title || 'ぴっざぁ市民ポータル',
              desc: newest.body || '新しい通知が届きました。',
              action: () => {
                triggerHaptic('medium');
                setShowNotifications(true);
              }
            });
          }
        }

        if (newNotifications.length > 0) {
          lastNotificationIdRef.current = newNotifications[0].id;
        } else {
          lastNotificationIdRef.current = '';
        }

        setNotifications(newNotifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  const handleMarkAllNotificationsAsRead = async () => {
    triggerHaptic('light');
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, markAll: true })
      });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const handleNotificationClick = async (notif: any) => {
    triggerHaptic('medium');
    setShowNotifications(false);
    
    if (notif.is_read === 0) {
      try {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUser.id, id: notif.id })
        });
        if (res.ok) {
          setUnreadCount(prev => Math.max(0, prev - 1));
          setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
        }
      } catch (err) {
        console.error("Failed to mark notification as read:", err);
      }
    }

    if (notif.link_action && notif.link_action.startsWith('dm')) {
      setView('messages');
      const convMatch = notif.link_action.match(/conversationId=([^&]+)/);
      const partnerMatch = notif.link_action.match(/partnerId=([^&]+)/);
      if (convMatch) setDmTargetConversationId(convMatch[1]);
      if (partnerMatch) setDmTargetUserId(partnerMatch[1]);
    } else if (notif.link_action && notif.link_action.startsWith('timeline')) {
      setView('timeline');
      const match = notif.link_action.match(/postId=([^&]+)/);
      if (match && match[1]) {
        setTargetTimelinePostId(match[1]);
      }
    } else if (notif.link_action === 'garage' || notif.link_action === 'my_garage') {
      setView('garage');
    } else if (notif.link_action === 'apply') {
      setView('apply');
    } else if (notif.link_action === 'admin') {
      setView('admin');
      if (notif.body.includes('市民申請') || notif.title.includes('市民申請')) {
        setAdminTabPersist('applications');
      } else if (notif.body.includes('車両') || notif.title.includes('車両')) {
        setAdminTabPersist('vehicles');
      } else {
        setAdminTabPersist('dashboard');
      }
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const past = parseUTCDate(dateStr);
      if (!past || past.getTime() === 0) return '';
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - past.getTime());
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return '今';
      if (diffMins < 60) return `${diffMins}分前`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}時間前`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return '昨日';
      if (diffDays < 7) return `${diffDays}日前`;
      return past.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'dm_messages_channel':
        return <Mail size={16} />;
      case 'timeline_likes_channel':
        return <Heart size={16} />;
      case 'timeline_comments_channel':
        return <MessageSquare size={16} />;
      case 'application_results_channel':
        return <ClipboardList size={16} />;
      case 'admin_notifications_channel':
      case 'admin_edit_notifications_channel':
        return <ShieldCheck size={16} />;
      case 'follow':
        return <UserIcon size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const getNotificationIconBg = (type: string) => {
    switch (type) {
      case 'dm_messages_channel':
        return 'var(--primary)';
      case 'timeline_likes_channel':
        return 'var(--error)';
      case 'timeline_comments_channel':
        return 'var(--primary)';
      case 'application_results_channel':
        return 'var(--success)';
      case 'admin_notifications_channel':
      case 'admin_edit_notifications_channel':
        return '#f59e0b';
      case 'follow':
        return '#3b82f6';
      default:
        return 'rgba(255,255,255,0.08)';
    }
  };

  useEffect(() => {
    if (isLoggedIn && currentUser?.id) {
      fetchNotifications();
      const interval = setInterval(() => {
        if (document.hidden) return;
        fetchNotifications();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, currentUser?.id]);

  // Launch / Boot Splash Animation State (v1.5.24)
  const [showBootSplash, setShowBootSplash] = useState(isNative);
  const [bootSplashFade, setBootSplashFade] = useState(false);

  useEffect(() => {
    if (isNative) {
      // 1. Trigger the premium double haptic welcome vibration shortly after mount
      const hapticTimer = setTimeout(() => {
        triggerHaptic('success');
      }, 400);

      // 2. Play the fade-out animation after the loading bar is 100% complete (2.0s duration)
      const fadeTimer = setTimeout(() => {
        setBootSplashFade(true);
      }, 2100);

      // 3. Fully unmount the overlay after the fade transition completes (2.9s)
      const unmountTimer = setTimeout(() => {
        setShowBootSplash(false);
        document.body.classList.remove('boot-loading');
      }, 2900);

      return () => {
        clearTimeout(hapticTimer);
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
        document.body.classList.remove('boot-loading');
      };
    } else {
      // Web browser flow: remove boot-loading immediately if boot splash is skipped
      document.body.classList.remove('boot-loading');
    }
  }, []);

  // Application state
  const [myApplication, setMyApplication] = useState<any>(null);
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [usersViewMode, setUsersViewMode] = useState<'grid' | 'list'>('grid');
  
  const [lookupViewMode, setLookupViewMode] = useState<'grid' | 'list'>('grid');
  
  const [garageViewMode, setGarageViewMode] = useState<'grid' | 'list'>('grid');
  const [garageSortOrder, setGarageSortOrder] = useState<string>('newest');

  const [applyAnswers, setApplyAnswers] = useState<Record<string, any>>({});
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [allQuestionsAdmin, setAllQuestionsAdmin] = useState<any[]>([]);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectModal, setRejectModal] = useState<{
    isOpen: boolean;
    type: 'vehicle' | 'citizen' | 'vehicle_warning';
    targetId: string | null;
    reason: string;
  }>({
    isOpen: false,
    type: 'vehicle',
    targetId: null,
    reason: ''
  });
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [infoModal, setInfoModal] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });
  const [updateState, setUpdateState] = useState<{
    isOpen: boolean;
    latestVersion: string;
    notes: string;
    apkUrl: string;
    downloadProgress: number;
    status: 'idle' | 'downloading' | 'error' | 'success';
    errorMsg?: string;
  }>({
    isOpen: false,
    latestVersion: '',
    notes: '',
    apkUrl: '',
    downloadProgress: 0,
    status: 'idle'
  });
  const [appVersion, setAppVersion] = useState<string>(CURRENT_VERSION);
  const [autoCheckUpdates, setAutoCheckUpdates] = useState<boolean>(() => {
    return localStorage.getItem('auto_check_updates') !== 'false';
  });
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminSortOrder, setAdminSortOrder] = useState<'newest' | 'oldest' | 'maker' | 'userCount'>('newest');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userSortOrder, setUserSortOrder] = useState<'newest' | 'oldest' | 'maker'>('newest');
  const [adminStats, setAdminStats] = useState({ pendingVehicles: 0, pendingApps: 0, totalPending: 0 });

  const [formData, setFormData] = useState({
    game_type: 'gv',
    maker: '',
    model: '',
    year: 2024,
    trim: '',
    color: '',
    plate: '',
    plate_region: 'WISCONSIN',
    roblox_username: '',
    image_data: ''
  });

  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [trailerSubmitting, setTrailerSubmitting] = useState(false);
  const [trailerFormData, setTrailerFormData] = useState({
    game_type: 'gv',
    model: '',
    maker: '',
    trailer_type: '',
    color: '',
    plate: '',
    plate_region: 'WISCONSIN',
    roblox_username: '',
    image_data: ''
  });

  const [vehicleSubmitting, setVehicleSubmitting] = useState(false);
  const [plateChecking, setPlateChecking] = useState(false);
  const [plateDuplicateWarning, setPlateDuplicateWarning] = useState<string | null>(null);
  const [trailerPlateChecking, setTrailerPlateChecking] = useState(false);
  const [trailerPlateDuplicateWarning, setTrailerPlateDuplicateWarning] = useState<string | null>(null);
  const isInitialLoadFinishedRef = React.useRef(false);

  useEffect(() => {
    if (view === 'admin') {
      const targetHash = adminTab === 'dashboard' ? 'admin' : `admin/${adminTab}`;
      if (window.location.hash.replace('#', '') !== targetHash) {
        window.location.hash = targetHash;
      }
    } else {
      if (window.location.hash.replace('#', '') !== view) {
        window.location.hash = view;
      }
    }
    // 初回ロード完了時は振動させず、その後のユーザーによる画面切り替え時のみ振動
    if (!isInitialLoadFinishedRef.current) {
      if (!isLoading) {
        isInitialLoadFinishedRef.current = true;
      }
      return;
    }
    if (!isLoading) {
      triggerHaptic('light');
    }
  }, [view, adminTab, isLoading]);

  useEffect(() => {
    if (isNavigatingBack) {
      const timer = setTimeout(() => {
        setIsNavigatingBack(false);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [view, adminTab, isNavigatingBack]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const parts = hash.split('/');
      const mainView = parts[0];
      const subTab = parts[1];
      const validViews = ['home', 'intro', 'garage', 'admin', 'profile', 'apply', 'timeline', 'messages'];
      const validSubTabs = ['dashboard', 'vehicles', 'users', 'lookup', 'applications', 'questions', 'catalog', 'maintenance'];
      
      if (validViews.includes(mainView)) {
        setView(mainView as any);
        if (mainView === 'admin') {
          if (subTab && validSubTabs.includes(subTab)) {
            setAdminTab(subTab as any);
            sessionStorage.setItem('gvvr_adminTab', subTab);
          } else {
            setAdminTab('dashboard');
            sessionStorage.setItem('gvvr_adminTab', 'dashboard');
          }
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Real-time pre-flight duplicate plate checking for cars
  useEffect(() => {
    if (!showAddModal) {
      setPlateDuplicateWarning(null);
      setPlateChecking(false);
      return;
    }
    const cleanPlate = (formData.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase();
    if (cleanPlate.length < 2) {
      setPlateDuplicateWarning(null);
      setPlateChecking(false);
      return;
    }

    // Instant local memory check
    const game = (formData.game_type || 'gv').toLowerCase();
    const localMatch = vehicles.find(v => 
      v.status !== 'rejected' &&
      v.id !== editingVehicleId &&
      (v.game_type || 'gv').toLowerCase() === game &&
      (v.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase() === cleanPlate
    );
    if (localMatch) {
      setPlateDuplicateWarning('既にこの車両は登録されています！');
    }

    setPlateChecking(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          checkPlate: cleanPlate,
          gameType: formData.game_type || 'gv',
          excludeId: editingVehicleId || ''
        });
        const res = await fetch(`/api/vehicles?${params.toString()}`);
        if (res.ok) {
          const data = await res.json() as any;
          if (data.duplicate) {
            setPlateDuplicateWarning('既にこの車両は登録されています！');
          } else if (!localMatch) {
            setPlateDuplicateWarning(null);
          }
        }
      } catch (err) {
        console.error('Plate pre-check failed:', err);
      } finally {
        setPlateChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.plate, formData.game_type, showAddModal, editingVehicleId, vehicles]);

  // Real-time pre-flight duplicate plate checking for trailers
  useEffect(() => {
    if (!showTrailerModal) {
      setTrailerPlateDuplicateWarning(null);
      setTrailerPlateChecking(false);
      return;
    }
    const cleanPlate = (trailerFormData.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase();
    if (cleanPlate.length < 2) {
      setTrailerPlateDuplicateWarning(null);
      setTrailerPlateChecking(false);
      return;
    }

    // Instant local memory check
    const game = (trailerFormData.game_type || 'gv').toLowerCase();
    const localMatch = vehicles.find(v => 
      v.status !== 'rejected' &&
      v.id !== editingVehicleId &&
      (v.game_type || 'gv').toLowerCase() === game &&
      (v.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase() === cleanPlate
    );
    if (localMatch) {
      setTrailerPlateDuplicateWarning('既にこの車両は登録されています！');
    }

    setTrailerPlateChecking(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          checkPlate: cleanPlate,
          gameType: trailerFormData.game_type || 'gv',
          excludeId: editingVehicleId || ''
        });
        const res = await fetch(`/api/vehicles?${params.toString()}`);
        if (res.ok) {
          const data = await res.json() as any;
          if (data.duplicate) {
            setTrailerPlateDuplicateWarning('既にこの車両は登録されています！');
          } else if (!localMatch) {
            setTrailerPlateDuplicateWarning(null);
          }
        }
      } catch (err) {
        console.error('Trailer plate pre-check failed:', err);
      } finally {
        setTrailerPlateChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [trailerFormData.plate, trailerFormData.game_type, showTrailerModal, editingVehicleId, vehicles]);

  const handleSubmitTrailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trailerSubmitting) return;

    if (trailerPlateDuplicateWarning) {
      alert('既にこの車両は登録されています！別のナンバープレートを指定してください。');
      triggerHaptic('error');
      return;
    }

    if (!trailerFormData.model || !trailerFormData.plate) {
      alert('モデル名とナンバープレートは必須です。');
      triggerHaptic('warning');
      return;
    }

    const cleanPlate = (trailerFormData.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase();
    if (cleanPlate) {
      const game = (trailerFormData.game_type || 'gv').toLowerCase();
      const duplicateFound = vehicles.find(v => 
        v.status !== 'rejected' &&
        v.id !== editingVehicleId &&
        (v.game_type || 'gv').toLowerCase() === game &&
        (v.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase() === cleanPlate
      );
      if (duplicateFound) {
        setTrailerPlateDuplicateWarning('既にこの車両は登録されています！');
        alert('既にこの車両は登録されています！別のナンバープレートを指定してください。');
        triggerHaptic('error');
        return;
      }
    }

    setTrailerSubmitting(true);
    const method = editingVehicleId ? 'PUT' : 'POST';
    try {
      const payload = {
        ...trailerFormData,
        year: 2024,
        trim: '',
        owner_id: currentUser.id,
        roblox_username: currentUser.roblox_username,
        vehicle_type: 'trailer'
      };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });
      if (!res.ok) {
        const err = await res.json() as any;
        const errMsg = err.error || '登録に失敗しました。';
        if (res.status === 409 || errMsg.includes('既にこの車両は登録されています')) {
          setTrailerPlateDuplicateWarning('既にこの車両は登録されています！');
        }
        alert(errMsg);
        window.dispatchEvent(new CustomEvent('gv-toast', {
          detail: { title: '登録エラー', desc: errMsg, type: 'error' }
        }));
        triggerHaptic('error');
        return;
      }
      setShowTrailerModal(false);
      setEditingVehicleId(null);
      setTrailerFormData({ game_type: 'gv', model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
      setTrailerPlateDuplicateWarning(null);
      await fetchVehicles();
      const message = editingVehicleId ? 'トレーラー情報の更新申請を送信しました。再審査待ちになります。' : 'トレーラー登録申請を送信しました！審査待ちになります。';
      alert(message);
      triggerHaptic('success');
      scheduleLocalNotification(
        '申請送信完了',
        editingVehicleId ? 'トレーラー情報の更新申請を送信しました。' : 'トレーラー登録申請を送信しました！',
        0,
        'application_results_channel'
      );
    } catch {
      alert('ネットワークエラーが発生しました。');
      triggerHaptic('error');
    } finally {
      setTrailerSubmitting(false);
    }
  };


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('gvvr_theme', theme);
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({
        style: theme === 'dark' ? Style.Dark : Style.Light
      }).catch(err => console.warn('Capacitor StatusBar action failed:', err));
    }
  }, [theme]);

  useEffect(() => {

    if (Capacitor.isNativePlatform()) {
      try {
        // Edge-to-edge: web content renders behind system bars
        StatusBar.setOverlaysWebView({ overlay: true });
        if (theme === 'dark') {
          StatusBar.setStyle({ style: Style.Dark }); // Dark = white icons for dark background
        } else {
          StatusBar.setStyle({ style: Style.Light }); // Light = dark icons for light background
        }
      } catch (err) {
        console.warn('Capacitor StatusBar action failed:', err);
      }
    }
  }, [theme]);

  useEffect(() => {
    if (!showAddModal || !formData.maker || !formData.model) {
      setWikiPreviewUrl(null);
      setWikiTrims([]);
      setWikiColors([]);
      return;
    }
    const query = `${formData.year} ${formData.maker} ${formData.model}`;
    let cancelled = false;
    setWikiLoading(true);
    setWikiPreviewUrl(null);
    setWikiTrims([]);
    setWikiColors([]);
    fetch(`/api/wiki-image?v=4&q=${encodeURIComponent(query)}&gameType=${formData.game_type}${formData.trim ? `&trim=${encodeURIComponent(formData.trim)}` : ''}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (cancelled) return;
        if (data?.imageUrl) setWikiPreviewUrl(data.imageUrl);
        if (data?.trims && data.trims.length > 0) {
          const cleanTrims = data.trims.filter((t: string) => 
            t && !t.includes('$') && !/rowspan|colspan|file:|scope=|style=|purchase|sell/i.test(t)
          );
          setWikiTrims(cleanTrims);
        }
        if (data?.colors && data.colors.length > 0) {
          const cleanColors = data.colors.filter((c: string) => 
            c && !c.includes('$') && !/rowspan|colspan|file:|scope=|style=|purchase|sell/i.test(c)
          );
          setWikiColors(cleanColors);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWikiLoading(false); });
    return () => { cancelled = true; };
  }, [formData.maker, formData.model, formData.year, formData.trim, formData.game_type, showAddModal]);

  const fetchVehicles = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    const isAdminView = view === 'admin';
    const endpoint = isAdminView ? "/api/vehicles?admin=true" : `/api/vehicles?userId=${currentUser.id}`;
    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        if (isAdminView) {
          setAllSearchVehicles(list);
          const pendingList = list.filter((v: Vehicle) => v.status === 'pending');

          // 運営用の新規車両登録申請通知
          const prevPendingIdsStr = localStorage.getItem('gvvr_admin_pending_ids');
          const prevPendingIds: string[] = prevPendingIdsStr ? JSON.parse(prevPendingIdsStr) : [];
          const currentPendingIds = pendingList.map((v: Vehicle) => v.id);

          if (prevPendingIdsStr !== null) {
            const newPendings = pendingList.filter((v: Vehicle) => !prevPendingIds.includes(v.id));
            if (newPendings.length > 0) {
              const count = newPendings.length;
              const firstCar = newPendings[0];
              const title = '新規の車両登録申請';
              const body = count === 1
                ? `新規の登録申請が届きました: ${firstCar.roblox_username}さんの「${firstCar.maker} ${firstCar.model}」`
                : `新規の登録申請が${count}件届きました。`;
              // アプリ（FCM受信環境）では通知の2重送信を防ぐため、ローカル通知はWeb環境のみ実行
              if (!isNative) {
                scheduleLocalNotification(title, body, 0, 'admin_notifications_channel');
              }
            }
          }
          localStorage.setItem('gvvr_admin_pending_ids', JSON.stringify(currentPendingIds));
          setVehicles(pendingList);
        } else {
          // 一般ユーザー用の車両申請結果通知
          const cachedStr = localStorage.getItem(`gvvr_vehicle_statuses_${currentUser.id}`);
          const cached: Record<string, VehicleStatus> = cachedStr ? JSON.parse(cachedStr) : {};
          const newCache: Record<string, VehicleStatus> = {};

          list.forEach((v: Vehicle) => {
            newCache[v.id] = v.status;
            if (cachedStr !== null) {
              const oldStatus = cached[v.id];
              // アプリ版（FCM受信環境）では通知の2重受信を防ぐため、ステータス変更時のローカル通知をスキップします
              if (!Capacitor.isNativePlatform() && oldStatus === 'pending' && (v.status === 'approved' || v.status === 'rejected')) {
                const statusText = v.status === 'approved' ? '承認' : '却下';
                const carName = `${v.year}年式 ${v.maker} ${v.model}`;
                scheduleLocalNotification(
                  '車両登録申請の結果',
                  `車両「${carName}」（ナンバー: ${v.plate}）の申請が${statusText}されました。`,
                  0,
                  'application_results_channel'
                );
              }
            }
          });
          localStorage.setItem(`gvvr_vehicle_statuses_${currentUser.id}`, JSON.stringify(newCache));
          setVehicles(list);
          updateVehicleTrackerNotification(list);
        }
        // 管理者がマイガレージ閲覧中（個人車両のみ取得時）に全件キャッシュを壊さないよう保護
        if (currentUser.role !== 'admin' || isAdminView) {
          updateBackgroundPollCache(list);
        }
      }
    } catch (e) {
      console.error("Fetch vehicles failed:", e);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (view !== 'admin') return;
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setAllUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Fetch users failed:", e);
    }
  };

  const flushOutbox = async () => {
    const queue = getOutbox();
    if (queue.length === 0 || isSyncingOutbox) return;

    setIsSyncingOutbox(true);
    console.log(`Starting to flush ${queue.length} offline item(s) from Outbox...`);

    // Android LiveProgress 起動 (ネイティブ環境の場合)
    if (isNative) {
      try {
        await getLiveProgress().start({
          title: 'オフラインデータの同期',
          text: `同期中... (0/${queue.length} 件)`,
          progress: 0
        });
      } catch (err) {
        console.error('Failed to start LiveProgress for outbox sync:', err);
      }
    }

    let successCount = 0;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      
      // 進捗表示更新
      if (isNative) {
        try {
          await getLiveProgress().update({
            title: 'オフラインデータの同期',
            text: `同期中... (${i}/${queue.length} 件): ${item.description}`,
            progress: Math.round((i / queue.length) * 100)
          });
        } catch (err) {
          console.error('Failed to update LiveProgress during outbox sync:', err);
        }
      }

      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body ? JSON.stringify(item.body) : undefined
        });

        if (res.ok) {
          removeFromOutbox(item.id);
          successCount++;
        } else {
          console.error(`Failed to sync item ${item.id}: status ${res.status}`);
          // リトライ不可能なエラー (400系) なら削除
          if (res.status >= 400 && res.status < 500) {
            removeFromOutbox(item.id);
          }
        }
      } catch (err) {
        console.error(`Failed to connect during sync for item ${item.id}:`, err);
        break; // オフライン等のネットワーク断絶ならそこで中断
      }
    }

    // 終了処理
    if (isNative) {
      try {
        await getLiveProgress().update({
          title: 'オフラインデータの同期',
          text: `同期が完了しました (${successCount} 件成功)`,
          progress: 100
        });
        setTimeout(() => {
          getLiveProgress().stop({ title: 'オフラインデータの同期' }).catch(e => console.error(e));
        }, 1500);
      } catch (err) {
        console.error('Failed to stop LiveProgress for outbox sync:', err);
      }
    }

    setIsSyncingOutbox(false);

    if (successCount > 0) {
      // タイムラインなどの画面にリフレッシュを促す
      window.dispatchEvent(new CustomEvent('gvvr-timeline-refresh'));
    }
  };

  const fetchApplication = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const app = await res.json();
        if (app && app.status) {
          const cachedStatus = localStorage.getItem(`gvvr_citizen_app_status_${currentUser.id}`);
          if (cachedStatus !== null) {
            // アプリ版（FCM受信環境）では通知の2重受信を防ぐため、ステータス変更時のローカル通知をスキップします
            if (!Capacitor.isNativePlatform() && cachedStatus === 'pending' && (app.status === 'approved' || app.status === 'rejected')) {
              const statusText = app.status === 'approved' ? '承認' : '却下';
              scheduleLocalNotification(
                '市民申請の結果',
                `市民登録申請が${statusText}されました。${app.status === 'rejected' && app.reject_reason ? `理由: ${app.reject_reason}` : ''}`,
                0,
                'application_results_channel'
              );
            }
          }
          localStorage.setItem(`gvvr_citizen_app_status_${currentUser.id}`, app.status);
          updateApplicationTrackerNotification(app);
        } else {
          localStorage.setItem(`gvvr_citizen_app_status_${currentUser.id}`, 'none');
          updateApplicationTrackerNotification(null);
        }
        setMyApplication(app);
      }
    } catch (e) { console.error('Fetch application failed:', e); }
  };

  const fetchAllApplications = async () => {
    try {
      const res = await fetch('/api/applications?admin=true');
      if (res.ok) {
        const data = await res.json();
        setAllApplications(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Fetch all applications failed:', e); }
  };

  const fetchQuestions = async (adminMode = false) => {
    try {
      const res = await fetch(adminMode ? '/api/questions?admin=true' : '/api/questions');
      if (res.ok) {
        const data = await res.json() as any[];
        if (adminMode) setAllQuestionsAdmin(Array.isArray(data) ? data : []);
        else setQuestions(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error('Fetch questions failed:', e); }
  };

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const user = await res.json();
          setCurrentUser(user as User);
          setIsLoggedIn(true);
        }
      } catch (e) {
        console.error("Auth check failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLogin();
    fetchSystemStatus();
    const maintInterval = setInterval(fetchSystemStatus, 30000);

    // アプリ初回起動時に通知などの必要な権限をリクエスト
    requestNotificationPermission();

    // Deep Link handling in Capacitor native app
    if (Capacitor.isNativePlatform()) {
      // Get the native version from the device dynamically
      if (CapApp && typeof CapApp.getInfo === 'function') {
        CapApp.getInfo().then((info) => {
          if (info && info.version) {
            setAppVersion(info.version);
            console.log('Native app version:', info.version);
          }
        }).catch((err) => {
          console.error('Failed to get native app info:', err);
        });
      }

      const setupDeepLink = async () => {
        if (CapApp && typeof CapApp.addListener === 'function') {
          try {
            await CapApp.addListener('appUrlOpen', async (data: { url: string }) => {
              console.log('App opened with URL:', data.url);
              try {
                const parsedUrl = new URL(data.url);
                if (parsedUrl.host === 'auth-callback') {
                  const userParam = parsedUrl.searchParams.get('user');
                  if (userParam) {
                    const userObj = JSON.parse(decodeURIComponent(userParam));
                    // Set non-HttpOnly cookie for the WebView so that all fetch requests will include it
                    const cookieVal = `gv_user=${encodeURIComponent(JSON.stringify(userObj))}; Path=/; Max-Age=2592000; SameSite=Lax`;
                    document.cookie = cookieVal;
                    
                    // Close the custom tab or external browser opened for OAuth
                    if (Browser && typeof Browser.close === 'function') {
                      try {
                        await Browser.close();
                      } catch (e) {
                        console.warn('Failed to close browser (may already be closed or not support close)', e);
                      }
                    }
                    
                    // Reload window to re-trigger login check
                    window.location.reload();
                  }
                } else if (parsedUrl.host === 'timeline' || (parsedUrl.host === 'pizzaportal' && parsedUrl.pathname === '/timeline')) {
                  const postId = parsedUrl.searchParams.get('postId');
                  setView('timeline');
                  if (postId) {
                    setTargetTimelinePostId(postId);
                  }
                } else if (parsedUrl.host === 'dm' || (parsedUrl.host === 'pizzaportal' && parsedUrl.pathname === '/dm') || parsedUrl.pathname === '/messages') {
                  const convId = parsedUrl.searchParams.get('conversationId');
                  const partnerId = parsedUrl.searchParams.get('partnerId');
                  setView('messages');
                  if (convId) setDmTargetConversationId(convId);
                  if (partnerId) setDmTargetUserId(partnerId);
                }
              } catch (err) {
                console.error('Failed to parse Deep Link URL:', err);
              }
            });
          } catch (err) {
            console.error('Failed to add appUrlOpen listener:', err);
          }
        } else {
          console.warn('CapApp is not available or addListener is not a function');
        }
      };
      setupDeepLink();
    }
    
    // Parse initial postId from query parameters or hash to navigate to the post on web/app
    const urlParams = new URLSearchParams(window.location.search);
    let postId = urlParams.get('postId');
    if (!postId && window.location.hash) {
      const hashParts = window.location.hash.split('?');
      if (hashParts[1]) {
        const hashParams = new URLSearchParams(hashParts[1]);
        postId = hashParams.get('postId');
      }
    }

    if (postId) {
      // Redirect to native app if opened in web browser on a mobile device
      if (!Capacitor.isNativePlatform()) {
        const ua = navigator.userAgent.toLowerCase();
        const isMobileDevice = /iphone|ipad|ipod|android/.test(ua);
        if (isMobileDevice) {
          console.log('Attempting to redirect to native app via custom scheme...');
          window.location.href = `pizzaportal://timeline?postId=${postId}`;
        }
      }
      
      // Navigate and highlight the post on web / native app fallback
      setView('timeline');
      setTargetTimelinePostId(postId);
    }

    // Redundant loadCatalog('gv') call removed for startup performance. Catalog is dynamically loaded when opening the Add Vehicle Modal.
  }, []);

  // ログイン状態に応じてバックグラウンドポーリングを開始・停止、およびFCMリアルタイムプッシュ通知の登録・解除、さらにオフライン自動同期監視 (v2.3.0)
  useEffect(() => {
    let statusUpdateListener: ((e: Event) => void) | null = null;
    let onlineListener: (() => void) | null = null;

    if (isLoggedIn && currentUser && currentUser.id) {
      startBackgroundPoll(
        currentUser.id,
        currentUser.role || 'user',
        window.location.origin
      );
      registerPushNotifications(currentUser.id, handlePushNotificationAction);

      // FCMのステータス更新検知リスナーを追加
      statusUpdateListener = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        console.log('Received FCM status update event:', detail);
        if (detail && detail.updateType === 'citizen_application') {
          console.log('FCM trigger: Fetching updated citizen application...');
          fetchApplication();
        } else if (detail && detail.updateType === 'vehicle_application') {
          console.log('FCM trigger: Fetching updated vehicles...');
          fetchVehicles(false);
        }
      };
      window.addEventListener('gvvr-fcm-status-update', statusUpdateListener);

      // オンライン復帰時の自動同期監視を追加
      onlineListener = () => {
        console.log('Network status changed: ONLINE. Flushing outbox...');
        flushOutbox();
      };
      window.addEventListener('online', onlineListener);

      // ログイン初期ロード時にも未同期のキューがあればフラッシュ
      flushOutbox();
    } else if (!isLoggedIn && !isLoading) {
      stopBackgroundPoll();
      if (currentUser && currentUser.id) {
        unregisterPushNotifications(currentUser.id);
      }
      if (isNative) {
        getLiveProgress().stop().catch(err => console.error('Failed to stop LiveProgress on guest load:', err));
      }
    }

    return () => {
      if (statusUpdateListener) {
        window.removeEventListener('gvvr-fcm-status-update', statusUpdateListener);
      }
      if (onlineListener) {
        window.removeEventListener('online', onlineListener);
      }
    };
  }, [isLoggedIn, currentUser, isLoading]);

  // =========================================================================
  // ネイティブ「戻る」操作（ジェスチャー・ハードウェアボタン）および履歴の同期処理
  // =========================================================================

  // 車両登録モーダルが開いた瞬間に、選択中のゲームタイプのカタログを自動ロードする
  useEffect(() => {
    if (showAddModal && formData.game_type) {
      loadCatalog(formData.game_type);
    }
  }, [showAddModal]);

  // 各モーダルの開閉状態を window.history と同期
  useEffect(() => {
    if (showAddModal) {
      if (window.history.state?.modal !== 'add') {
        window.history.pushState({ modal: 'add' }, '');
      }
    } else {
      if (window.history.state?.modal === 'add') {
        window.history.back();
      }
    }
  }, [showAddModal]);

  useEffect(() => {
    if (showTrailerModal) {
      if (window.history.state?.modal !== 'trailer') {
        window.history.pushState({ modal: 'trailer' }, '');
      }
    } else {
      if (window.history.state?.modal === 'trailer') {
        window.history.back();
      }
    }
  }, [showTrailerModal]);

  useEffect(() => {
    if (showBetaAutoFillModal) {
      if (window.history.state?.modal !== 'autofill') {
        window.history.pushState({ modal: 'autofill' }, '');
      }
    } else {
      if (window.history.state?.modal === 'autofill') {
        window.history.back();
      }
    }
  }, [showBetaAutoFillModal]);

  useEffect(() => {
    if (rejectModal.isOpen) {
      if (window.history.state?.modal !== 'reject') {
        window.history.pushState({ modal: 'reject' }, '');
      }
    } else {
      if (window.history.state?.modal === 'reject') {
        window.history.back();
      }
    }
  }, [rejectModal.isOpen]);

  useEffect(() => {
    if (updateState.isOpen) {
      if (window.history.state?.modal !== 'update') {
        window.history.pushState({ modal: 'update' }, '');
      }
    } else {
      if (window.history.state?.modal === 'update') {
        window.history.back();
      }
    }
  }, [updateState.isOpen]);

  // popstate イベント監視（履歴が戻った際にモーダルが開いていれば閉じる）
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      let modalClosed = false;
      if (showAddModal) {
        setShowAddModal(false);
        modalClosed = true;
      }
      if (showTrailerModal) {
        setShowTrailerModal(false);
        modalClosed = true;
      }
      if (showBetaAutoFillModal) {
        setShowBetaAutoFillModal(false);
        modalClosed = true;
      }
      if (rejectModal.isOpen) {
        setRejectModal(prev => ({ ...prev, isOpen: false }));
        modalClosed = true;
      }
      if (updateState.isOpen) {
        setUpdateState(prev => ({ ...prev, isOpen: false }));
        modalClosed = true;
      }
      // モーダルが閉じられた場合は振動を軽めに発生させる
      if (modalClosed) {
        triggerHaptic('light');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showAddModal, showTrailerModal, showBetaAutoFillModal, rejectModal.isOpen, updateState.isOpen]);

  // Synchronize JS progress values to CSS variables for smooth GPU-accelerated transition performance
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--back-progress', '0');
      document.documentElement.style.setProperty('--is-back-swiping', '0');
    }
  }, []);

  // Androidの物理戻るボタン / システム戻るジェスチャーの制御 (予測型戻るジェスチャーネイティブ同期)
  const updateBackGestureEnabled = () => {
    const isAnyModalOpen = showAddModal || showTrailerModal || showBetaAutoFillModal || rejectModal.isOpen || updateState.isOpen;
    const isInterceptionActive = (window.backInterceptorCount || 0) > 0;
    const shouldIntercept = isAnyModalOpen || isInterceptionActive || view !== 'home' || (view === 'admin' && adminTab !== 'dashboard');

    if (Capacitor.isNativePlatform()) {
      BackGesture.setEnabled({ enabled: shouldIntercept }).catch(err => {
        console.warn('Failed to set back gesture enabled:', err);
        const errMsg = err.message || String(err);
        if (!errMsg.toLowerCase().includes('not implemented')) {
          setInAppToast({
            title: 'BackGesture Error',
            desc: `setEnabled(${shouldIntercept}) failed: ${errMsg}`,
            type: 'error'
          });
        }
      });
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.updateBackGestureEnabled = updateBackGestureEnabled;
    }
    updateBackGestureEnabled();
    return () => {
      if (typeof window !== 'undefined') {
        window.updateBackGestureEnabled = undefined;
      }
    };
  }, [view, adminTab, showAddModal, showTrailerModal, showBetaAutoFillModal, rejectModal.isOpen, updateState.isOpen]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let startHandler: any = null;
    let progressHandler: any = null;
    let cancelHandler: any = null;
    let pressHandler: any = null;

    const setupListeners = async () => {
      try {
        startHandler = await BackGesture.addListener('backStarted', (data) => {
          triggerHaptic('light');
          console.log('[BackGesture] Started:', data);
        });

        progressHandler = await BackGesture.addListener('backProgressed', (data) => {
          console.log('[BackGesture] Progressed:', data);
        });

        cancelHandler = await BackGesture.addListener('backCancelled', () => {
          triggerHaptic('light');
          console.log('[BackGesture] Cancelled');
        });

        pressHandler = await BackGesture.addListener('backPressed', () => {
          triggerHaptic('medium');
          console.log('[BackGesture] Pressed');

          const isAnyModalOpen = showAddModal || showTrailerModal || showBetaAutoFillModal || rejectModal.isOpen || updateState.isOpen;
          const isInterceptionActive = (window.backInterceptorCount || 0) > 0;

          if (isAnyModalOpen || isInterceptionActive) {
            window.history.back();
          } else if (view === 'admin' && adminTab !== 'dashboard') {
            setIsNavigatingBack(true);
            window.history.back();
          } else if (view !== 'home') {
            setIsNavigatingBack(true);
            window.history.back();
          }
        });
      } catch (err) {
        console.error('Failed to setup BackGesture listeners:', err);
        const errMsg = err.message || String(err);
        if (!errMsg.toLowerCase().includes('not implemented')) {
          setInAppToast({
            title: 'BackGesture Listeners Error',
            desc: errMsg,
            type: 'error'
          });
        }
      }
    };

    setupListeners();

    return () => {
      if (startHandler) startHandler.remove();
      if (progressHandler) progressHandler.remove();
      if (cancelHandler) cancelHandler.remove();
      if (pressHandler) pressHandler.remove();
    };
  }, [view, adminTab, showAddModal, showTrailerModal, showBetaAutoFillModal, rejectModal.isOpen, updateState.isOpen]);

  const handleManualRefresh = () => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    fetchVehicles(true);
    fetchApplication();
    if (view === 'admin') {
      fetchUsers();
      fetchAllApplications();
      fetchQuestions(true);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const refreshData = (showLoading = false) => {
      fetchVehicles(showLoading);
      fetchApplication();
      if (view === 'admin') {
        fetchUsers();
        fetchAllApplications();
        fetchQuestions(true);
      }
    };

    refreshData(vehicles.length === 0);

    // 30 Seconds background polling (pause when document is hidden)
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      refreshData(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [isLoggedIn, view]);

  // 市民申請画面 (apply) が開かれたタイミングで、設問データを遅延ロードする (起動速度改善)
  useEffect(() => {
    if (isLoggedIn && view === 'apply') {
      fetchQuestions();
    }
  }, [isLoggedIn, view]);

  useEffect(() => {
    if (!showAddModal) return;

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItems = Array.from(items).filter(item => item.type.indexOf('image') !== -1);
      if (imageItems.length === 0) return;

      const files = imageItems.map(item => item.getAsFile()).filter(f => f !== null) as File[];

      const existing = parseImages(formData.image_data);
      const newCount = existing.length + files.length;
      if (newCount > 4) {
        alert("画像は最大4枚までです。");
        return;
      }

      try {
        const base64Images = await Promise.all(files.map(compressDualImage));
        const combined = [...existing, ...base64Images];
        setFormData(prev => ({ ...prev, image_data: JSON.stringify(combined) }));
      } catch (err) {
        console.error("Paste image processing failed:", err);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showAddModal, formData.image_data]);

  const handleUpdateStatus = async (id: string, status: VehicleStatus, days?: number, confirmedReason?: string) => {
    let rejectReason = '';
    if (status === 'rejected') {
      if (confirmedReason === undefined) {
        setRejectModal({
          isOpen: true,
          type: 'vehicle',
          targetId: id,
          reason: ''
        });
        return;
      }
      rejectReason = confirmedReason;
    } else if (status === 'approved_warning') {
      if (confirmedReason === undefined) {
        setRejectModal({
          isOpen: true,
          type: 'vehicle_warning',
          targetId: id,
          reason: ''
        });
        return;
      }
      rejectReason = confirmedReason;
    }

    const targetVehicle = vehicles.find(v => v.id === id) || allSearchVehicles.find(v => v.id === id);
    const expectedStatus = targetVehicle?.status || 'pending';

    // Optimistic UI Update: 画面上から即座に消す (保留中の承認など)
    if (expectedStatus === 'pending') {
      setVehicles(prev => prev.filter(v => v.id !== id));
    }    try {
      const res = await fetch('/api/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status, reject_reason: rejectReason, expected_status: expectedStatus, days })
      });
      if (res.ok) {
        fetchVehicles(false);
        if (view === "admin") fetchAllApplications(); // Refresh related data
      } else if (res.status === 409) {
        alert("エラー: この車両申請はすでに他の管理者によってステータスが変更されています。最新情報に更新します。");
        fetchVehicles();
        if (view === 'admin') handleManualRefresh();
      } else {
        const errorData = await res.json() as any;
        alert(errorData.error || "ステータス更新に失敗しました。");
      }
    } catch (e) {
      console.error("Update status failed:", e);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'user' | 'admin') => {
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole })
      });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error("Update role failed:", e);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser.id, roblox_username: currentUser.roblox_username })
      });
      if (res.ok) {
        setInfoModal({
          isOpen: true,
          type: 'success',
          title: 'プロフィール更新完了',
          message: 'プロフィール情報を正常に更新しました。'
        });
        triggerHaptic('success');
      }
    } catch (e) {
      console.error("Update profile failed:", e);
    }
  };

  const handleDeleteVehicle = async (id: string) => {
    if (!confirm("車両を削除しますか？")) return;
    try {
      const res = await fetch(`/api/vehicles?id=${id}`, { method: 'DELETE' });
      if (res.ok) fetchVehicles(false);
    } catch (e) {
      console.error("Delete vehicle failed:", e);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    
    const existing = parseImages(formData.image_data);
    const newCount = existing.length + files.length;
    if (newCount > 4) {
      alert(`アップロードできる画像は4枚までです。(現在${existing.length}枚、選択${files.length}枚)`);
      return;
    }
    
    setIsLoading(true);
    try {
      const base64Images = await Promise.all(files.map(compressDualImage));
      const combined = [...existing, ...base64Images];
      setFormData({ ...formData, image_data: JSON.stringify(combined) });
    } catch (err) {
      console.error("Image processing failed:", err);
      alert("画像の処理に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    const existing = parseImages(formData.image_data);
    const updated = existing.filter((_, i) => i !== indexToRemove);
    setFormData({ ...formData, image_data: updated.length > 0 ? JSON.stringify(updated) : '' });
  };

  const handleStartEdit = (v: Vehicle) => {
    const isTrailer = (v as any).vehicle_type === 'trailer';
    if (isTrailer) {
      setTrailerFormData({
        game_type: (v as any).game_type || 'gv',
        model: v.model, maker: v.maker, trailer_type: (v as any).trailer_type || '', color: v.color || '',
        plate: v.plate, plate_region: v.plate_region || 'WISCONSIN',
        roblox_username: v.roblox_username || '', image_data: v.image_data || ''
      });
      setEditingVehicleId(v.id);
      setShowTrailerModal(true);
    } else {      setFormData({
        game_type: (v as any).game_type || 'gv',
        maker: v.maker, model: v.model, year: v.year, trim: v.trim || '', color: v.color || '',
        plate: v.plate, plate_region: v.plate_region || 'WISCONSIN',
        roblox_username: v.roblox_username || '', image_data: v.image_data || ''
      });
      setRegistrationMode(v.is_temp_registration === 1 ? 'temp' : 'normal');
      setEditingVehicleId(v.id);
      setShowAddModal(true);
    }
  };

  const correctPlate = (plateStr: string): string => {
    if (!plateStr) return '';
    let cleaned = plateStr.replace(/\s*-\s*/, '-').trim().toUpperCase();
    if (cleaned.includes('-')) {
      const parts = cleaned.split('-');
      const prefix = parts.slice(0, -1).join('-');
      const suffix = parts[parts.length - 1];
      const charMap: { [key: string]: string } = {
        'M': '11', 'N': '11', 'I': '1', 'L': '1', 'T': '1', 'J': '1',
        'O': '0', 'Q': '0', 'D': '0', 'Z': '2', 'S': '5', 'B': '8', 'G': '6'
      };
      let correctedSuffix = '';
      let potentialValid = true;
      let hasLetters = false;
      let hasDigits = false;
      for (let i = 0; i < suffix.length; i++) {
        const char = suffix[i];
        if (char >= '0' && char <= '9') {
          correctedSuffix += char;
          hasDigits = true;
        } else if (charMap[char] !== undefined) {
          correctedSuffix += charMap[char];
          hasLetters = true;
        } else {
          potentialValid = false;
          break;
        }
      }
      if (potentialValid && hasLetters) {
        const isMixed = hasDigits && hasLetters;
        const isStandardFormat = !hasDigits && hasLetters && 
                                 /^[A-Z]{3,4}$/.test(prefix) && 
                                 (correctedSuffix.length === 3 || correctedSuffix.length === 4);
        if (isMixed || isStandardFormat) {
          return `${prefix}-${correctedSuffix}`;
        }
      }
    }
    return cleaned;
  };

  // appVersion のクロージャ問題を解決するための useRef (起動時自動チェックのライフサイクル同期)
  const appVersionRef = React.useRef(appVersion);
  useEffect(() => {
    appVersionRef.current = appVersion;
  }, [appVersion]);

  // 手動 / 自動アップデート確認ロジック
  const handleCheckUpdate = async (isManual = false) => {
    if (!isNative) {
      if (isManual) {
        alert('ブラウザ環境です。アップデート確認は実機（ネイティブアプリ）環境でのみ有効です。');
        triggerHaptic('warning');
      }
      return;
    }

    if (isManual) {
      setIsCheckingUpdate(true);
      triggerHaptic('light');
    }

    try {
      const release = await checkLatestRelease();
      if (release) {
        const currentVer = appVersionRef.current;
        const hasNew = isNewerVersion(currentVer, release.version);
        if (hasNew) {
          setUpdateState({
            isOpen: true,
            latestVersion: release.version,
            notes: release.notes,
            apkUrl: release.apkUrl,
            downloadProgress: 0,
            status: 'idle'
          });
          if (isManual) {
            triggerHaptic('success');
          }
        } else {
          if (isManual) {
            setInfoModal({
              isOpen: true,
              type: 'success',
              title: '最新バージョンです',
              message: `お使いのアプリは最新バージョン v${appVersion} です。\n現在最新のバージョンをお使いいただいています。`
            });
            triggerHaptic('success');
          }
        }
      } else {
        if (isManual) {
          setInfoModal({
            isOpen: true,
            type: 'error',
            title: '情報取得失敗',
            message: '最新リリースの情報が取得できませんでした。\nネットワーク接続を確認して再度お試しください。'
          });
          triggerHaptic('error');
        }
      }
    } catch (err) {
      console.error('Update check failed:', err);
      if (isManual) {
        setInfoModal({
          isOpen: true,
          type: 'error',
          title: 'エラーが発生しました',
          message: 'アップデート確認中にネットワークエラーが発生しました。\n時間をおいて再度お試しください。'
        });
        triggerHaptic('error');
      }
    } finally {
      if (isManual) {
        setIsCheckingUpdate(false);
      }
    }
  };

  const handleTogglePushSetting = (
    key: 'resultsEnabled' | 'adminEnabled' | 'adminEditEnabled' | 'timelineLikeEnabled' | 'timelineCommentEnabled' | 'timelineNewPostEnabled', 
    enabled: boolean
  ) => {
    const newSettings = { ...pushSettings, [key]: enabled };
    setPushSettings(newSettings);
    
    let storageKey = 'results';
    if (key === 'adminEnabled') storageKey = 'admin';
    else if (key === 'adminEditEnabled') storageKey = 'admin_edit';
    else if (key === 'timelineLikeEnabled') storageKey = 'timeline_like';
    else if (key === 'timelineCommentEnabled') storageKey = 'timeline_comment';
    else if (key === 'timelineNewPostEnabled') storageKey = 'timeline_new_post';
    
    localStorage.setItem(`gvvr_push_${storageKey}`, String(enabled));
    triggerHaptic('light');

    if (isLoggedIn && currentUser && currentUser.id) {
      registerPushNotifications(currentUser.id, handlePushNotificationAction);
    }
  };

  const handlePerformUpdate = async () => {
    if (!updateState.apkUrl) return;

    setUpdateState(prev => ({
      ...prev,
      status: 'downloading',
      downloadProgress: 0
    }));
    triggerHaptic('medium');

    try {
      const result = await downloadAndInstallApk(updateState.apkUrl, (progress) => {
        setUpdateState(prev => ({
          ...prev,
          downloadProgress: progress
        }));
      });

      if (result && result.isBackground) {
        setUpdateState(prev => ({
          ...prev,
          status: 'background_started'
        }));
        triggerHaptic('success');

        // Close after 4 seconds automatically
        setTimeout(() => {
          setUpdateState(prev => ({ ...prev, isOpen: false }));
        }, 8000);
      } else {
        setUpdateState(prev => ({
          ...prev,
          status: 'success'
        }));
        triggerHaptic('success');
      }
    } catch (err: any) {
      console.error('Download/Install failed:', err);
      let errorMsg = err.message || '不明なエラーが発生しました。';
      if (
        errorMsg.includes('permission_required') || 
        errorMsg.includes('PermissionDenied') || 
        errorMsg.includes('unknown app sources')
      ) {
        errorMsg = 'インストーラーを起動できませんでした。アプリの更新を続行するには、自動で開いた設定画面にて「この提供元のアプリを許可」を有効（ON）にした上で、再度「今すぐ更新する」をタップしてください。';
      }
      setUpdateState(prev => ({
        ...prev,
        status: 'error',
        errorMsg: errorMsg
      }));
      triggerHaptic('error');
    }
  };

  // 起動後の自動更新チェック（設定でオンオフ可能）
  const hasCheckedAutoUpdate = React.useRef(false);

  const handleToggleAutoCheck = (enabled: boolean) => {
    setAutoCheckUpdates(enabled);
    localStorage.setItem('auto_check_updates', enabled ? 'true' : 'false');
    triggerHaptic('light');
  };

  useEffect(() => {
    if (isNative && autoCheckUpdates && !hasCheckedAutoUpdate.current) {
      hasCheckedAutoUpdate.current = true;
      const timer = setTimeout(() => {
        handleCheckUpdate(false);
      }, 5000); // 起動時ロード・アニメーション競合を避けるため5秒に調整
      return () => clearTimeout(timer);
    }
  }, [autoCheckUpdates]);

  const handleAutoFillFromImage = async (file: File) => {
    setOcrLoading(true);
    setOcrStatus('画像の下処理中...');
    setOcrProgress(0.05);
    try {
      // 1. Preprocess the image in a Canvas to boost Tesseract's recognition accuracy for small text
      const processedFile = await new Promise<Blob | File>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          // Scale up the image by 3x to make small text much larger
          canvas.width = img.width * 3;
          canvas.height = img.height * 3;
          
          // Disable image smoothing (nearest-neighbor scaling) to keep letters crisp and prevent bleeding/merging
          ctx.imageSmoothingEnabled = false;
          (ctx as any).mozImageSmoothingEnabled = false;
          (ctx as any).webkitImageSmoothingEnabled = false;
          (ctx as any).msImageSmoothingEnabled = false;

          // Apply grayscale and 200% contrast filter (slightly lower than 300% to avoid bloating letter thickness)
          ctx.filter = 'grayscale(100%) contrast(200%)';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(img.src);
            resolve(blob || file);
          }, 'image/jpeg', 0.95);
        };
        img.onerror = () => {
          resolve(file);
        };
        img.src = URL.createObjectURL(file);
      });

      // Web・アプリ（ネイティブ）両環境で公式高速CDN（jsDelivr）からワーカー・言語データを取得して安定化
      const tesseractOptions: any = {
        logger: (m: any) => {
          if (m && typeof m === 'object') {
            let statusText = '';
            switch (m.status) {
              case 'loading tesseract core':
                statusText = 'OCRエンジンをロード中...';
                break;
              case 'initializing api':
                statusText = 'APIを初期化中...';
                break;
              case 'recognizing text':
                statusText = `文字を認識中: ${Math.round((m.progress || 0) * 100)}%`;
                break;
              default:
                statusText = m.status || '';
                break;
            }
            setOcrStatus(statusText);
            setOcrProgress(0.1 + (m.progress || 0) * 0.9);
          }
        }
      };

      const result = await Tesseract.recognize(processedFile as File, 'eng', tesseractOptions);
      const text = result.data.text;
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      console.log("OCR Extracted Lines:", lines);

      let parsedYear = 2024;
      let parsedMaker = '';
      let parsedModel = '';
      let parsedTrim = '';
      let parsedColor = '';
      let parsedPlate = '';
      let parsedRegion = 'WISCONSIN';

      // -------------------------------------------------------------
      // Anchor-based Smart Parsing (Differentiated by game type)
      // -------------------------------------------------------------
      if (formData.game_type === 'rc') {
        try {
          let rcTitleLine = '';
          let anchorIndex = -1;

          // 1. Find any key anchor text anywhere in the line (flexible case-insensitive includes)
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].toLowerCase();
            if (line.includes('overview') || 
                line.includes('power') || 
                line.includes('capacity') || 
                line.includes('details') || 
                line.includes('transmission') || 
                line.includes('drivetrain')
            ) {
              anchorIndex = i;
              break;
            }
          }

          // The line above the first anchor is very likely the car title (Year + Maker + Model + Trim)
          if (anchorIndex > 0) {
            // Scan upwards from anchor index to find the first substantial text line
            for (let j = anchorIndex - 1; j >= 0; j--) {
              const trimmed = lines[j].trim();
              if (trimmed.length > 2 && 
                  !trimmed.match(/^\d{1,2}:\d{2}$/) && // Skip clock time like 10:49
                  !trimmed.match(/^[0-9\s%\/]+$/) // Skip lines that are just numbers/symbols
              ) {
                rcTitleLine = trimmed;
                break;
              }
            }
          }

          // Fallback: If no anchor was found or no text above it, search top-down
          if (!rcTitleLine && lines.length > 0) {
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.length > 3 && 
                  !trimmed.match(/^\d{1,2}:\d{2}$/) && 
                  !trimmed.toLowerCase().includes('overview') && 
                  !trimmed.toLowerCase().includes('details') &&
                  !trimmed.toLowerCase().includes('capacity') &&
                  !trimmed.toLowerCase().includes('transmission') &&
                  !trimmed.toLowerCase().includes('drivetrain')
              ) {
                rcTitleLine = trimmed;
                break;
              }
            }
          }

          console.log("RC Robust OCR Title Line:", rcTitleLine);

          if (rcTitleLine) {
            let foundMaker = '';
            let foundModel = '';

            // Look for year in the whole text or title line
            const yearMatch = text.match(/(?:^|\s)(19\d{2}|20\d{2})(?:\s|$)/);
            if (yearMatch) {
              parsedYear = parseInt(yearMatch[1]);
            } else {
              parsedYear = 2024;
            }

            // Scan all makers and models in catalog with dynamic safe fallback
            const safeCatalog = carModels || {};
            for (const [maker, models] of Object.entries(safeCatalog)) {
              if (Array.isArray(models)) {
                for (const model of models) {
                  if (model && rcTitleLine.toLowerCase().includes(model.toLowerCase())) {
                    foundMaker = maker;
                    foundModel = model;
                    break;
                  }
                }
              }
              if (foundMaker) break;
            }

            if (foundModel) {
              parsedMaker = foundMaker;
              parsedModel = foundModel;

              // Extract Trim cleanly by replacing Maker and Model from the title line (case-insensitive substring replacement)
              let restOfTitle = rcTitleLine;
              
              // Remove Year if present
              if (yearMatch) {
                restOfTitle = restOfTitle.replace(new RegExp(yearMatch[0], 'i'), '');
              }
              
              // Remove Maker if present
              if (foundMaker) {
                restOfTitle = restOfTitle.replace(new RegExp(foundMaker, 'gi'), '');
              }

              // Remove Model if present
              if (foundModel) {
                restOfTitle = restOfTitle.replace(new RegExp(foundModel, 'gi'), '');
              }

              // Strip drivetrain (FWD/AWD/RWD/4WD/4x4) and non-alphanumeric noise to get clean Trim
              parsedTrim = restOfTitle
                .replace(/\b(?:FWD|AWD|RWD|4WD|4x4)\b/gi, '')
                .replace(/[^a-zA-Z0-9\s-\/]/g, '') // Remove weird OCR symbols/icons but keep spaces, dashes and slashes
                .trim();
                
              console.log(`RC OCR Parsed: Maker=${parsedMaker}, Model=${parsedModel}, Trim=${parsedTrim}`);
            } else {
              // Ultimate fallback: Split title line into model and trim
              const parts = rcTitleLine.split(/\s+/);
              if (parts.length >= 2) {
                parsedModel = parts[0];
                parsedTrim = parts.slice(1).join(' ').replace(/\b(?:FWD|AWD|RWD|4WD|4x4)\b/gi, '').trim();
              }
            }
          }
        } catch (e: any) {
          console.error("RC OCR Parsing inner error:", e.message);
        }

        // Set default region to WISCONSIN but plate blank (as it's not on details page)
        parsedRegion = 'WISCONSIN';
        parsedPlate = '';
      } else {
        // Greenville (Gv) Original Smart Parsing
        let lockIndex = -1;
        let startStopIndex = -1;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (lockIndex === -1 && (line.match(/Lock/i) || line.match(/Unlock/i))) {
            lockIndex = i;
          }
          if (startStopIndex === -1 && (line.match(/Start/i) || line.match(/Stop/i))) {
            startStopIndex = i;
          }
        }

        console.log(`Lock index: ${lockIndex}, Start/Stop index: ${startStopIndex}`);

        // Parse Header fields if lockIndex is found
        if (lockIndex !== -1) {
          let yearLineIndex = -1;
          for (let i = 0; i < lockIndex; i++) {
            if (lines[i].match(/(?:^|\s)(19\d{2}|20\d{2})(?:\s|$)/)) {
              yearLineIndex = i;
              break;
            }
          }

          if (yearLineIndex !== -1) {
            const yearLine = lines[yearLineIndex];
            const yearMatch = yearLine.match(/(?:^|\s)(19\d{2}|20\d{2})(?:\s|$)/);
            if (yearMatch) {
              parsedYear = parseInt(yearMatch[1]);
              const rest = yearLine.replace(yearMatch[0], '').trim();
              const parts = rest.split(/\s+/);
              if (parts.length > 0) {
                parsedMaker = parts[0];
                parsedModel = parts.slice(1).join(' ');
              }
            }

            if (yearLineIndex + 1 < lockIndex) {
              parsedTrim = lines[yearLineIndex + 1].replace(/^[^a-zA-Z0-9]+/, '').trim();
            }
          }
        }

        // Parse Color field if startStopIndex is found
        if (startStopIndex !== -1 && startStopIndex + 1 < lines.length) {
          let colorLine = lines[startStopIndex + 1];
          colorLine = colorLine.replace(/^[^a-zA-Z0-9]+/, '').trim();
          colorLine = colorLine.replace(/^[a-zA-Z0-9]\s+/, '').trim();
          parsedColor = colorLine;
        }

        // Parse Plate & Region if startStopIndex + 2 exists
        if (startStopIndex !== -1 && startStopIndex + 2 < lines.length) {
          let plateLine = lines[startStopIndex + 2];
          let cleanedPlateLine = plateLine.replace(/^[^a-zA-Z0-9]+/, '').trim();
          cleanedPlateLine = cleanedPlateLine.replace(/^123\s*/, '').trim();
          
          const plateMatch = cleanedPlateLine.match(/([a-zA-Z0-9]{2,6}-[a-zA-Z0-9]{1,6})/);
          if (plateMatch) {
            parsedPlate = plateMatch[1].toUpperCase();
            const plateIndex = cleanedPlateLine.indexOf(plateMatch[1]);
            const afterPlate = cleanedPlateLine.slice(plateIndex + plateMatch[1].length);
            const regionText = afterPlate.replace(/^[\s,]+/, '').trim();
            if (regionText) {
              parsedRegion = regionText.toUpperCase();
            }
          } else {
            const parts = cleanedPlateLine.split(/[\s,]+/);
            if (parts.length > 0) {
              if (parts.length >= 3 && parts[0].length <= 3) {
                parsedPlate = parts[1].toUpperCase();
                parsedRegion = parts.slice(2).join(' ').toUpperCase();
              } else {
                parsedPlate = parts[0].toUpperCase();
                if (parts.length > 1) {
                  parsedRegion = parts.slice(1).join(' ').toUpperCase();
                }
              }
            }
          }
        }

        // Fallbacks
        const uiPattern = /Lock|Unlock|Alarm|Start|Stop|Hold/i;

        if (!parsedMaker || !parsedModel) {
          for (const line of lines) {
            const carMatch = line.match(/^(\d{4})\s+([a-zA-Z][a-zA-Z0-9-]*)\s+(.+)$/);
            if (carMatch) {
              parsedYear = parseInt(carMatch[1]);
              parsedMaker = carMatch[2];
              parsedModel = carMatch[3].trim();
              break;
            }
          }
        }

        if (!parsedTrim && lockIndex === -1) {
          for (let i = 0; i < lines.length - 1; i++) {
            if (lines[i].match(/^\d{4}\s+[a-zA-Z]/)) {
              const next = lines[i + 1];
              if (next && !uiPattern.test(next)) {
                parsedTrim = next.replace(/^[^a-zA-Z0-9]+/, '').trim();
              }
              break;
            }
          }
        }

        if (!parsedPlate) {
          for (const line of lines) {
            const plateMatch = line.match(/([a-zA-Z0-9]{2,6}-[a-zA-Z0-9]{1,6})/);
            if (plateMatch) {
              parsedPlate = plateMatch[1].toUpperCase();
              const afterPlate = line.slice(line.indexOf(plateMatch[1]) + plateMatch[1].length);
              const regionMatch = afterPlate.match(/[,\s]+([A-Za-z][A-Za-z\s]+)$/);
              if (regionMatch) parsedRegion = regionMatch[1].trim().toUpperCase();
              break;
            }
          }
        }

        if (!parsedColor) {
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/Start\s*\/\s*Stop/i)) {
              for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
                const stripped = lines[j].replace(/^[^a-zA-Z]+/, '').trim();
                if (stripped && !uiPattern.test(stripped) && !stripped.match(/\d{2,}/) && !stripped.match(/[A-Z]{2,4}-\d+/)) {
                  parsedColor = stripped;
                  break;
                }
              }
              break;
            }
          }
        }
      }

      // Correct common OCR plate number misrecognitions
      const finalPlate = correctPlate(parsedPlate);

      setFormData(prev => ({
        ...prev,
        roblox_username: currentUser.roblox_username || prev.roblox_username,
        year: parsedYear,
        maker: parsedMaker,
        model: parsedModel,
        trim: parsedTrim,
        color: parsedColor,
        plate: finalPlate,
        plate_region: parsedRegion
      }));

      alert('自動抽出が完了しました！内容を確認・編集して登録してください。');

    } catch (err) {
      console.error(err);
      alert('画像の解析に失敗しました。');
    } finally {
      setOcrLoading(false);
      setOcrStatus('');
      setOcrProgress(0);
      setShowBetaAutoFillModal(false);
      setEditingVehicleId(null);
      setShowAddModal(true);
    }
  };

  const handleOCRFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleAutoFillFromImage(file);
  };

  useEffect(() => {
    if (!showBetaAutoFillModal) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleAutoFillFromImage(file);
            break;
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [showBetaAutoFillModal]);

  const handleOpenVehicleModal = (defaultGame: 'gv' | 'rc' = 'gv') => {
    triggerHaptic('medium');
    if (myApplication?.status !== 'approved') {
      alert("車両登録には市民申請の承認が必要です。");
      setView('apply');
      return;
    }
    if (!currentUser?.roblox_username) {
      alert("ユーザー名を設定してください");
      setView('profile');
      return;
    }
    setFormData({
      game_type: defaultGame,
      maker: '',
      model: '',
      year: 2024,
      trim: '',
      color: '',
      plate: '',
      plate_region: 'WISCONSIN',
      roblox_username: currentUser.roblox_username,
      image_data: ''
    });
    setEditingVehicleId(null);
    setRegistrationMode('normal');
    loadCatalog(defaultGame);
    setShowAddModal(true);
  };

  useEffect(() => {
    if (isMobile) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+N to quickly open vehicle registration on PC
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleOpenVehicleModal('gv');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, myApplication?.status, currentUser?.roblox_username]);

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vehicleSubmitting) return;

    if (plateDuplicateWarning) {
      alert('既にこの車両は登録されています！別のナンバープレートを指定してください。');
      triggerHaptic('error');
      return;
    }

    const cleanPlate = (formData.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase();
    if (cleanPlate) {
      const game = (formData.game_type || 'gv').toLowerCase();
      const duplicateFound = vehicles.find(v => 
        v.status !== 'rejected' &&
        v.id !== editingVehicleId &&
        (v.game_type || 'gv').toLowerCase() === game &&
        (v.plate || '').replace(/[\s\-_]/g, '').trim().toLowerCase() === cleanPlate
      );
      if (duplicateFound) {
        setPlateDuplicateWarning('既にこの車両は登録されています！');
        alert('既にこの車両は登録されています！別のナンバープレートを指定してください。');
        triggerHaptic('error');
        return;
      }
    }

    setVehicleSubmitting(true);
    const method = editingVehicleId ? 'PUT' : 'POST';
    try {
      const payload = { 
        ...formData, 
        owner_id: currentUser.id, 
        is_temp_registration: registrationMode === 'temp' ? 1 : 0 
      };
      const res = await fetch('/api/vehicles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicleId ? { ...payload, id: editingVehicleId } : payload)
      });
      if (res.ok) {
        setShowAddModal(false);
        setEditingVehicleId(null);
        setRegistrationMode('normal');
        setFormData({ game_type: 'gv', maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
        setPlateDuplicateWarning(null);
        fetchVehicles();
        triggerHaptic('success');
        scheduleLocalNotification(
          '申請送信完了',
          editingVehicleId ? '車両情報の更新申請を送信しました。' : '車両登録申請を送信しました！',
          0,
          'application_results_channel'
        );
      } else {
        const err = await res.json() as any;
        const errMsg = err.error || '車両登録に失敗しました。';
        if (res.status === 409 || errMsg.includes('既にこの車両は登録されています')) {
          setPlateDuplicateWarning('既にこの車両は登録されています！');
        }
        alert(errMsg);
        window.dispatchEvent(new CustomEvent('gv-toast', {
          detail: { title: '登録エラー', desc: errMsg, type: 'error' }
        }));
        triggerHaptic('error');
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
      alert('ネットワークエラーが発生しました。もう一度お試しください。');
      triggerHaptic('error');
    } finally {
      setVehicleSubmitting(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplySubmitting(true);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roblox_username: currentUser.roblox_username || '',
          discord_username: currentUser.username,
          answers: applyAnswers
        })
      });
      if (res.ok) {
        await fetchApplication();
        triggerHaptic('success');
        scheduleLocalNotification('申請送信完了', '市民申請を送信しました！審査結果をお待ちください。', 0, 'application_results_channel');
      } else {
        const err = await res.json() as any;
        alert(err.error || '申請に失敗しました。');
        triggerHaptic('error');
      }
    } catch (err) {
      console.error('Submit application failed:', err);
      triggerHaptic('error');
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleReviewApplication = async (userId: string, status: 'approved' | 'rejected', reason?: string) => {
    if (status === 'rejected' && reason === undefined) {
      setRejectModal({
        isOpen: true,
        type: 'citizen',
        targetId: userId,
        reason: ''
      });
      return;
    }
    const targetApp = allApplications.find(a => a.user_id === userId);
    const expectedStatus = targetApp?.status || 'pending';

    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, status, reject_reason: reason || null, expected_status: expectedStatus })
      });
      if (res.ok) {
        fetchAllApplications();
      } else if (res.status === 409) {
        alert("エラー: この市民申請はすでに他の管理者によってステータスが変更されています。最新情報に更新します。");
        fetchAllApplications();
      } else {
        const errorData = await res.json() as any;
        alert(errorData.error || "審査処理に失敗しました。");
      }
    } catch (e) {
      console.error('Review application failed:', e);
    }
  };

  const handleWikiSync = async (gameType: 'gv' | 'rc') => {
    const gameName = gameType === 'rc' ? 'Rensselaer County (RC)' : 'Greenville (Gv)';
    if (!confirm(`${gameName} のWikiから最新の車両データを取得し、カタログを更新しますか？\n（この処理には1分程度かかる場合があります）`)) return;

    setWikiSyncProgress("Wikiから車両リストを取得中...");

    const wikiLabel = gameType === 'rc' ? 'RC' : 'GV';
    const wikiSegments = JSON.stringify([
      { weight: 75, color: "#3B82F6" }, // Wiki crawl (Blue)
      { weight: 25, color: "#10B981" }  // DB Save (Green)
    ]);
    const wikiPoints = JSON.stringify([
      { position: 75, color: "#3B82F6" }
    ]);

    if (isNative) {
      getLiveProgress().start({
        title: `${wikiLabel} カタログ同期`,
        text: 'Wikiから車両リストを取得中...',
        progress: 0,
        segments: wikiSegments,
        points: wikiPoints
      }).catch(err => console.error('Failed to start LiveProgress for wiki sync:', err));
    }

    try {
      // 1. Wiki巡回（進捗コールバックでLiveProgressを更新）
      const newCatalog = await fetchWikiCatalog(gameType, (progressMsg, progressPercent) => {
        setWikiSyncProgress(progressMsg);
        if (isNative && progressPercent !== undefined) {
          // update にも segments/points を渡してセグメントが消えないようにする
          getLiveProgress().update({
            title: `${wikiLabel} カタログ同期`,
            text: progressMsg,
            progress: progressPercent,
            segments: wikiSegments,
            points: wikiPoints
          }).catch(err => console.error('Failed to update LiveProgress for wiki sync:', err));
        }
      });

      // 2. DBへ保存
      const dbSaveMsg = "データベースに同期・保存中...";
      setWikiSyncProgress(dbSaveMsg);
      if (isNative) {
        getLiveProgress().update({
          title: `${wikiLabel} カタログ同期`,
          text: dbSaveMsg,
          progress: 85,
          segments: wikiSegments,
          points: wikiPoints
        }).catch(err => console.error('Failed to update LiveProgress for wiki sync save phase:', err));
      }

      const success = await saveCatalogToDatabase(newCatalog, gameType);

      if (success) {
        alert(`${gameName} のカタログ同期が完了しました。`);
        loadCatalog(gameType);
      } else {
        throw new Error('Failed to save updated catalog to database.');
      }
    } catch (e: any) {
      console.error('Catalog sync failed:', e);
      alert(`カタログの同期に失敗しました。\n詳細: ${e.message || e}`);
    } finally {
      setWikiSyncProgress(null);
      if (isNative) {
        getLiveProgress().stop({ title: `${wikiLabel} カタログ同期` }).catch(err => console.error('Failed to stop LiveProgress for wiki sync:', err));
      }
    }
  };


  const handleSaveQuestion = async (q: any) => {
    const isNew = !q.id;
    const url = '/api/questions';
    const method = isNew ? 'POST' : 'PATCH';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q)
    });
    if (res.ok) { setEditingQuestion(null); fetchQuestions(true); }
    else alert('保存に失敗しました。');
  };

  const handleToggleQuestion = async (id: string, is_active: number) => {
    await fetch('/api/questions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: is_active === 1 ? 0 : 1 })
    });
    fetchQuestions(true);
  };

  const getAnswersObj = (answersStr: string) => {
    try {
      return JSON.parse(answersStr || '{}');
    } catch {
      return {};
    }
  };

  const getEditingAnswerString = (q: any) => {
    try {
      const a = JSON.parse(q.answer || 'null');
      return Array.isArray(a) ? a.join(', ') : a || '';
    } catch {
      return q.answer || '';
    }
  };

  const getEditingAnswerArray = (q: any) => {
    try {
      const a = JSON.parse(q.answer || 'null');
      return Array.isArray(a) ? a : [a].filter(Boolean);
    } catch {
      return [q.answer].filter(Boolean);
    }
  };

  if (showBootSplash) {
    return (
      <div className={`boot-splash ${bootSplashFade ? 'fade-out' : ''}`}>
        <div className="boot-logo-container">
          <div className="boot-logo-glow" />
          <img src="/pizza.png" className="boot-logo" alt="Pizza Logo" />
        </div>
        <div className="boot-title">ぴっざぁポータル</div>
        <div className="boot-subtitle">Citizen Registry System</div>
        <div className="boot-loader">
          <div className="boot-loader-bar" />
        </div>
      </div>
    );
  }

  if (isLoading && !isLoggedIn) {
    return (
      <div className="app-layout" style={{ background: 'var(--bg-dark)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation Skeleton */}
        <nav className="main-nav" style={{ pointerEvents: 'none', gridTemplateColumns: 'auto 1fr auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="skeleton skeleton-circle" style={{ width: '30px', height: '30px' }} />
            <div className="skeleton skeleton-text" style={{ width: '120px', height: '20px', marginBottom: 0 }} />
          </div>
          <div className="nav-tabs-wrapper" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '30px' }} />
            <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '30px' }} />
            <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '30px' }} />
            <div className="skeleton skeleton-rect" style={{ width: '80px', height: '38px', borderRadius: '30px' }} />
          </div>
          <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <div className="skeleton skeleton-text" style={{ width: '80px', height: '14px', marginBottom: 0 }} />
              <div className="skeleton skeleton-text" style={{ width: '60px', height: '10px', marginBottom: 0 }} />
            </div>
            <div className="skeleton skeleton-rect" style={{ width: '40px', height: '40px', borderRadius: '12px' }} />
          </div>
        </nav>

        {/* Content Area Skeleton */}
        <main className={`container mobile-zoomed-main ${isNavigatingBack ? 'view-slide-in' : 'animate-fade'}`} style={{ padding: '60px 40px', maxWidth: '1400px', flex: 1 }}>
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            {/* Header / Avatar Block */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
              <div className="skeleton skeleton-circle" style={{ width: '80px', height: '80px' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="skeleton skeleton-title" style={{ width: '50%', marginBottom: 0 }} />
                <div className="skeleton skeleton-text short" style={{ width: '30%', marginBottom: 0 }} />
              </div>
            </div>

            <div className="skeleton skeleton-text" style={{ width: '20%', height: '24px', marginBottom: '16px' }} />
            <hr style={{ border: 'none', borderBottom: '2px solid var(--glass-border)', marginBottom: '24px' }} />

            {/* Menu Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--panel-bg)', height: '154px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton skeleton-text" style={{ width: '60%', height: '18px', marginBottom: 0 }} />
                    <div className="skeleton skeleton-circle" style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div className="skeleton skeleton-rect" style={{ width: '60px', height: '40px', borderRadius: '8px', marginTop: 'auto' }} />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }


  const isAdmin = currentUser?.role === 'admin';
  const isMaintenanceActive = maintenanceInfo?.enabled === true;

  if (isMaintenanceActive && !isAdmin) {
    return (
      <MaintenanceView
        maintenance={maintenanceInfo!}
        onRefresh={fetchSystemStatus}
        isChecking={isCheckingMaintenance}
        onAdminLogin={handleAdminLogin}
      />
    );
  }

  if (!isLoggedIn) return <LandingView onLoginSuccess={(user) => { setCurrentUser(user); setIsLoggedIn(true); }} />;

  const isAnyModalOpen = showAddModal || showTrailerModal || showBetaAutoFillModal || rejectModal.isOpen || updateState.isOpen;

  return (
    <div className="app-wrapper" style={{
      maxWidth: isMobile ? '100%' : '2000px',
      margin: '0 auto',
      width: '100%',
      minHeight: '100vh',
      position: 'relative'
    }}>
      {isMaintenanceActive && isAdmin && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          background: 'linear-gradient(90deg, #dc2626, #ea580c)',
          color: '#ffffff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.88rem',
          fontWeight: 700,
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>⚠️ メンテナンスモード稼働中（一般市民のアクセスは遮断されています）</span>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              setView('admin');
              setAdminTabPersist('maintenance');
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '4px 12px',
              fontSize: '0.8rem',
              fontWeight: 800,
              cursor: 'pointer'
            }}
          >
            設定変更 →
          </button>
        </div>
      )}
      <div className="app-layout" style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        padding: isMobile ? '0' : 'clamp(12px, 1.2vw, 24px) 24px',
        gap: isMobile ? '0' : 'clamp(16px, 1.5vw, 24px)',
        boxSizing: 'border-box',
        width: '100%',
        position: 'relative',
        overflow: 'visible'
      }}>
      {/* Decorative ambient background glows for Glassmorphism depth */}
      {!isMobile && (
        <>
          <div style={{
            position: 'absolute',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(0, 255, 136, 0.08) 0%, transparent 70%)',
            top: '5%',
            left: '-100px',
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'blur(60px)'
          }} />
          <div style={{
            position: 'absolute',
            width: '450px',
            height: '450px',
            background: 'radial-gradient(circle, rgba(0, 212, 255, 0.06) 0%, transparent 70%)',
            bottom: '10%',
            left: '-150px',
            zIndex: 0,
            pointerEvents: 'none',
            filter: 'blur(80px)'
          }} />
        </>
      )}
      {!isMobile && (
        <aside className="main-sidebar glass" style={{
          width: sidebarCollapsed ? '80px' : '400px',
          background: theme === 'light' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(10, 15, 25, 0.5)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100vh - clamp(24px, 2.4vw, 48px))',
          position: 'sticky',
          top: 'clamp(12px, 1.2vw, 24px)',
          zIndex: 100,
          padding: sidebarCollapsed ? '32px 10px' : '32px 20px',
          flexShrink: 0,
          justifyContent: 'space-between',
          transition: 'width 0.3s cubic-bezier(0.16, 1, 0.3, 1), padding 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Top segment: Logo + Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div className="nav-logo" onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
              <img src="/pizza.webp" alt="Logo" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '50%' }} />
              {!sidebarCollapsed && <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>ぴっざぁポータル</span>}
            </div>

            {/* App specific sidebar toggle button */}
            {isNative && (
              <button 
                onClick={toggleSidebar}
                className="btn glass"
                style={{
                  width: '100%',
                  padding: '10px 0',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
                title={sidebarCollapsed ? "メニューを展開" : "メニューをたたむ"}
              >
                {sidebarCollapsed ? <ChevronRight size={18} /> : <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ChevronLeft size={18} /> <span style={{ fontWeight: 600 }}>メニューをたたむ</span></div>}
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button className={`btn-sidebar ${view === 'home' || view === 'intro' ? 'active' : ''}`} onClick={() => setView('home')} style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <Home size={18} strokeWidth={view === 'home' || view === 'intro' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>ホーム</span>}
              </button>
              <button className={`btn-sidebar ${view === 'apply' ? 'active' : ''}`} onClick={() => setView('apply')} style={{ position: 'relative', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <ClipboardList size={18} strokeWidth={view === 'apply' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>市民申請</span>}
                {(!myApplication || myApplication.status === 'rejected') && (
                  <span className="badge-sidebar" style={sidebarCollapsed ? { position: 'absolute', top: '8px', right: '18px' } : {}} />
                )}
              </button>
              <button className={`btn-sidebar ${view === 'garage' ? 'active' : ''}`} onClick={() => setView('garage')} style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <LayoutDashboard size={18} strokeWidth={view === 'garage' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>ガレージ</span>}
              </button>
              <button className={`btn-sidebar ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')} style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <Flame size={18} strokeWidth={view === 'timeline' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>タイムライン</span>}
              </button>
              <button className={`btn-sidebar ${view === 'messages' ? 'active' : ''}`} onClick={() => setView('messages')} style={{ position: 'relative', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <MessageSquare size={18} strokeWidth={view === 'messages' ? 2.4 : 1.8} />
                  {unreadDmCount > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-8px',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      borderRadius: '10px',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 3px',
                      boxShadow: '0 2px 6px rgba(30, 58, 138, 0.3)'
                    }}>
                      {unreadDmCount > 9 ? '9+' : unreadDmCount}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && <span style={{ marginLeft: '8px' }}>メッセージ</span>}
              </button>
              <button className={`btn-sidebar ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')} style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                <UserIcon size={18} strokeWidth={view === 'profile' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>設定</span>}
              </button>
            </div>

            {/* ADMIN Section (Clear division for Admin users) */}
            {currentUser.role === 'admin' && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                {!sidebarCollapsed && (
                  <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 10px 6px' }}>
                    ADMIN / 管理
                  </div>
                )}
                <button className={`btn-sidebar ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')} style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '12px 0' : undefined }}>
                  <ShieldCheck size={18} strokeWidth={view === 'admin' ? 2.4 : 1.8} /> {!sidebarCollapsed && <span>管理パネル</span>}
                </button>
              </div>
            )}

            {/* PC: 車両登録ボタン（DMV Navyスタイル） */}
            <div style={{ marginTop: '16px' }}>
              <button
                onClick={() => handleOpenVehicleModal('gv')}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: sidebarCollapsed ? '12px 0' : '12px 18px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarCollapsed ? 'center' : 'center',
                  gap: '8px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary-hover)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(30, 58, 138, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(30, 58, 138, 0.25)';
                }}
                title="車両登録 (Alt+N)"
              >
                <Plus size={18} strokeWidth={2.6} />
                {!sidebarCollapsed && <span>車両を登録</span>}
              </button>
            </div>
          </div>

          {/* Bottom segment: User profile card */}
          <div className="glass sidebar-user-card" style={{
            padding: sidebarCollapsed ? '12px 4px' : '12px 14px',
            borderRadius: '16px',
            background: 'var(--panel-bg)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            flexDirection: sidebarCollapsed ? 'column' : 'row',
            gap: sidebarCollapsed ? '16px' : '12px',
            width: '100%',
            transition: 'all 0.3s ease'
          }}>
            <div 
              onClick={() => { triggerHaptic('light'); setView('profile'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: sidebarCollapsed ? undefined : 1, minWidth: 0, cursor: 'pointer', transition: 'all 0.2s ease', flexDirection: sidebarCollapsed ? 'column' : 'row' }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8'; (e.currentTarget.firstChild as HTMLElement).style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; (e.currentTarget.firstChild as HTMLElement).style.transform = 'none'; }}
            >
              <img src={currentUser.avatar} alt="u" onError={(e) => handleAvatarError(e, currentUser.username)} style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#fff', objectFit: 'cover', transition: 'transform 0.2s ease' }} />
              {!sidebarCollapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.username}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser.role === 'admin' ? '運営メンバー' : '一般メンバー'}</div>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexDirection: sidebarCollapsed ? 'column' : 'row' }}>
              <button
                onClick={() => { triggerHaptic('light'); setShowNotifications(!showNotifications); }}
                className="btn glass"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  position: 'relative',
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(255,255,255,0.03)',
                  padding: 0
                }}
              >
                <Bell size={14} style={{ color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-main)' }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: 'var(--error)',
                    color: '#fff',
                    borderRadius: '50%',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    minWidth: '13px',
                    height: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 4px var(--error)',
                  }}>
                    {unreadCount}
                  </span>
                )}
              </button>
              <a href="/api/auth/logout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
                <LogOut size={14} />
              </a>
            </div>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: isMobile ? '100vh' : 'calc(100vh - 48px)', position: 'relative', zIndex: 1 }}>

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: theme === 'light' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(10, 15, 25, 0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', paddingTop: 'calc(16px + var(--safe-top))', paddingBottom: '16px', paddingLeft: 'calc(16px + var(--safe-left))', paddingRight: 'calc(16px + var(--safe-right))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            {view === 'admin' && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMobileMenu(true); }} 
                className="btn glass"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', display: 'flex', padding: '4px', marginRight: '4px' }}
              >
                <Menu size={24} />
              </button>
            )}
            <div onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src="/pizza.webp" alt="Logo" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '50%' }} />
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>ぴっざぁポータル</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => { triggerHaptic('light'); setShowNotifications(!showNotifications); }}
              className="btn glass"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-main)',
                cursor: 'pointer',
                position: 'relative',
                border: '1px solid var(--glass-border)',
                background: 'rgba(255,255,255,0.03)',
                padding: 0,
              }}
            >
              <Bell size={16} style={{ color: unreadCount > 0 ? 'var(--primary)' : 'var(--text-main)' }} />
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: 'var(--error)',
                    color: '#fff',
                    borderRadius: '50%',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    minWidth: '15px',
                    height: '15px',
                    padding: '0 3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 6px var(--error)',
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setView('messages'); }}
              className="btn glass"
              title="メッセージ"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: view === 'messages' ? 'var(--primary)' : 'var(--text-main)',
                cursor: 'pointer',
                position: 'relative',
                border: '1px solid var(--glass-border)',
                background: view === 'messages' ? 'rgba(0,193,102,0.12)' : 'rgba(255,255,255,0.03)',
                padding: 0
              }}
            >
              <MessageSquare size={16} style={{ color: view === 'messages' ? 'var(--primary)' : 'var(--text-main)' }} />
              {unreadDmCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: 'var(--primary)',
                    color: theme === 'light' ? '#fff' : '#000',
                    borderRadius: '50%',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    minWidth: '15px',
                    height: '15px',
                    padding: '0 3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 6px rgba(0, 193, 102, 0.4)'
                  }}
                >
                  {unreadDmCount > 9 ? '9+' : unreadDmCount}
                </span>
              )}
            </button>
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <img
                src={currentUser.avatar}
                alt="u"
                onClick={() => { triggerHaptic('light'); setShowProfileMenu(!showProfileMenu); }}
                onError={(e) => handleAvatarError(e, currentUser.username)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: '#fff',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border: showProfileMenu ? '2px solid var(--primary)' : '2px solid transparent',
                  transition: 'border 0.2s',
                  display: 'block'
                }}
              />
              {showProfileMenu && (
                <div className="glass" style={{
                  position: 'absolute',
                  top: '40px',
                  right: 0,
                  background: 'var(--nav-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '8px',
                  minWidth: '160px',
                  boxShadow: theme === 'light' ? '0 8px 32px rgba(0,0,0,0.1)' : '0 8px 32px rgba(0,0,0,0.5)',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-main)', borderBottom: '1px solid var(--glass-border)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentUser.roblox_username || currentUser.username}
                  </div>
                  <button onClick={() => { triggerHaptic('light'); setView('apply'); setShowProfileMenu(false); }} style={{ background: 'none', border: 'none', padding: '10px 12px', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <ClipboardList size={14} /> 市民申請
                  </button>
                  {currentUser.role === 'admin' && (
                    <button onClick={() => { triggerHaptic('light'); setView('admin'); setShowProfileMenu(false); }} style={{ background: 'none', border: 'none', padding: '10px 12px', borderRadius: '8px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(30,58,138,0.06)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <ShieldCheck size={14} /> 管理パネル
                    </button>
                  )}
                  <button onClick={() => { triggerHaptic('light'); setView('profile'); setShowProfileMenu(false); }} style={{ background: 'none', border: 'none', padding: '10px 12px', borderRadius: '8px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <UserIcon size={14} /> 設定
                  </button>
                  <a href="/api/auth/logout" style={{ textDecoration: 'none', padding: '10px 12px', borderRadius: '8px', color: 'var(--error)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', width: '100%', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                    <LogOut size={14} /> ログアウト
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <main 
        className={`container mobile-zoomed-main ${isNavigatingBack ? 'view-slide-in' : 'animate-fade'}`} 
        style={{ 
          padding: isMobile ? '30px calc(16px + var(--safe-right)) calc(110px + var(--safe-bottom)) calc(16px + var(--safe-left))' : '0px clamp(16px, 1.5vw, 32px)', 
          flex: 1, 
          minWidth: 0, 
          margin: 0,
          transform: (isBackSwiping && !isAnyModalOpen && (view !== 'home' || (view === 'admin' && adminTab !== 'dashboard')))
            ? `scale(${1 - backProgress * 0.05}) translate3d(${backProgress * 8}%, 0, 0)`
            : 'none',
          borderRadius: (isBackSwiping && !isAnyModalOpen && (view !== 'home' || (view === 'admin' && adminTab !== 'dashboard')))
            ? `${backProgress * 24}px`
            : '0px',
          overflow: (isBackSwiping && !isAnyModalOpen && (view !== 'home' || (view === 'admin' && adminTab !== 'dashboard')))
            ? 'hidden'
            : 'visible',
          opacity: (isBackSwiping && !isAnyModalOpen && (view !== 'home' || (view === 'admin' && adminTab !== 'dashboard')))
            ? 1 - backProgress * 0.3
            : 1,
          transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease, border-radius 0.3s ease'
        }}
      >
        {view === 'home' ? (
          <div className="animate-fade" style={{ maxWidth: '100%', width: '100%', margin: isMobile ? '0 auto' : '0', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Top row: Official State ID Card + Garage Registry Summary */}
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '24px',
              alignItems: 'stretch',
              width: '100%'
            }}>
              {/* デジタル市民証カード (Official State ID) */}
              <div 
                onMouseMove={(e) => {
                  if (isMobile) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const cardX = e.clientX - rect.left - rect.width / 2;
                  const cardY = e.clientY - rect.top - rect.height / 2;
                  const rotateX = -(cardY / (rect.height / 2)) * 4;
                  const rotateY = (cardX / (rect.width / 2)) * 4;
                  setTilt({ x: rotateX, y: rotateY });
                }}
                onMouseLeave={() => {
                  setTilt({ x: 0, y: 0 });
                }}
                style={{
                  position: 'relative',
                  borderRadius: '20px',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1.35,
                  minWidth: 0,
                  transformStyle: isMobile ? 'flat' : 'preserve-3d',
                  transform: isMobile ? 'none' : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  transition: 'transform 0.15s ease-out, box-shadow 0.2s ease',
                  backfaceVisibility: 'hidden'
                }}
              >
                {/* Official State Header Bar */}
                <div style={{
                  background: 'linear-gradient(90deg, #1e3a8a 0%, #1e40af 100%)',
                  padding: '12px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: '#ffffff'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldCheck size={18} style={{ color: '#93c5fd' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-heading)' }}>
                      STATE OF GREENVIEW • OFFICIAL CITIZEN ID
                    </span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.75)', letterSpacing: '0.05em' }}>
                    DMV REGISTRY
                  </span>
                </div>

                <div style={{ padding: isMobile ? '20px' : '24px 28px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'center', flex: 1 }}>
                  {/* Left: Avatar & Official Badge */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={currentUser.avatar}
                        alt="Avatar"
                        onError={(e) => handleAvatarError(e, currentUser.username)}
                        style={{
                          width: '92px',
                          height: '92px',
                          borderRadius: '16px',
                          border: '2px solid #e2e8f0',
                          objectFit: 'cover',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}
                      />
                      {myApplication?.status === 'approved' && (
                        <span style={{
                          position: 'absolute',
                          bottom: '-4px',
                          right: '-4px',
                          background: '#2d6a4f',
                          color: '#ffffff',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 'bold',
                          fontSize: '0.75rem',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                        }}>✓</span>
                      )}
                    </div>

                    <div style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '5px 12px',
                      borderRadius: '20px',
                      background: myApplication?.status === 'approved'
                        ? 'rgba(45, 106, 79, 0.12)'
                        : myApplication?.status === 'pending'
                        ? 'rgba(180, 83, 9, 0.12)'
                        : 'rgba(107, 114, 128, 0.12)',
                      color: myApplication?.status === 'approved'
                        ? '#2d6a4f'
                        : myApplication?.status === 'pending'
                        ? '#b45309'
                        : '#4b5563',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}>
                      {myApplication?.status === 'approved' ? (
                        <><span>✓</span> VERIFIED CITIZEN</>
                      ) : myApplication?.status === 'pending' ? (
                        <><span>⏳</span> PENDING REVIEW</>
                      ) : (
                        <><span>ℹ️</span> UNVERIFIED</>
                      )}
                    </div>
                  </div>

                  {/* Right: Citizen Details & Bebas Neue ID */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: 0, textAlign: isMobile ? 'center' : 'left' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        NAME / 市民名
                      </div>
                      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', lineHeight: 1.2, fontFamily: 'var(--font-heading)' }}>
                        {currentUser.roblox_username || currentUser.username}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        @{currentUser.username}
                      </div>
                    </div>

                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        CITIZEN IDENTIFIER / 市民識別番号
                      </div>
                      <div style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 700, 
                        color: '#1e3a8a', 
                        fontFamily: 'var(--font-plate)', 
                        letterSpacing: '0.12em',
                        lineHeight: 1.2
                      }}>
                        GV-{(currentUser.roblox_id || currentUser.id || '2026').toString().padStart(7, '0')}-RP
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
                      <div>管轄: <strong style={{ color: '#1f2937' }}>Greenview / Rensselaer</strong></div>
                      <div>種別: <strong style={{ color: '#1f2937' }}>一般市民権 (Class R)</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ガレージ登録状況カード (Registry Summary Card) */}
              <div 
                className="card"
                style={{
                  background: '#ffffff',
                  borderRadius: '20px',
                  padding: isMobile ? '20px' : '24px 28px',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  flex: 1,
                  minWidth: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Car size={18} style={{ color: 'var(--primary)' }} />
                    車両登録簿
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button 
                      onClick={() => handleOpenVehicleModal('gv')}
                      style={{ background: 'rgba(30, 58, 138, 0.08)', border: '1px solid rgba(30, 58, 138, 0.15)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: '0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 58, 138, 0.08)'}
                      title="車両登録"
                    >
                      <Plus size={14} strokeWidth={2.5} /> 登録申請
                    </button>
                    <button 
                      onClick={() => { triggerHaptic('light'); setView('garage'); }} 
                      style={{ background: 'var(--btn-secondary-bg)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: '0.2s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-main)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                      詳細 <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Status counts pills */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1, background: 'rgba(45, 106, 79, 0.08)', border: '1px solid rgba(45, 106, 79, 0.15)', borderRadius: '12px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#2d6a4f', fontWeight: 600, marginBottom: '2px' }}>有効・承認済</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2d6a4f', fontFamily: 'var(--font-heading)' }}>
                      {vehicles.filter(v => v.status === 'approved' || v.status === 'approved_warning').length}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: 'rgba(180, 83, 9, 0.08)', border: '1px solid rgba(180, 83, 9, 0.15)', borderRadius: '12px', padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600, marginBottom: '2px' }}>審査・審査中</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#b45309', fontFamily: 'var(--font-heading)' }}>
                      {vehicles.filter(v => v.status === 'pending').length}
                    </div>
                  </div>
                </div>

                {/* List of latest vehicles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, overflowY: 'auto', maxHeight: '150px' }}>
                  {vehicles.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', border: '1px dashed var(--border)', borderRadius: '14px', justifyContent: 'center', flex: 1 }}>
                      <span>登録されている車両はありません</span>
                      <button 
                        onClick={() => { triggerHaptic('medium'); setView('garage'); setShowAddModal(true); }}
                        style={{ background: 'var(--primary)', border: 'none', color: '#ffffff', padding: '6px 14px', borderRadius: '10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: '0.2s' }}
                      >
                        🚗 最初の車両を申請する
                      </button>
                    </div>
                  ) : (
                    vehicles.slice(0, 2).map(v => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)', gap: '10px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {v.year} {v.maker} {v.model}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontFamily: 'var(--font-plate)', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{v.plate}</span>
                            <span>•</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.color}</span>
                          </div>
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

{/* ぴっざぁ公式Discord バナー */}
            <div 
              style={{
                borderRadius: '20px',
                padding: isMobile ? '16px 20px' : '20px 28px',
                background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.08) 0%, rgba(88, 101, 242, 0.02) 100%)',
                border: '1px solid rgba(88, 101, 242, 0.2)',
                boxShadow: '0 4px 20px rgba(88, 101, 242, 0.06)',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, textAlign: isMobile ? 'center' : 'left', flexDirection: isMobile ? 'column' : 'row' }}>
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: 'rgba(88, 101, 242, 0.15)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="24" height="24" viewBox="0 0 127.14 96.36" fill="#5865F2">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.8.71,1.64,1.41,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,50.22,123.6,27.31,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    ぴっざぁ公式 Discord コミュニティ
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    市民の交流、公式告知、ロールプレイのサポートチケット窓口はこちらから。
                  </p>
                </div>
              </div>

              <a 
                href="https://discord.gg/RruM8Gqc4m" 
                target="_blank" 
                rel="noopener noreferrer"
                className="btn"
                style={{
                  padding: '10px 22px',
                  borderRadius: '12px',
                  background: '#5865F2',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  border: 'none',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(88, 101, 242, 0.3)',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
              >
                参加する
              </a>
            </div>

            {/* 下段: 街の動向・タイムライン最新アクティビティ (重複メニューグリッドを排除し生きたコミュニティを表示) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '4px', height: '18px', background: 'var(--primary)', borderRadius: '2px' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    街の動向・タイムライン
                  </h3>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    onClick={() => { triggerHaptic('light'); setView('timeline'); setTimeout(() => setTriggerTimelineComposer(true), 150); }}
                    style={{ background: 'rgba(30, 58, 138, 0.08)', border: '1px solid rgba(30, 58, 138, 0.15)', color: 'var(--primary)', padding: '6px 14px', borderRadius: '10px', fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={14} strokeWidth={2.5} /> 投稿する
                  </button>
                  <button
                    onClick={() => { triggerHaptic('light'); setView('timeline'); }}
                    style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    すべて見る <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Feed cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                {recentTimelinePosts.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.9rem', gridColumn: '1 / -1' }}>
                    <MessageSquare size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 10px', opacity: 0.5 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>タイムラインの投稿がまだありません。</p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>街の様子や愛車の写真を投稿してみましょう！</p>
                  </div>
                ) : (
                  recentTimelinePosts.map(post => (
                    <div 
                      key={post.id}
                      onClick={() => {
                        triggerHaptic('light');
                        setTargetTimelinePostId(post.id);
                        setView('timeline');
                      }}
                      style={{
                        background: '#ffffff',
                        borderRadius: '16px',
                        border: '1px solid var(--border)',
                        padding: '16px 20px',
                        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                        cursor: 'pointer',
                        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.borderColor = 'rgba(30, 58, 138, 0.25)';
                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.03)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img 
                          src={`https://www.roblox.com/headshot-thumbnail/image?userId=${post.user_id}&width=150&height=150&format=png`} 
                          alt="avatar" 
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', background: '#f1f5f9' }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {post.author_name || '市民'}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(post.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {post.content}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: 'auto', paddingTop: '6px', borderTop: '1px solid rgba(0, 0, 0, 0.04)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Heart size={13} /> {post.likes_count || 0}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MessageSquare size={13} /> {post.comments_count || 0}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : view === 'intro' ? (
          <div className="animate-fade" style={{ maxWidth: '100%', width: '100%', margin: isMobile ? '0 auto' : '0', color: 'var(--text-main)' }}>
            <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '24px' }}>
              <ArrowLeft size={20} /> ホームへ戻る
            </button>
            <h2 style={{ fontSize: '2rem', marginBottom: '8px', fontWeight: 800 }}>🚗 ロールプレイサーバー 公式ルールブック</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>ぴっざぁ運営による公式ガイドラインです。市民申請の前に必ず熟読してください。</p>

            <div className="glass" style={{ padding: '32px', borderRadius: '16px', marginBottom: '24px', background: 'var(--panel-bg)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: '#10b981', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>🚗 車両登録および使用ルール</h3>
              <p style={{ marginBottom: '16px', color: 'var(--text-muted)' }}>当サーバーは「アメリカの田舎町」を舞台としたRP環境です。世界観の維持および適正なゲームバランスを保つため、通常セッション内で登録・使用できる車両に以下の制限を設けます。</p>
              
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>1. 禁止車両（通常時の登録・常用不可）</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>アメリカの田舎という舞台にそぐわない、またはRPにおいて過剰な性能を有する以下の車両は、通常時の登録および使用を禁止します。</p>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>ハイパーカー・スーパーカー:</strong> 極端な最高速度や加速性能を持ち、チェイス等のバランスを著しく崩す車両。</li>
                  <li><strong>限定車・希少モデル:</strong> 現実世界において生産台数が限られているような超高級車やコンセプトカー。</li>
                  <li><strong>過剰な装飾が施された特殊モデル:</strong> 純正の状態で、巨大なウィングや過剰なパーツが装着されている競技車両仕様のモデルなど。</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>2. 世界観に基づく推奨車両</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>当サーバーの景観に馴染む、以下のカテゴリーの車両登録を推奨します。</p>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li>ピックアップトラック、SUV、オフロードカー</li>
                  <li>一般的なセダン、ワゴン、ハッチバック</li>
                  <li>古き良きマッスルカーやクラシックカー</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>3. 公共車両・業務用車両（バス、配送バン、緊急車両等）の個人利用制限</h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px' }}>バス、配送バン、警察車両などの特殊な車両については、以下の通り制限を設けます。</p>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>個人利用の制限:</strong> これらの車両は個人での購入・所有が可能ですが、原則として「特定の職業RP（バス運転手、配送業者、警察官等）」としての使用に限定します。</li>
                  <li><strong>常用・マイカー利用の禁止:</strong> 一般市民としての日常生活や、単なる移動手段としての常用は、RPの観点からご遠慮ください。</li>
                  <li><strong>専用塗装の扱い:</strong> 特定ジョブ専用の塗装（ポリスデカールや企業ロゴ等）が施された状態での個人利用は厳禁とします。</li>
                </ul>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>4. その他のルール（外観・イベント）</h4>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>外観・カスタムの制限:</strong> 田舎町の景観を著しく損なう過度なカスタム（極端なローダウン等）はご遠慮ください。</li>
                  <li><strong>イベント時の特例について:</strong> レース、カーミート（オフ会）、ドラッグレースなどの公式・非公式イベント開催時については、本ルールの限りではありません。イベントの趣旨に合わせた車両の持ち込みやカスタムについては、各イベントのアナウンスやレギュレーションに従ってください。</li>
                </ul>
              </div>
              
              <div style={{ padding: '16px', background: 'rgba(255,177,66,0.1)', borderRadius: '12px', borderLeft: '4px solid #ffb142' }}>
                <strong style={{ display: 'block', marginBottom: '4px', color: '#ffb142' }}>【判断に迷った際の基準】</strong>
                「この車は、アメリカの田舎町のスーパーの駐車場に停まっていて違和感がないか？」を基準に車両を選定してください。基準に適合しないと運営が判断した車両は、登録取り消しをお願いする場合があります。
              </div>
            </div>

            <div className="glass" style={{ padding: '32px', borderRadius: '16px', marginBottom: '24px', background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--error)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>🚨 緊急時のルールと制約</h3>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>ピースタイム（平和な時間）</h4>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>定義:</strong> 緊急車両の担当者が不足している場合に告知される時間帯。</li>
                  <li><strong>制限:</strong> ピースタイム中は、いかなる犯罪行為、法律違反行為も許可されない。</li>
                  <li><strong>ペナルティ:</strong> これを破った場合、即座にキックされる可能性があるため、十分に注意すること。</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>犯罪行為</h4>
                <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>実行頻度:</strong> 緊急車両の出動体制を考慮し、犯罪行為の実行頻度は10分に1回までとする。これ以上の頻度はFRP（不適切なロールプレイ）と見なされる。</li>
                  <li><strong>逃走時の退出:</strong> 警察に手配された状態でセッションを退出（ログアウト）した場合、手配状態は次のRPセッションに引き継がれ、再参加時にジョブ（役職）を変更することはできない。</li>
                </ul>
              </div>
            </div>

            <div className="glass" style={{ padding: '32px', borderRadius: '16px', marginBottom: '24px', background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: '#ffb142', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>🚦 交通規則（アメリカ交通法準拠）</h3>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>速度と違反</h4>
                 <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>制限速度の超過:</strong> 制限速度から6mph(10km/h)までの速度超過は許容される場合があるが、状況によっては（学校区域など）違反となることもある。</li>
                  <li><strong>重度の速度違反:</strong> これ以上の速度超過は、違反点数が通常の倍となり、免許停止処分を受ける可能性がある。</li>
                  <li><strong>危険運転の禁止:</strong> Tailgating（前の車に執拗に付いていく行為）や煽り運転は明確な交通違反と見なされる。</li>
                </ul>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>アメリカ特有の規則（重要）</h4>
                 <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>赤信号での右折:</strong> 通常、赤信号でも左右の安全を確認した上で右折（Right Turn on Red）が可能だ。ただし、赤信号では必ず一時停止（Stop）をしないと違反となる。例外として、標識で右折が禁止されている交差点もある。</li>
                  <li><strong>信号のない交差点:</strong> 優先権は、自分から見て右側にいる車にある。</li>
                  <li><strong>環状交差点:</strong> 手前の「YIELD」（譲れ）標識に従い、交差点内にいる車の走行を妨げない限り、一時停止をせずに進入・通過して良い。</li>
                  <li><strong>踏切:</strong> 一時停止の必要はない。</li>
                </ul>
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 600 }}>交通違反とペナルティ</h4>
                 <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                  <li><strong>警察からの逃走:</strong> 警察の停止命令から逃走を続けることは可能だが、その場合、違反回数が自動的に倍としてカウントされる。</li>
                  <li><strong>違反回数の上限:</strong> 交通違反の回数は月間で8回まで。これを超えると1週間ロールプレイサーバーに参加できなくなる。</li>
                </ul>
              </div>
            </div>
            
            <div className="glass" style={{ padding: '32px', borderRadius: '16px', marginBottom: '24px', background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: '#ff5252', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>💥 事故処理とモラル</h3>
               <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8, marginBottom: '20px' }}>
                 <li><strong>事故発生時の対応:</strong> 人身事故（高速）などで負傷者が確認された場合は、保険請求のためにも必ず現場の写真を記録し、警察に通報すること。現場からの立ち去りは当て逃げとして指名手配犯となる。</li>
                 <li><strong>モラルと騒音:</strong> セッションホストや運営の指示には必ず従うこと。クラクションの乱用、レブアップ、無駄なドアベルなどの過度な騒音や迷惑行為は禁止。</li>
               </ul>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: '#ff5252', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>⛔ 禁止行為と非RP行為（FRP）</h3>
               <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                 <li>深刻な倫理的問題を伴う以下のような行為は全て禁止（性的なRP、子供の無視、学校での銃撃、麻薬関連、グラフィックな残虐RP、大量殺人など）。</li>
                 <li><strong>コンバットログの禁止:</strong> ゲーム内の戦闘や緊迫したシーンの最中では、いかなる理由があっても無言での退出（ログアウト）は許可されない。緊急時は必ず運営に連絡すること。</li>
               </ul>
            </div>

            <div className="glass" style={{ padding: '32px', borderRadius: '16px', marginBottom: '24px', background: 'var(--panel-bg)' }}>
              <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', color: 'var(--primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>🅿️ 車両とジョブ</h3>
               <ul style={{ listStyleType: 'disc', paddingLeft: '20px', lineHeight: 1.8 }}>
                 <li><strong>車両のスポーン場所:</strong> 駐車場に限定される。路上、空き地など、現実的でない場所や危険な場所でのスポーンは禁止。</li>
                 <li><strong>ジョブと資格:</strong> 警察官（LEO）、GVFD、DOTとして参加するには、適切なトレーニングとDiscordでの役職が必須。</li>
                 <li><strong>車両登録の義務:</strong> RPに参加する車両は全て事前にこのシステムで登録が必要。売却やカスタム後の変更も速やかに再申請すること。</li>
               </ul>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px' }}>
               <button className="btn btn-primary" onClick={() => setView('apply')} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 600 }}>
                 ✍️ ルールを理解した上で市民申請へ進む
               </button>
            </div>
          </div>
        ) : view === 'apply' ? (
          <ApplicationFormView
            myApplication={myApplication}
            isLoading={isLoading}
            questions={questions}
            currentUser={currentUser}
            applyAnswers={applyAnswers as any}
            applySubmitting={applySubmitting}
            setApplyAnswers={setApplyAnswers as any}
            handleSubmitApplication={handleSubmitApplication}
            handleManualRefresh={handleManualRefresh}
            setView={setView}
            isMobile={isMobile}
          />
        ) : view === 'garage' ? (
          <MyGarageView
            myApplication={myApplication}
            vehicles={vehicles}
            isLoading={isLoading}
            handleManualRefresh={handleManualRefresh}
            garageTab={garageTab}
            setGarageTab={setGarageTab}
            garageViewMode={garageViewMode}
            setGarageViewMode={setGarageViewMode}
            garageSortOrder={garageSortOrder}
            setGarageSortOrder={setGarageSortOrder}
            setView={setView}
            currentUser={currentUser}
            setShowBetaAutoFillModal={setShowBetaAutoFillModal}
            setFormData={setFormData}
            setEditingVehicleId={setEditingVehicleId}
            setShowAddModal={setShowAddModal}
            setTrailerFormData={setTrailerFormData}
            setShowTrailerModal={setShowTrailerModal}
            handleStartEdit={handleStartEdit}
            handleDeleteVehicle={handleDeleteVehicle}
            isMobile={isMobile}
            dataSaverEnabled={dataSaverEnabled}
          />
        ) : view === 'profile' ? (
          <ProfileView
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            theme={theme}
            setTheme={setTheme}
            handleUpdateProfile={handleUpdateProfile}
            onCheckUpdate={() => handleCheckUpdate(true)}
            isCheckingUpdate={isCheckingUpdate}
            appVersion={appVersion}
            autoCheckUpdates={autoCheckUpdates}
            onToggleAutoCheck={handleToggleAutoCheck}
            pushSettings={pushSettings}
            onTogglePushSetting={handleTogglePushSetting}
            enterKeyBehavior={enterKeyBehavior}
            setEnterKeyBehavior={setEnterKeyBehavior}
            liteMode={liteMode}
            onToggleLiteMode={handleToggleLiteMode}
            dataSaverEnabled={dataSaverEnabled}
            onToggleDataSaver={handleToggleDataSaver}
          />
        ) : view === 'timeline' ? (
          <TimelineView
            currentUser={currentUser}
            isMobile={isMobile}
            theme={theme}
            targetPostId={targetTimelinePostId}
            onClearTargetPost={() => setTargetTimelinePostId(null)}
            enterKeyBehavior={enterKeyBehavior}
            dataSaverEnabled={dataSaverEnabled}
            triggerComposer={triggerTimelineComposer}
            onComposerTriggered={() => setTriggerTimelineComposer(false)}
          />
        ) : view === 'messages' ? (
          <DirectMessagesView
            currentUser={currentUser}
            isMobile={isMobile}
            theme={theme}
            initialConversationId={dmTargetConversationId}
            initialTargetUserId={dmTargetUserId}
            onClearInitialIds={() => {
              setDmTargetConversationId(null);
              setDmTargetUserId(null);
            }}
            onUnreadCountChange={(cnt) => setUnreadDmCount(cnt)}
            onClose={() => setView('home')}
          />
        ) : (
          <AdminDashboardView
            adminTab={adminTab}
            setAdminTabPersist={setAdminTabPersist}
            maintenance={maintenanceInfo}
            onUpdateMaintenance={handleUpdateMaintenance}
            vehicles={vehicles}
            allSearchVehicles={allSearchVehicles}
            allUsers={allUsers}
            allApplications={allApplications}
            allQuestionsAdmin={allQuestionsAdmin}
            editingQuestion={editingQuestion}
            setEditingQuestion={setEditingQuestion}
            isLoading={isLoading}
            isMobile={isMobile}
            showMobileMenu={showMobileMenu}
            setShowMobileMenu={setShowMobileMenu}
            handleManualRefresh={handleManualRefresh}
            handleUpdateStatus={handleUpdateStatus}
            handleDeleteVehicle={handleDeleteVehicle}
            handleUpdateRole={handleUpdateRole}
            handleReviewApplication={handleReviewApplication}
            handleWikiSync={handleWikiSync}
            handleSaveQuestion={handleSaveQuestion}
            handleToggleQuestion={handleToggleQuestion}
            currentUser={currentUser}
            setView={setView}
            selectedUserForVehicles={selectedUserForVehicles}
            setSelectedUserForVehicles={setSelectedUserForVehicles}
            adminSearchTerm={adminSearchTerm}
            setAdminSearchTerm={setAdminSearchTerm}
            adminSortOrder={adminSortOrder}
            setAdminSortOrder={setAdminSortOrder}
            userSearchTerm={userSearchTerm}
            setUserSearchTerm={setUserSearchTerm}
            usersViewMode={usersViewMode}
            setUsersViewMode={setUsersViewMode}
            lookupViewMode={lookupViewMode}
            setLookupViewMode={setLookupViewMode}
          />
        )}
      </main>

      {isMobile && (
        <nav style={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          background: theme === 'dark' ? 'rgba(18, 19, 24, 0.85)' : 'rgba(255, 255, 255, 0.75)', 
          backdropFilter: 'blur(20px) saturate(180%)', 
          WebkitBackdropFilter: 'blur(20px) saturate(180%)', 
          borderTop: '1px solid var(--border)', 
          display: 'flex', 
          justifyContent: 'space-around', 
          alignItems: 'center',
          padding: '8px calc(8px + var(--safe-right)) calc(8px + var(--safe-bottom)) calc(8px + var(--safe-left))', 
          zIndex: 1000,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Tab 1: Home */}
          <button onClick={() => { triggerHaptic('light'); setView('home'); }} style={{ background: 'none', border: 'none', color: (view === 'home' || view === 'intro') ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <Home size={22} fill={(view === 'home' || view === 'intro') ? 'currentColor' : 'none'} strokeWidth={(view === 'home' || view === 'intro') ? 2.4 : 1.8} />
            <span style={{ fontSize: '0.65rem', fontWeight: (view === 'home' || view === 'intro') ? 700 : 500, whiteSpace: 'nowrap' }}>ホーム</span>
          </button>
          
          {/* Tab 2: Garage */}
          <button onClick={() => { triggerHaptic('light'); setView('garage'); }} style={{ background: 'none', border: 'none', color: view === 'garage' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <Car size={22} fill={view === 'garage' ? 'currentColor' : 'none'} strokeWidth={view === 'garage' ? 2.4 : 1.8} />
            <span style={{ fontSize: '0.65rem', fontWeight: view === 'garage' ? 700 : 500, whiteSpace: 'nowrap' }}>ガレージ</span>
          </button>
          
          {/* Tab 3: Center Plus Action Button */}
          <div className="mobile-nav-plus-wrapper" style={{ flex: 1 }}>
            <button className="mobile-nav-plus-btn" onClick={handleMobilePlusClick} aria-label="新規アクション">
              <Plus size={28} strokeWidth={2.8} />
            </button>
          </div>
          
          {/* Tab 4: Timeline */}
          <button onClick={() => { triggerHaptic('light'); setView('timeline'); }} style={{ background: 'none', border: 'none', color: view === 'timeline' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <Flame size={22} fill={view === 'timeline' ? 'currentColor' : 'none'} strokeWidth={view === 'timeline' ? 2.4 : 1.8} />
            <span style={{ fontSize: '0.65rem', fontWeight: view === 'timeline' ? 700 : 500, whiteSpace: 'nowrap' }}>タイムライン</span>
          </button>

          {/* Tab 5: Messages */}
          <button onClick={() => { triggerHaptic('light'); setView('messages'); }} style={{ background: 'none', border: 'none', color: view === 'messages' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flex: 1, padding: '4px 0', cursor: 'pointer', position: 'relative' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={22} fill={view === 'messages' ? 'currentColor' : 'none'} strokeWidth={view === 'messages' ? 2.4 : 1.8} />
              {unreadDmCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-8px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontSize: '0.62rem',
                  fontWeight: 900,
                  minWidth: '15px',
                  height: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  boxShadow: '0 2px 6px rgba(30, 58, 138, 0.4)'
                }}>
                  {unreadDmCount > 9 ? '9+' : unreadDmCount}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: view === 'messages' ? 700 : 500, whiteSpace: 'nowrap' }}>メッセージ</span>
          </button>
        </nav>
      )}

      {showAddModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
          WebkitBackdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)',
          backdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)', 
          opacity: isBackSwiping ? 1 - backProgress : 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000, 
          isolation: 'isolate',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          padding: 'calc(24px + var(--safe-top)) calc(24px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(24px + var(--safe-left))',
          transition: isBackSwiping ? 'none' : 'opacity 0.3s ease, backdrop-filter 0.3s ease'
        }}>
          <div 
            className="glass card animate-fade" 
            style={{ 
              width: '100%', 
              maxWidth: '680px', 
              padding: isMobile ? '20px' : '40px', 
              borderRadius: '24px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              transform: isBackSwiping ? `scale(${1 - backProgress * 0.08}) translate3d(0, ${backProgress * 20}px, 0)` : 'none',
              opacity: isBackSwiping ? 1 - backProgress : 1,
              transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
            }}
          >

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>{editingVehicleId ? '車両情報の修正' : '新規車両の登録'}</h2>
                <p style={{ color: 'var(--text-muted)', margin: '4px 0 0', fontSize: '0.9rem' }}>必要な情報を入力してください。</p>
              </div>
              {!editingVehicleId && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowBetaAutoFillModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    border: '1px dashed var(--primary)',
                    color: 'var(--primary)',
                    background: 'rgba(0,193,102,0.08)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  ✨ 画像から自動入力 (Beta)
                </button>
              )}
            </div>
            <div style={{ padding: '16px', background: 'rgba(255,177,66,0.1)', borderRadius: '12px', borderLeft: '4px solid #ffb142', marginBottom: isMobile ? '16px' : '32px' }}>

              <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#ffb142', fontSize: '0.95rem' }}>
                ⚠️ 車両選定の基準（公式ルールより）
              </strong>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', lineHeight: 1.6, margin: 0 }}>
                「この車は、アメリカの田舎町のスーパーの駐車場に停まっていて違和感がないか？」を基準に選定してください。<br/>
                <span style={{ color: 'var(--text-muted)' }}>※スーパーカーや競技車両、過度なカスタムなど、基準に適合しないと運営が判断した場合、登録取り消しをお願いする場合があります。</span>
              </p>
            </div>
            <form onSubmit={handleSubmitVehicle} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              {/* ゲーム選択トグル (Gv / RC) */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>対象ゲーム (Target Game)</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, game_type: 'gv', maker: '', model: '' }));
                      loadCatalog('gv');
                      triggerHaptic('segment_tick');
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
                      triggerHaptic('segment_tick');
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
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '20px' }}>

                 <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Maker</label>
                    <input type="text" list="maker-list" placeholder="例: Toyota" value={formData.maker} onChange={e => setFormData({...formData, maker: e.target.value, model: ''})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                    <datalist id="maker-list">
                      {Object.keys(carModels).map(maker => (
                        <option key={maker} value={maker} />
                      ))}
                    </datalist>
                 </div>
                 <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Model</label>
                    <input type="text" list="model-list" placeholder="例: Camry" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                    <datalist id="model-list">
                      {(carModels[formData.maker] || []).map(model => (
                         <option key={model} value={model} />
                      ))}
                    </datalist>
                 </div>
              </div>

              {/* Wiki Image Preview */}
              {(wikiLoading || wikiPreviewUrl) && (
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--glass-border)', position: 'relative' }}>
                  {wikiLoading && (
                    <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--input-bg)', color: 'var(--text-muted)', fontSize: '0.85rem', gap: '8px' }}>
                      <RefreshCw size={16} className="animate-spin" /> Wikiから画像を取得中...
                    </div>
                  )}
                  {!wikiLoading && wikiPreviewUrl && (
                    <div style={{ position: 'relative' }}>
                      <img src={wikiPreviewUrl} alt="Wiki preview" style={{ width: '100%', height: '180px', objectFit: 'contain', display: 'block', background: 'rgba(0,0,0,0.3)' }} />
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px', background: 'linear-gradient(transparent, rgba(0,0,0,0.7))', fontSize: '0.75rem', color: '#fff' }}>📖 {formData.game_type === 'rc' ? 'Rensselaer County' : 'Greenville'} Wiki より参照画像（登録にはご自身の画像をアップロードしてください）</div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? '12px' : '20px' }}>

                 <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Year</label>
                    <input type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                 </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trim / Grade</label>
                    <input type="text" list="trim-list" placeholder="例: XSE" value={formData.trim} onChange={e => setFormData({...formData, trim: e.target.value})} className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                    <datalist id="trim-list">
                      {wikiTrims.map(t => <option key={t} value={t} />)}
                    </datalist>
                 </div>
                 <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Color</label>
                    <input type="text" list="color-list" placeholder="例: Black" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                    <datalist id="color-list">
                      {wikiColors.map(c => <option key={c} value={c} />)}
                    </datalist>
                 </div>
              </div>              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Area</label>
                 <input type="text" placeholder="例: WISCONSIN" value={formData.plate_region} onChange={e => setFormData({...formData, plate_region: e.target.value})} className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
              </div>
              
              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>登録区分 (Registration Mode)</label>
                 <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                   <button
                     type="button"
                     onClick={() => setRegistrationMode('normal')}
                     style={{
                       flex: 1,
                       padding: '10px 16px',
                       borderRadius: '8px',
                       border: 'none',
                       background: registrationMode === 'normal' ? 'rgba(255, 177, 66, 0.2)' : 'transparent',
                       color: registrationMode === 'normal' ? '#ffb142' : 'var(--text-muted)',
                       fontWeight: 600,
                       cursor: 'pointer',
                       transition: 'all 0.2s ease',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '6px',
                       boxShadow: registrationMode === 'normal' ? '0 2px 8px rgba(255, 177, 66, 0.15)' : 'none'
                     }}
                   >
                     🚗 通常登録
                   </button>
                   <button
                     type="button"
                     onClick={() => setRegistrationMode('temp')}
                     style={{
                       flex: 1,
                       padding: '10px 16px',
                       borderRadius: '8px',
                       border: 'none',
                       background: registrationMode === 'temp' ? 'rgba(255, 177, 66, 0.2)' : 'transparent',
                       color: registrationMode === 'temp' ? '#ffb142' : 'var(--text-muted)',
                       fontWeight: 600,
                       cursor: 'pointer',
                       transition: 'all 0.2s ease',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '6px',
                       boxShadow: registrationMode === 'temp' ? '0 2px 8px rgba(255, 177, 66, 0.15)' : 'none'
                     }}
                   >
                     🅿️ 仮ナンバー登録
                   </button>
                 </div>
              </div>
              
              <div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                   <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number *</label>
                   {plateChecking && (
                     <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                       <RefreshCw size={12} className="spin" /> 重複確認中...
                     </span>
                   )}
                 </div>
                 <input
                   type="text"
                   placeholder="例: ABC-1234"
                   value={formData.plate}
                   onChange={e => {
                     setFormData({...formData, plate: e.target.value.toUpperCase()});
                     if (plateDuplicateWarning) setPlateDuplicateWarning(null);
                   }}
                   required
                   className="glass"
                   style={{
                     width: '100%',
                     padding: '14px',
                     borderRadius: '12px',
                     border: plateDuplicateWarning ? '2px solid #ff4d4f' : '1px solid rgba(255,255,255,0.1)',
                     boxShadow: plateDuplicateWarning ? '0 0 12px rgba(255, 77, 79, 0.25)' : 'none',
                     color: 'var(--text-main)',
                     fontSize: '1.2rem',
                     fontFamily: 'monospace',
                     fontWeight: 700,
                     background: plateDuplicateWarning ? 'rgba(255, 77, 79, 0.08)' : 'var(--input-bg)',
                     transition: 'all 0.2s ease'
                   }}
                 />
                 {plateDuplicateWarning && (
                   <div style={{
                     marginTop: '8px',
                     padding: '10px 14px',
                     borderRadius: '10px',
                     background: 'rgba(255, 77, 79, 0.15)',
                     border: '1px solid rgba(255, 77, 79, 0.4)',
                     color: '#ff7875',
                     fontSize: '0.85rem',
                     fontWeight: 600,
                     display: 'flex',
                     alignItems: 'center',
                     gap: '8px'
                   }}>
                     <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                     <span>既にこの車両は登録されています！別のナンバーを入力してください。</span>
                   </div>
                 )}
              </div>

              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                   Vehicle Images (最大4枚)
                 </label>
                 <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'center' }}>
                   {parseImages(formData.image_data).map((imgUrl, i) => (
                     <div key={i} style={{ width: '120px', height: '120px', flexShrink: 0, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                       <img src={getImageUrl(imgUrl)} alt={`preview ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <button type="button" onClick={() => handleRemoveImage(i)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'var(--text-main)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>&times;</button>
                     </div>
                   ))}
                   {parseImages(formData.image_data).length < 4 && (
                     <div style={{ width: '120px', height: '120px', flexShrink: 0, borderRadius: '12px', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--input-bg)' }}>
                       <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}><ImageIcon size={24} style={{ margin: '0 auto 4px' }}/>追加 ({parseImages(formData.image_data).length}/4)</div>
                       {isNative ? (
                          <button
                            type="button"
                            onClick={async () => {
                              const existing = parseImages(formData.image_data);
                              const remaining = 4 - existing.length;
                              if (remaining <= 0) return;
                              setIsLoading(true);
                              try {
                                const base64Images = await pickImagesNative(remaining);
                                if (base64Images.length > 0) {
                                  const combined = [...existing, ...base64Images];
                                  setFormData({ ...formData, image_data: JSON.stringify(combined) });
                                }
                              } catch (err) {
                                console.error("Native pick images failed:", err);
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', background: 'transparent' }}
                          />
                        ) : (
                          <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                        )}
                     </div>
                   )}
                 </div>



              </div>


              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '16px', fontSize: '1rem', borderRadius: '12px' }}
                  disabled={vehicleSubmitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={vehicleSubmitting || !!plateDuplicateWarning || plateChecking}
                  style={{
                    flex: 2,
                    padding: '16px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    cursor: (vehicleSubmitting || !!plateDuplicateWarning || plateChecking) ? 'not-allowed' : 'pointer',
                    opacity: (vehicleSubmitting || !!plateDuplicateWarning || plateChecking) ? 0.6 : 1,
                    background: plateDuplicateWarning ? '#ff4d4f' : undefined,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {vehicleSubmitting
                    ? '送信中...'
                    : plateDuplicateWarning
                    ? '🚫 重複のため申請できません'
                    : (editingVehicleId ? '変更を保存する' : '申請を送信する')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTrailerModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
          WebkitBackdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)',
          backdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)', 
          opacity: isBackSwiping ? 1 - backProgress : 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000, 
          isolation: 'isolate',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          padding: 'calc(24px + var(--safe-top)) calc(24px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(24px + var(--safe-left))',
          overflowY: 'auto',
          transition: isBackSwiping ? 'none' : 'opacity 0.3s ease, backdrop-filter 0.3s ease'
        }}>
          <div 
            className="glass card animate-fade" 
            style={{ 
              width: '100%', 
              maxWidth: '560px', 
              padding: isMobile ? '20px' : '40px', 
              borderRadius: '24px',
              transform: isBackSwiping ? `scale(${1 - backProgress * 0.08}) translate3d(0, ${backProgress * 20}px, 0)` : 'none',
              opacity: isBackSwiping ? 1 - backProgress : 1,
              transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
            }}
          >

            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>🚛 トレーラーを追加</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9rem' }}>被牽引車（トレーラー）の登録申請を行います。</p>
            <form onSubmit={handleSubmitTrailer} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
              {/* ゲーム選択トグル (Gv / RC) */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>対象ゲーム (Target Game)</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTrailerFormData(prev => ({ ...prev, game_type: 'gv' }));
                      triggerHaptic('segment_tick');
                    }}
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
                    onClick={() => {
                      setTrailerFormData(prev => ({ ...prev, game_type: 'rc' }));
                      triggerHaptic('segment_tick');
                    }}
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
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '12px' : '16px' }}>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Model（トレーラー名） *</label>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => setShowModelDropdown(!showModelDropdown)}
                      className="glass" 
                      style={{ 
                        width: '100%', 
                        padding: '14px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: trailerFormData.model ? 'var(--text-main)' : 'var(--text-muted)', 
                        fontSize: '1rem', 
                        background: 'var(--input-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      {trailerFormData.model ? `Durable ${trailerFormData.model}` : '-- 選択 --'}
                      <ChevronDown size={18} style={{ transform: showModelDropdown ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                    </div>

                    {showModelDropdown && (
                      <div className="glass animate-fade" style={{ 
                        position: 'absolute', 
                        top: 'calc(100% + 8px)', 
                        left: 0, 
                        right: 0, 
                        background: 'var(--glass-bg)', 
                        backdropFilter: 'blur(16px)',
                        borderRadius: '16px', 
                        border: '1px solid var(--primary)', 
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 1100, 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        padding: '8px'
                      }}>
                        {[
                          "4' x 6' Enclosed Box Trailer",
                          "6' x 8' Trailer",
                          "8' x 24' Car Transporter",
                          "12' x 6' Off-Road Trailer",
                          "15' x 8' Tear Drop Camper",
                          "16' x 6' Enclosed Box Trailer",
                          "16' X 8' Car Transporter",
                          "16' x 8' Camper",
                          "20' x 8' Dual Axle Camper",
                          "Boat Trailer",
                          "Sign Message Trailer"
                        ].map(m => (
                          <div 
                            key={m}
                            onClick={() => {
                              setTrailerFormData({...trailerFormData, model: m, maker: 'Durable'});
                              setShowModelDropdown(false);
                            }}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              color: 'var(--text-main)',
                              fontSize: '0.95rem',
                              transition: '0.2s',
                              background: trailerFormData.model === m ? 'var(--primary-glow)' : 'transparent',
                              border: trailerFormData.model === m ? '1px solid var(--primary)' : '1px solid transparent',
                              marginBottom: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = trailerFormData.model === m ? 'var(--primary-glow)' : 'transparent';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            Durable {m}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Maker（メーカー）</label>
                  <input type="text" value={trailerFormData.maker} readOnly className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontSize: '1rem', background: 'var(--input-bg)', cursor: 'default' }} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trailer Type（種別）</label>
                  <div style={{ position: 'relative' }}>
                    <div 
                      onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                      className="glass" 
                      style={{ 
                        width: '100%', 
                        padding: '14px', 
                        borderRadius: '12px', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        color: trailerFormData.trailer_type ? 'var(--text-main)' : 'var(--text-muted)', 
                        fontSize: '1rem', 
                        background: 'var(--input-bg)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      {trailerFormData.trailer_type || '-- 選択 --'}
                      <ChevronDown size={18} style={{ transform: showTypeDropdown ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                    </div>

                    {showTypeDropdown && (
                      <div className="glass animate-fade" style={{ 
                        position: 'absolute', 
                        top: 'calc(100% + 8px)', 
                        left: 0, 
                        right: 0, 
                        background: 'var(--glass-bg)', 
                        backdropFilter: 'blur(16px)',
                        borderRadius: '16px', 
                        border: '1px solid var(--primary)', 
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 1100, 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        padding: '8px'
                      }}>
                        {[
                          { val: "Flatbed", label: "Flatbed（平台）" },
                          { val: "Box", label: "Box（ボックス）" },
                          { val: "Enclosed", label: "Enclosed（密閉型）" },
                          { val: "Car Hauler", label: "Car Hauler（車両運搬）" },
                          { val: "Livestock", label: "Livestock（家畜）" },
                          { val: "Dump", label: "Dump（ダンプ）" },
                          { val: "Utility", label: "Utility（汎用）" },
                          { val: "Other", label: "Other（その他）" }
                        ].map(t => (
                          <div 
                            key={t.val}
                            onClick={() => {
                              setTrailerFormData({...trailerFormData, trailer_type: t.val});
                              setShowTypeDropdown(false);
                            }}
                            style={{
                              padding: '12px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              color: 'var(--text-main)',
                              fontSize: '0.95rem',
                              transition: '0.2s',
                              background: trailerFormData.trailer_type === t.val ? 'var(--primary-glow)' : 'transparent',
                              border: trailerFormData.trailer_type === t.val ? '1px solid var(--primary)' : '1px solid transparent',
                              marginBottom: '4px'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--btn-secondary-hover)';
                              e.currentTarget.style.transform = 'translateX(4px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = trailerFormData.trailer_type === t.val ? 'var(--primary-glow)' : 'transparent';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            {t.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Color</label>
                  <input type="text" placeholder="例: Black" value={trailerFormData.color} onChange={e => setTrailerFormData({...trailerFormData, color: e.target.value})} className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Area *</label>
                <input type="text" placeholder="例: WISCONSIN" value={trailerFormData.plate_region} onChange={e => setTrailerFormData({...trailerFormData, plate_region: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1rem', background: 'var(--input-bg)' }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number *</label>
                  {trailerPlateChecking && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={12} className="spin" /> 重複確認中...
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="例: TRL-1234"
                  value={trailerFormData.plate}
                  onChange={e => {
                    setTrailerFormData({...trailerFormData, plate: e.target.value.toUpperCase()});
                    if (trailerPlateDuplicateWarning) setTrailerPlateDuplicateWarning(null);
                  }}
                  required
                  className="glass"
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '12px',
                    border: trailerPlateDuplicateWarning ? '2px solid #ff4d4f' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: trailerPlateDuplicateWarning ? '0 0 12px rgba(255, 77, 79, 0.25)' : 'none',
                    color: 'var(--text-main)',
                    fontSize: '1.2rem',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    background: trailerPlateDuplicateWarning ? 'rgba(255, 77, 79, 0.08)' : 'var(--input-bg)',
                    transition: 'all 0.2s ease'
                  }}
                />
                {trailerPlateDuplicateWarning && (
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(255, 77, 79, 0.15)',
                    border: '1px solid rgba(255, 77, 79, 0.4)',
                    color: '#ff7875',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>既にこの車両は登録されています！別のナンバーを入力してください。</span>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowTrailerModal(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '16px', borderRadius: '12px' }}
                  disabled={trailerSubmitting}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{
                    flex: 2,
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    cursor: (trailerSubmitting || !!trailerPlateDuplicateWarning || trailerPlateChecking) ? 'not-allowed' : 'pointer',
                    opacity: (trailerSubmitting || !!trailerPlateDuplicateWarning || trailerPlateChecking) ? 0.6 : 1,
                    background: trailerPlateDuplicateWarning ? '#ff4d4f' : undefined,
                    transition: 'all 0.2s ease'
                  }}
                  disabled={trailerSubmitting || !!trailerPlateDuplicateWarning || trailerPlateChecking}
                >
                  {trailerSubmitting
                    ? '送信中...'
                    : trailerPlateDuplicateWarning
                    ? '🚫 重複のため申請できません'
                    : '🚛 登録申請を送信'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBetaAutoFillModal && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
          WebkitBackdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)',
          backdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)', 
          opacity: isBackSwiping ? 1 - backProgress : 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10000, 
          isolation: 'isolate',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          padding: 'calc(24px + var(--safe-top)) calc(24px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(24px + var(--safe-left))',
          transition: isBackSwiping ? 'none' : 'opacity 0.3s ease, backdrop-filter 0.3s ease'
        }}>
          <div 
            className="glass card animate-fade" 
            style={{ 
              width: '100%', 
              maxWidth: isMobile ? 'calc(100% - 32px)' : '480px', 
              padding: isMobile ? '24px 20px' : '36px', 
              borderRadius: isMobile ? '20px' : '24px', 
              textAlign: 'center',
              position: 'relative',
              margin: 'auto 16px',
              transform: isBackSwiping ? `scale(${1 - backProgress * 0.08}) translate3d(0, ${backProgress * 20}px, 0)` : 'none',
              opacity: isBackSwiping ? 1 - backProgress : 1,
              transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
            }}
          >
            {/* Top Close (X) button for easy one-tap dismissal on mobile */}
            <button
              onClick={() => {
                triggerHaptic('light');
                setShowBetaAutoFillModal(false);
              }}
              style={{
                position: 'absolute',
                top: isMobile ? '16px' : '20px',
                right: isMobile ? '16px' : '20px',
                background: 'rgba(255,255,255,0.06)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>

            <h2 style={{ fontSize: isMobile ? '1.35rem' : '1.7rem', fontWeight: 800, marginBottom: '6px' }}>✨ 自動入力 (Beta)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: isMobile ? '20px' : '28px', fontSize: isMobile ? '0.82rem' : '0.9rem', lineHeight: 1.5 }}>
              {formData.game_type === 'rc' 
                ? 'Rensselaer County内のスマホ詳細画面スクショから、' 
                : 'Greenville内のスマホ車両画面スクショから、'}
              <br />
              情報を読み取って自動入力します。
            </p>

            {ocrLoading ? (
              <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative', width: '70px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.5s linear infinite' }} />
                  <RefreshCw size={26} className="animate-spin" style={{ color: 'var(--primary)', opacity: 0.8 }} />
                </div>
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{ocrStatus || '処理を開始しています...'}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{Math.round(ocrProgress * 100)}%</span>
                  </div>
                  <div className="ocr-progress-container">
                    <div className="ocr-progress-bar" style={{ width: `${ocrProgress * 100}%` }} />
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>解析には数秒から数十秒かかる場合があります。しばらくお待ちください。</p>
              </div>
            ) : (
              <div style={{ 
                border: '2px dashed var(--primary)', 
                borderRadius: '16px', 
                padding: isMobile ? '28px 16px' : '36px 20px', 
                position: 'relative', 
                background: isMobile ? 'rgba(0, 193, 102, 0.04)' : 'var(--input-bg)', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: '10px',
                cursor: 'pointer'
              }}>
                <div style={{
                  width: isMobile ? '52px' : '60px',
                  height: isMobile ? '52px' : '60px',
                  borderRadius: '50%',
                  background: 'rgba(0, 193, 102, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--primary)'
                }}>
                  <ImageIcon size={isMobile ? 28 : 34} />
                </div>
                <div style={{ color: 'var(--text-main)', fontWeight: 800, fontSize: isMobile ? '1.02rem' : '1.12rem' }}>
                  {isMobile ? 'ここをタップして画像を選択' : 'ここをクリックして画像を選択'}
                </div>
                <div style={{ fontSize: isMobile ? '0.8rem' : '0.84rem', color: 'var(--text-muted)' }}>
                  {isMobile ? '📸 カメラ撮影 または アルバムから選択' : 'または、スクショ画像をペースト (Ctrl+V) も可能です。'}
                </div>
                {isNative ? (
                  <button
                    type="button"
                    onClick={async () => {
                      triggerHaptic('medium');
                      try {
                        const files = await pickImageFilesNative(1);
                        if (files.length > 0) {
                          handleAutoFillFromImage(files[0]);
                        }
                      } catch (err) {
                        console.error("Native OCR pick failed:", err);
                      }
                    }}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', background: 'transparent' }}
                  />
                ) : (
                  <input 
                    type="file" 
                    accept="image/jpeg, image/png, image/webp, image/*" 
                    onChange={(e) => {
                      triggerHaptic('medium');
                      handleOCRFileSelect(e);
                    }} 
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                  />
                )}
              </div>
            )}

            <div style={{ marginTop: isMobile ? '20px' : '28px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  triggerHaptic('light');
                  setShowBetaAutoFillModal(false);
                }} 
                disabled={ocrLoading}
                style={{ width: '100%', padding: isMobile ? '13px' : '15px', fontSize: '0.95rem', borderRadius: '12px' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.isOpen && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
          WebkitBackdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)',
          backdropFilter: isBackSwiping ? `blur(${6 * (1 - backProgress)}px)` : 'blur(6px)', 
          opacity: isBackSwiping ? 1 - backProgress : 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10100, 
          isolation: 'isolate',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          padding: 'calc(24px + var(--safe-top)) calc(24px + var(--safe-right)) calc(24px + var(--safe-bottom)) calc(24px + var(--safe-left))',
          transition: isBackSwiping ? 'none' : 'opacity 0.3s ease, backdrop-filter 0.3s ease'
        }}>
          <div 
            className="glass card animate-fade" 
            style={{ 
              width: '100%', 
              maxWidth: '520px', 
              padding: '28px', 
              borderRadius: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px',
              transform: isBackSwiping ? `scale(${1 - backProgress * 0.08}) translate3d(0, ${backProgress * 20}px, 0)` : 'none',
              opacity: isBackSwiping ? 1 - backProgress : 1,
              transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: rejectModal.type === 'vehicle_warning' ? '#FFA114' : 'var(--error)' }}>
                {rejectModal.type === 'vehicle_warning' ? '⚠️ 非推奨承認の理由選択' : '❌ 申請却下の理由選択'}
              </h3>
              <button onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-main)', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>クイック選択テンプレート</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                {(rejectModal.type === 'vehicle' ? VEHICLE_REJECT_TEMPLATES : rejectModal.type === 'citizen' ? CITIZEN_REJECT_TEMPLATES : VEHICLE_WARNING_TEMPLATES).map((tpl, i) => (
                  <button 
                    key={i} 
                    type="button"
                    onClick={() => setRejectModal(prev => ({ ...prev, reason: tpl }))}
                    className="btn btn-secondary"
                    style={{ 
                      padding: '10px 12px', 
                      fontSize: '0.85rem', 
                      textAlign: 'left', 
                      justifyContent: 'flex-start',
                      background: rejectModal.reason === tpl ? 'rgba(0, 255, 136, 0.15)' : 'var(--btn-secondary-bg)',
                      border: rejectModal.reason === tpl ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      whiteSpace: 'normal',
                      lineHeight: '1.4',
                      color: 'var(--text-main)'
                    }}
                  >
                    {tpl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                理由の直接入力・微調整 {rejectModal.type === 'vehicle_warning' && <span style={{ color: 'var(--error)' }}>（必須）</span>}
              </label>
              <textarea 
                value={rejectModal.reason}
                onChange={e => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="理由を具体的に入力してください..."
                className="glass"
                style={{ 
                  width: '100%', 
                  height: '100px', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  border: '1px solid var(--glass-border)', 
                  background: 'var(--input-bg)',
                  color: 'var(--text-main)', 
                  fontSize: '0.95rem',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
              <button 
                type="button" 
                onClick={() => setRejectModal(prev => ({ ...prev, isOpen: false }))} 
                className="btn btn-secondary" 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, justifyContent: 'center' }}
              >
                キャンセル
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  if (rejectModal.type === 'vehicle_warning' && !rejectModal.reason.trim()) {
                    alert("非推奨理由は必須です");
                    return;
                  }
                  const { type, targetId, reason } = rejectModal;
                  setRejectModal(prev => ({ ...prev, isOpen: false }));
                  if (type === 'vehicle') {
                    await handleUpdateStatus(targetId!, 'rejected', undefined, reason);
                  } else if (type === 'vehicle_warning') {
                    await handleUpdateStatus(targetId!, 'approved_warning', undefined, reason);
                  } else if (type === 'citizen') {
                    await handleReviewApplication(targetId!, 'rejected', reason);
                  }
                }} 
                className="btn btn-primary" 
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  borderRadius: '12px', 
                  fontSize: '0.95rem', 
                  fontWeight: 600, 
                  justifyContent: 'center',
                  background: rejectModal.type === 'vehicle_warning' ? '#FFA114' : 'var(--error)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: rejectModal.type === 'vehicle_warning' ? '0 4px 12px rgba(255,161,20,0.3)' : '0 4px 12px rgba(255,71,87,0.3)'
                }}
              >
                確定する
              </button>
            </div>
          </div>
        </div>
      )}

      {updateState.isOpen && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'var(--modal-overlay, rgba(10,12,16,0.85))', 
          WebkitBackdropFilter: isBackSwiping ? `blur(${16 * (1 - backProgress)}px)` : 'blur(16px)',
          backdropFilter: isBackSwiping ? `blur(${16 * (1 - backProgress)}px)` : 'blur(16px)', 
          opacity: isBackSwiping ? 1 - backProgress : 1,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 10200, 
          isolation: 'isolate',
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          padding: '24px',
          transition: isBackSwiping ? 'none' : 'opacity 0.3s ease, backdrop-filter 0.3s ease'
        }}>
          <div 
            className="glass card animate-fade" 
            style={{ 
              width: '100%', 
              maxWidth: '480px', 
              padding: '32px', 
              borderRadius: '24px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '24px', 
              background: 'var(--panel-bg)', 
              border: '1px solid var(--glass-border)', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              transform: isBackSwiping ? `scale(${1 - backProgress * 0.08}) translate3d(0, ${backProgress * 20}px, 0)` : 'none',
              opacity: isBackSwiping ? 1 - backProgress : 1,
              transition: isBackSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', background: 'rgba(0,193,102,0.15)', borderRadius: '16px', marginBottom: '16px' }}>
                <RefreshCw size={28} className={updateState.status === 'downloading' ? 'animate-spin' : ''} style={{ color: 'var(--primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px 0' }}>新しいバージョンが利用可能です</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>最新バージョン v{updateState.latestVersion} がリリースされました。</p>
            </div>

            {updateState.notes && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px', maxHeight: '120px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px' }}>更新内容:</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{updateState.notes}</div>
              </div>
            )}

            {updateState.status === 'downloading' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <span>アップデートファイルをダウンロード中...</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{updateState.downloadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${updateState.downloadProgress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary) 0%, #00ff88 100%)', borderRadius: '4px', transition: 'width 0.1s ease-out' }} />
                </div>
              </div>
            ) : updateState.status === 'error' ? (
              <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', color: '#ef4444', fontSize: '0.85rem', lineHeight: 1.5 }}>
                ダウンロード中にエラーが発生しました。<br />
                詳細: {updateState.errorMsg || '不明な通信エラー'}
              </div>
            ) : updateState.status === 'success' ? (
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#10b981', fontSize: '0.85rem', lineHeight: 1.5, textAlign: 'center' }}>
                ダウンロードが完了しました！インストーラーが起動します。
              </div>
            ) : updateState.status === 'background_started' ? (
              <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', color: '#10b981', fontSize: '0.85rem', lineHeight: 1.5, textAlign: 'center' }}>
                バックグラウンドでダウンロードを開始しました。<br />通知領域で進捗を確認できます。
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              {updateState.status !== 'downloading' && updateState.status !== 'success' && updateState.status !== 'background_started' && (
                <button
                  type="button"
                  onClick={() => {
                    setUpdateState(prev => ({ ...prev, isOpen: false }));
                    triggerHaptic('light');
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, justifyContent: 'center' }}
                >
                  今はしない
                </button>
              )}
              {updateState.status !== 'success' && updateState.status !== 'background_started' && (
                <button
                  type="button"
                  disabled={updateState.status === 'downloading'}
                  onClick={handlePerformUpdate}
                  className="btn btn-primary"
                  style={{ flex: 1.5, padding: '14px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, justifyContent: 'center', opacity: updateState.status === 'downloading' ? 0.7 : 1 }}
                >
                  {updateState.status === 'downloading' ? 'ダウンロード中...' : updateState.status === 'error' ? '再試行する' : '今すぐ更新する'}
                </button>
              )}
              {updateState.status === 'background_started' && (
                <button
                  type="button"
                  onClick={() => {
                    setUpdateState(prev => ({ ...prev, isOpen: false }));
                    triggerHaptic('light');
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '14px', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 600, justifyContent: 'center' }}
                >
                  閉じる
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== Info / Notice Modal (update status, errors) ====== */}
      {infoModal.isOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', WebkitBackdropFilter: 'blur(20px)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10300, isolation: 'isolate', WebkitTransform: 'translateZ(0)', transform: 'translateZ(0)', padding: '24px' }}
          onClick={() => { setInfoModal(prev => ({ ...prev, isOpen: false })); triggerHaptic('light'); }}
        >
          <div
            className="glass card animate-fade"
            style={{ width: '100%', maxWidth: '360px', padding: '32px 28px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', textAlign: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {infoModal.type === 'success' ? (
                <CheckCircle2 size={64} style={{ color: 'var(--success)' }} />
              ) : infoModal.type === 'error' ? (
                <XCircle size={64} style={{ color: 'var(--error)' }} />
              ) : (
                <Info size={64} style={{ color: 'var(--text-muted)' }} />
              )}
            </div>

            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{
                fontSize: '1.25rem', fontWeight: 700, margin: 0,
                color: infoModal.type === 'success' ? 'var(--primary)' : infoModal.type === 'error' ? 'var(--error)' : 'var(--secondary)'
              }}>{infoModal.title}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {infoModal.message}
              </p>
            </div>

            {/* Close button */}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setInfoModal(prev => ({ ...prev, isOpen: false })); triggerHaptic('light'); }}
              style={{ width: '100%', padding: '14px', borderRadius: '14px', fontSize: '1rem', fontWeight: 700, justifyContent: 'center', marginTop: '4px',
                background: infoModal.type === 'success'
                  ? 'var(--primary)'
                  : infoModal.type === 'error'
                    ? 'linear-gradient(135deg, var(--error) 0%, #cc2233 100%)'
                    : 'linear-gradient(135deg, var(--secondary) 0%, #0099bb 100%)',
                boxShadow: infoModal.type === 'success' ? '0 4px 16px rgba(0,255,136,0.3)' : infoModal.type === 'error' ? '0 4px 16px rgba(255,71,87,0.3)' : '0 4px 16px rgba(0,212,255,0.3)',
                border: 'none', color: '#fff'
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {/* ====== Wiki Sync Loading Overlay ====== */}
      {wikiSyncProgress !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--modal-overlay, rgba(10,12,16,0.85))',
            backdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 4000,
            padding: '24px'
          }}
        >
          <div
            className="glass card animate-fade"
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '40px 32px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '24px',
              background: 'var(--panel-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              textAlign: 'center'
            }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <RefreshCw size={56} className="animate-spin" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Wiki カタログ同期中
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                Wikiから最新の車両・トリム・カラーデータを自動抽出しています。これには数十秒かかる場合があります。ブラウザを閉じずにお待ちください。
              </p>
            </div>
            <div
              style={{
                width: '100%',
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid var(--glass-border)',
                fontSize: '0.9rem',
                color: 'var(--primary)',
                fontWeight: 600,
                wordBreak: 'break-all'
              }}
            >
              {wikiSyncProgress}
            </div>
          </div>
        </div>
      )}

      </div>

      {/* ====== Notifications Center Dropdown ====== */}
      {showNotifications && (
        <>
          <div 
            onClick={() => setShowNotifications(false)} 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 4998,
              background: 'transparent'
            }} 
          />
          
          <div 
            className="glass card animate-fade"
            style={{
              position: 'fixed',
              top: isMobile ? 'calc(65px + var(--safe-top))' : 'auto',
              bottom: isMobile ? 'auto' : '100px',
              left: isMobile ? '16px' : (sidebarCollapsed ? '100px' : '280px'),
              right: isMobile ? '16px' : 'auto',
              width: isMobile ? 'calc(100% - 32px)' : '340px',
              maxHeight: '480px',
              zIndex: 4999,
              background: 'var(--panel-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              backdropFilter: 'blur(30px)'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '1rem' }}>通知センター</span>
                {unreadCount > 0 && (
                  <span style={{ fontSize: '0.75rem', background: 'var(--primary)', padding: '2px 8px', borderRadius: '20px', color: '#000', fontWeight: 700 }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllNotificationsAsRead}
                    style={{ background: 'transparent', border: 'none', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', padding: '4px 8px' }}
                  >
                    すべて既読
                  </button>
                )}
                <button 
                  onClick={() => setShowNotifications(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', maxHeight: '400px' }}>
              {notifications.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', border: '1px dashed var(--glass-border)' }}>
                    <Bell size={24} style={{ opacity: 0.4 }} />
                  </div>
                  <span style={{ fontSize: '0.9rem' }}>通知はありません</span>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = notif.is_read === 0;
                  return (
                    <div 
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'flex-start',
                        background: isUnread ? 'rgba(255, 165, 0, 0.04)' : 'transparent',
                        borderLeft: isUnread ? '4px solid var(--primary)' : '4px solid transparent',
                        transition: '0.2s',
                      }}
                      className="notif-item"
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: getNotificationIconBg(notif.type),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        flexShrink: 0
                      }}>
                        {getNotificationIcon(notif.type)}
                      </div>
                      
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: isUnread ? 800 : 700, color: 'var(--text-main)', lineHeight: 1.3 }}>
                              {notif.title}
                            </span>
                            {notif.is_read === 1 && notif.type && (notif.type.includes('admin') || notif.title.includes('申請')) && (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                対応済み
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {formatTimeAgo(notif.created_at)}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {notif.body}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}

      {/* App-wide sliding glassmorphic Toast notification */}
      {inAppToast && (
        <div 
          onClick={() => {
            if (inAppToast.action) inAppToast.action();
            setInAppToast(null);
          }}
          className="glass card"
          style={{
            position: 'fixed',
            top: 'calc(16px + var(--safe-top))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '400px',
            padding: '16px 20px',
            background: 'rgba(10, 12, 16, 0.85)',
            border: '1px solid var(--glass-border)',
            borderLeft: inAppToast.type === 'success' ? '4px solid #2d6a4f' :
                        inAppToast.type === 'warning' ? '4px solid #ffb142' :
                        inAppToast.type === 'error' ? '4px solid #ff5252' :
                        '4px solid #00d2fc',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            borderRadius: '16px',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
            animation: 'toastSlideDown 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: inAppToast.type === 'success' ? 'rgba(0,193,102,0.12)' :
                        inAppToast.type === 'warning' ? 'rgba(255,177,66,0.12)' :
                        inAppToast.type === 'error' ? 'rgba(255,82,82,0.12)' :
                        'rgba(0,210,252,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: inAppToast.type === 'success' ? '#2d6a4f' :
                   inAppToast.type === 'warning' ? '#ffb142' :
                   inAppToast.type === 'error' ? '#ff5252' :
                   '#00d2fc',
            flexShrink: 0
          }}>
            {inAppToast.type === 'success' ? <CheckCircle2 size={20} /> :
             inAppToast.type === 'warning' ? <AlertTriangle size={20} /> :
             inAppToast.type === 'error' ? <XCircle size={20} /> :
             <Info size={20} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inAppToast.title}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>{inAppToast.desc}</div>
          </div>
          <div style={{ fontSize: '0.75rem', color: inAppToast.type === 'success' ? '#2d6a4f' :
                                                      inAppToast.type === 'warning' ? '#ffb142' :
                                                      inAppToast.type === 'error' ? '#ff5252' :
                                                      '#00d2fc', fontWeight: 700, flexShrink: 0 }}>
            {inAppToast.action ? '表示' : '閉じる'}
          </div>
        </div>
      )}

      {/* Global CSS animations style block for sliding toast */}
      <style>{`
        @keyframes toastSlideDown {
          0% {
            transform: translate(-50%, -100px);
            opacity: 0;
          }
          100% {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Back Gesture Debug Overlay */}
      {isBackSwiping && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          background: 'rgba(0,0,0,0.85)',
          color: 'var(--primary)',
          padding: '12px 18px',
          borderRadius: '12px',
          fontSize: '0.8rem',
          fontWeight: 700,
          zIndex: 999999,
          border: '1px solid var(--primary)',
          boxShadow: '0 4px 20px rgba(0,193,102,0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          pointerEvents: 'none'
        }}>
          <div>🔄 BACK SWIPING ACTIVE</div>
          <div>Progress: {backProgress.toFixed(3)}</div>
        </div>
      )}

      {/* Quick Action Bottom Sheet (Apple iOS Action Sheet Style) */}
      {showQuickActionSheet && (
        <div className="mobile-action-menu-overlay" onClick={() => setShowQuickActionSheet(false)}>
          <div className="mobile-action-sheet-container" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-action-group">
              <div className="mobile-action-header">
                <h4>{view === 'garage' ? 'ガレージアクション' : '新規登録・投稿'}</h4>
                <p>{view === 'garage' ? '登録方法を選択してください' : '行いたい操作を選択してください'}</p>
              </div>

              {view === 'garage' ? (
                <>
                  <button className="mobile-action-button" onClick={() => {
                    triggerHaptic('light');
                    setShowQuickActionSheet(false);
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setFormData({ game_type: 'gv', maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                    setEditingVehicleId(null);
                    setShowAddModal(true);
                  }}>
                    <Car size={20} />
                    車両を手動で登録申請
                  </button>

                  <button className="mobile-action-button" onClick={() => {
                    triggerHaptic('light');
                    setShowQuickActionSheet(false);
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setFormData(prev => ({ ...prev, game_type: 'gv' }));
                    setShowBetaAutoFillModal(true);
                  }}>
                    <ImageIcon size={20} />
                    画像から自動入力 (Beta)
                  </button>
                  
                  <button className="mobile-action-button" onClick={() => {
                    triggerHaptic('light');
                    setShowQuickActionSheet(false);
                    if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                    setTrailerFormData({ game_type: 'gv', model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
                    setEditingVehicleId(null);
                    setShowTrailerModal(true);
                  }}>
                    🚛 トレーラーを追加申請
                  </button>
                </>
              ) : (
                <>
                  <button className="mobile-action-button" onClick={() => {
                    triggerHaptic('light');
                    setShowQuickActionSheet(false);
                    setView('garage');
                    setTimeout(() => {
                      if (!currentUser.roblox_username) { alert("ユーザー名を設定してください"); setView('profile'); return; }
                      setFormData({ game_type: 'gv', maker: '', model: '', year: 2024, trim: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username, image_data: '' });
                      setEditingVehicleId(null);
                      setShowAddModal(true);
                    }, 150);
                  }}>
                    <Car size={20} />
                    車両を登録申請する
                  </button>
                  
                  <button className="mobile-action-button" onClick={() => {
                    triggerHaptic('light');
                    setShowQuickActionSheet(false);
                    setView('timeline');
                    setTimeout(() => {
                      setTriggerTimelineComposer(true);
                    }, 150);
                  }}>
                    <MessageSquare size={20} />
                    タイムラインに投稿する
                  </button>
                </>
              )}
            </div>

            <button className="mobile-action-cancel-card" onClick={() => { triggerHaptic('light'); setShowQuickActionSheet(false); }}>
              キャンセル
            </button>
          </div>
        </div>
      )}

    </div>
  </div>
  );
}
