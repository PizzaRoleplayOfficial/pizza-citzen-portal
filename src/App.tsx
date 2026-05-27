import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import Tesseract from 'tesseract.js';
import { LandingView } from './views/LandingView';
import { ApplicationFormView } from './views/ApplicationFormView';
import { MyGarageView } from './views/MyGarageView';
import { ProfileView } from './views/ProfileView';
import { AdminDashboardView } from './views/AdminDashboardView';
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
  Info
} from 'lucide-react';
import { isNative } from './utils/native';
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

import { StatusBadge, parseImages } from './components/UIBase';
import { compressImage } from './utils/helpers';
import { useIsMobile } from './hooks/useIsMobile';
import { ImageLightbox } from './components/ImageLightbox';
import { VehicleImageGallery } from './components/VehicleImageGallery';
import { formatDate } from './utils/helpers';
import { triggerHaptic, scheduleLocalNotification, requestNotificationPermission, startBackgroundPoll, stopBackgroundPoll, updateBackgroundPollCache, registerPushNotifications, unregisterPushNotifications } from './utils/native';
import { Capacitor } from '@capacitor/core';
import { handleAvatarError } from './utils/avatarFallback';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { StatusBar, Style } from '@capacitor/status-bar';

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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [pushSettings, setPushSettings] = useState({
    resultsEnabled: localStorage.getItem('gvvr_push_results') !== 'false',
    adminEnabled: localStorage.getItem('gvvr_push_admin') !== 'false'
  });
  const [theme, setTheme] = useState<'dark'|'light'>(
    (localStorage.getItem('gvvr_theme') as 'dark'|'light') || 'dark'
  );
  const getInitialHashState = () => {
    const hash = window.location.hash.replace('#', '');
    const parts = hash.split('/');
    const mainView = parts[0];
    const subTab = parts[1];
    const validViews = ['home', 'intro', 'garage', 'admin', 'profile', 'apply'];
    const validSubTabs = ['dashboard', 'vehicles', 'users', 'lookup', 'applications', 'questions', 'catalog'];
    
    return {
      view: (validViews.includes(mainView) ? mainView : 'home') as 'home' | 'intro' | 'garage' | 'admin' | 'profile' | 'apply',
      adminTab: (mainView === 'admin' && subTab && validSubTabs.includes(subTab) ? subTab : null) as any
    };
  };

  const initialParsed = getInitialHashState();
  const [view, setView] = useState<'home' | 'intro' | 'garage' | 'admin' | 'profile' | 'apply'>(initialParsed.view);

  const [adminTab, setAdminTab] = useState<'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog'>(
    initialParsed.adminTab || (sessionStorage.getItem('gvvr_adminTab') as any) || 'dashboard'
  );
  const setAdminTabPersist = (tab: 'dashboard' | 'vehicles' | 'users' | 'lookup' | 'applications' | 'questions' | 'catalog') => {
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
      }, 2900);

      return () => {
        clearTimeout(hapticTimer);
        clearTimeout(fadeTimer);
        clearTimeout(unmountTimer);
      };
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
    // ページ切り替え時に振動を発生させる（初回起動時のローディング中はスキップ）
    if (!isLoading) {
      triggerHaptic('light');
    }
  }, [view, adminTab, isLoading]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const parts = hash.split('/');
      const mainView = parts[0];
      const subTab = parts[1];
      const validViews = ['home', 'intro', 'garage', 'admin', 'profile', 'apply'];
      const validSubTabs = ['dashboard', 'vehicles', 'users', 'lookup', 'applications', 'questions', 'catalog'];
      
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

  const handleSubmitTrailer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trailerSubmitting) return;
    if (!trailerFormData.model || !trailerFormData.plate) {
      alert('モデル名とナンバープレートは必須です。');
      triggerHaptic('warning');
      return;
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
        alert(err.error || '登録に失敗しました。');
        triggerHaptic('error');
        return;
      }
      setShowTrailerModal(false);
      setEditingVehicleId(null);
      setTrailerFormData({ game_type: 'gv', model: '', maker: '', trailer_type: '', color: '', plate: '', plate_region: 'WISCONSIN', roblox_username: currentUser.roblox_username || '', image_data: '' });
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
        if (data?.trims && data.trims.length > 0) setWikiTrims(data.trims);
        if (data?.colors && data.colors.length > 0) setWikiColors(data.colors);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setWikiLoading(false); });
    return () => { cancelled = true; };
  }, [formData.maker, formData.model, formData.year, formData.trim, formData.game_type, showAddModal]);

  const fetchVehicles = async () => {
    setIsLoading(true);
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
              scheduleLocalNotification(title, body, 0, 'admin_notifications_channel');
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
              if (oldStatus === 'pending' && (v.status === 'approved' || v.status === 'rejected')) {
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
        }
        updateBackgroundPollCache(list);
      }
    } catch (e) {
      console.error("Fetch vehicles failed:", e);
    } finally {
      setIsLoading(false);
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

  const fetchApplication = async () => {
    try {
      const res = await fetch('/api/applications');
      if (res.ok) {
        const app = await res.json();
        if (app && app.status) {
          const cachedStatus = localStorage.getItem(`gvvr_citizen_app_status_${currentUser.id}`);
          if (cachedStatus !== null) {
            if (cachedStatus === 'pending' && (app.status === 'approved' || app.status === 'rejected')) {
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
        } else {
          localStorage.setItem(`gvvr_citizen_app_status_${currentUser.id}`, 'none');
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
    
    // Load external vehicle catalog
    loadCatalog('gv');
  }, []);

  // ログイン状態に応じてバックグラウンドポーリングを開始・停止、およびFCMリアルタイムプッシュ通知の登録・解除 (v1.9.10)
  useEffect(() => {
    if (isLoggedIn && currentUser && currentUser.id) {
      startBackgroundPoll(
        currentUser.id,
        currentUser.role || 'user',
        window.location.origin
      );
      registerPushNotifications(currentUser.id, handlePushNotificationAction);
    } else if (!isLoggedIn && !isLoading) {
      stopBackgroundPoll();
      if (currentUser && currentUser.id) {
        unregisterPushNotifications(currentUser.id);
      }
    }
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

  // Androidの物理戻るボタン / システム戻るジェスチャーの制御
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const backHandler = CapApp.addListener('backButton', (data) => {
        const isAnyModalOpen = showAddModal || showTrailerModal || showBetaAutoFillModal || rejectModal.isOpen || updateState.isOpen;
        if (isAnyModalOpen) {
          // モーダルが開いている場合は履歴を戻ってモーダルを閉じる
          window.history.back();
        } else if (view === 'admin' && adminTab !== 'dashboard') {
          // 管理パネルでサブメニューを開いている場合は、履歴を戻る（ダッシュボードトップに戻る）
          window.history.back();
        } else if (view !== 'home') {
          // それ以外のホーム以外の画面なら履歴を戻る
          window.history.back();
        } else {
          // ホーム画面かつモーダルなしの場合はアプリを終了する
          CapApp.exitApp();
        }
      });
      return () => {
        backHandler.then(h => h.remove());
      };
    }
  }, [view, adminTab, showAddModal, showTrailerModal, showBetaAutoFillModal, rejectModal.isOpen, updateState.isOpen]);

  const handleManualRefresh = () => {
    if (!isLoggedIn) return;
    setIsLoading(true);
    fetchVehicles();
    fetchApplication();
    fetchQuestions();
    if (view === 'admin') {
      fetchUsers();
      fetchAllApplications();
      fetchQuestions(true);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    const refreshData = () => {
      fetchVehicles();
      fetchApplication();
      fetchQuestions();
      if (view === 'admin') {
        fetchUsers();
        fetchAllApplications();
        fetchQuestions(true);
      }
    };

    refreshData();

    // 30 Seconds background polling
    const intervalId = setInterval(() => {
      refreshData();
    }, 30000);

    return () => clearInterval(intervalId);
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
        const base64Images = await Promise.all(files.map(compressImage));
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
        fetchVehicles();
        if (view === 'admin') fetchAllApplications(); // Refresh related data
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
      if (res.ok) fetchVehicles();
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
      const base64Images = await Promise.all(files.map(compressImage));
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

  const handleTogglePushSetting = (key: 'resultsEnabled' | 'adminEnabled', enabled: boolean) => {
    const newSettings = { ...pushSettings, [key]: enabled };
    setPushSettings(newSettings);
    localStorage.setItem(`gvvr_push_${key === 'resultsEnabled' ? 'results' : 'admin'}`, String(enabled));
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
        }, 4000);
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

      const origin = window.location.origin;
      const tesseractOptions: any = isNative ? {
        // スマホアプリ（ネイティブ）環境では、WebViewのローカルリソース制約・Web Worker内のオリジン制限（blob: スキームからのアクセスブロック）を回避するため、
        // 信頼性の高い公式の高速外部CDNを使用して100%安定してOCRを初期化させます。
        logger: m => {
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
                statusText = `文字を認識中: ${Math.round(m.progress * 100)}%`;
                break;
              default:
                statusText = m.status;
                break;
            }
            setOcrStatus(statusText);
            setOcrProgress(0.1 + m.progress * 0.9);
          }
        }
      } : {
        // Web環境では、パフォーマンス向上のためローカルホストの静的アセットを使用します。
        workerPath: `${origin}/tesseract/worker.min.js`,
        corePath: `${origin}/tesseract/tesseract-core.js`,
        langPath: `${origin}/tesseract/langs`,
        workerBlobURL: false,
        logger: m => {
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
                statusText = `文字を認識中: ${Math.round(m.progress * 100)}%`;
                break;
              default:
                statusText = m.status;
                break;
            }
            setOcrStatus(statusText);
            setOcrProgress(0.1 + m.progress * 0.9);
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
  }, [showBetaAutoFillModal]);  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
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
        alert(err.error || '車両登録に失敗しました。');
        triggerHaptic('error');
      }
    } catch (e) {
      console.error("Submit vehicle failed:", e);
      triggerHaptic('error');
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
    try {
      // 1. Crawl Wiki in the client
      const newCatalog = await fetchWikiCatalog(gameType, (progressMsg) => {
        setWikiSyncProgress(progressMsg);
      });
      
      // 2. Save Catalog to DB
      setWikiSyncProgress("データベースに同期・保存中...");
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
        <main className="container" style={{ padding: '60px 40px', maxWidth: '1400px', flex: 1 }}>
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


  if (!isLoggedIn) return <LandingView />;

  return (
    <div className="app-layout" style={{ background: 'var(--bg-dark)', minHeight: '100vh', paddingBottom: isMobile ? '70px' : '0' }}>
      {!isMobile && (
        <nav className="main-nav">
        <div className="nav-logo" onClick={() => setView('home')} style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/pizza.webp" alt="Logo" style={{ width: '30px', height: '30px', marginRight: '8px', objectFit: 'cover', borderRadius: '50%' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 800 }}>ぴっざぁポータル</span>
          </div>
          
          <div className="nav-tabs-wrapper">
            <div className="nav-tabs">
              <button className={`btn nav-btn ${view === 'home' || view === 'intro' ? 'active' : ''}`} onClick={() => setView('home')}>
                <Home size={18} /> ホーム
              </button>
              <button className={`btn nav-btn ${view === 'apply' ? 'active' : ''}`} onClick={() => setView('apply')} style={{ position: 'relative' }}>
                <ClipboardList size={18} /> 市民申請
                {(!myApplication || myApplication.status === 'rejected') && (
                  <span style={{ position: 'absolute', top: '6px', right: '6px', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }} />
                )}
              </button>
              <button className={`btn nav-btn ${view === 'garage' ? 'active' : ''}`} onClick={() => setView('garage')}>
                <LayoutDashboard size={18} /> ガレージ
              </button>
              {currentUser.role === 'admin' && (
                <button className={`btn nav-btn ${view === 'admin' ? 'active' : ''}`} onClick={() => setView('admin')}>
                  <ShieldCheck size={18} /> 管理パネル
                </button>
              )}
              <button className={`btn nav-btn ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>
                <UserIcon size={18} /> 設定
              </button>
            </div>
          </div>

          <div className="nav-right">
            <div className="nav-user-info">
              <div className="nav-username">{currentUser.username}</div>
              <div className="nav-userrole">{currentUser.role === 'admin' ? '運営メンバー' : '一般メンバー'}</div>
            </div>
            <img src={currentUser.avatar} alt="u" onError={(e) => handleAvatarError(e, currentUser.username)} style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff', objectFit: 'cover' }} />
            <a href="/api/auth/logout" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)', transition: '0.2s' }}>
              <LogOut size={18} />
            </a>
          </div>
        </nav>
      )}

      {isMobile && (
        <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--nav-bg)', paddingTop: 'calc(16px + env(safe-area-inset-top))', paddingBottom: '16px', paddingLeft: '16px', paddingRight: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)' }}>
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
            <img src={currentUser.avatar} alt="u" onError={(e) => handleAvatarError(e, currentUser.username)} style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fff', objectFit: 'cover' }} />
            <a href="/api/auth/logout" style={{ color: 'var(--text-muted)' }}><LogOut size={20} /></a>
          </div>
        </div>
      )}

      <main className="container" style={{ padding: isMobile ? '30px 16px' : '60px 40px', maxWidth: '1400px' }}>
        {view === 'home' ? (
          <div className="animate-fade" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '40px' }}>
            
            {/* デジタルIDカード (市民証) */}
            <div style={{
              position: 'relative',
              borderRadius: '24px',
              padding: isMobile ? '24px' : '36px',
              background: theme === 'light'
                ? (myApplication?.status === 'approved'
                  ? 'linear-gradient(135deg, #eefcf5 0%, #ffffff 100%)'
                  : myApplication?.status === 'pending'
                  ? 'linear-gradient(135deg, #fffcf5 0%, #ffffff 100%)'
                  : 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)')
                : (myApplication?.status === 'approved'
                  ? 'linear-gradient(135deg, #0a2115 0%, #060a0f 100%)'
                  : myApplication?.status === 'pending'
                  ? 'linear-gradient(135deg, #241c0a 0%, #060a0f 100%)'
                  : 'linear-gradient(135deg, #181a1c 0%, #060a0f 100%)'),
              border: `1px solid ${
                myApplication?.status === 'approved'
                  ? (theme === 'light' ? 'rgba(0, 193, 102, 0.3)' : 'rgba(0, 193, 102, 0.25)')
                  : myApplication?.status === 'pending'
                  ? (theme === 'light' ? 'rgba(255, 177, 66, 0.3)' : 'rgba(255, 177, 66, 0.25)')
                  : 'var(--glass-border)'
              }`,
              boxShadow: myApplication?.status === 'approved'
                ? (theme === 'light'
                  ? '0 12px 30px rgba(0, 193, 102, 0.08), inset 0 1px 2px rgba(255,255,255,0.6)'
                  : '0 12px 40px rgba(0, 193, 102, 0.15), inset 0 1px 2px rgba(255,255,255,0.05)')
                : (theme === 'light' ? '0 12px 30px rgba(0,0,0,0.05)' : '0 12px 40px rgba(0,0,0,0.3)'),
              overflow: 'hidden',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              gap: '32px',
              alignItems: 'center'
            }}>

              {/* 装飾ネオンバー */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '4px',
                background: myApplication?.status === 'approved'
                  ? 'linear-gradient(90deg, #00c166, #00d2fc)'
                  : myApplication?.status === 'pending'
                  ? 'linear-gradient(90deg, #ffb142, #ff7b00)'
                  : 'linear-gradient(90deg, #666, #333)'
              }} />

              {/* 左側: アバターとステータスバッジ */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
                <div style={{ position: 'relative' }}>
                  <img
                    src={currentUser.avatar}
                    alt="Avatar"
                    onError={(e) => handleAvatarError(e, currentUser.username)}
                    style={{
                      width: '100px',
                      height: '100px',
                      borderRadius: '20px',
                      border: `3px solid ${
                        myApplication?.status === 'approved'
                          ? 'var(--primary)'
                          : myApplication?.status === 'pending'
                          ? '#ffb142'
                          : (theme === 'light' ? 'var(--glass-border)' : '#444')
                      }`,
                      objectFit: 'cover',
                      boxShadow: theme === 'light' ? '0 4px 12px rgba(0,0,0,0.08)' : '0 8px 24px rgba(0,0,0,0.3)'
                    }}
                  />
                  {myApplication?.status === 'approved' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '-6px',
                      right: '-6px',
                      background: 'var(--primary)',
                      color: theme === 'light' ? '#fff' : '#000',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}>✓</span>
                  )}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '6px 12px',
                  borderRadius: '20px',
                  background: myApplication?.status === 'approved'
                    ? 'rgba(0, 193, 102, 0.15)'
                    : myApplication?.status === 'pending'
                    ? 'rgba(255, 177, 66, 0.15)'
                    : (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'),
                  color: myApplication?.status === 'approved'
                    ? 'var(--primary)'
                    : myApplication?.status === 'pending'
                    ? '#ffb142'
                    : 'var(--text-muted)',
                  border: `1px solid ${
                    myApplication?.status === 'approved'
                      ? 'rgba(0, 193, 102, 0.2)'
                      : myApplication?.status === 'pending'
                      ? 'rgba(255, 177, 66, 0.2)'
                      : (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)')
                  }`,
                  letterSpacing: '0.05em'
                }}>
                  {myApplication?.status === 'approved' ? 'OFFICIAL CITIZEN' : myApplication?.status === 'pending' ? 'UNDER REVIEW' : 'UNREGISTERED'}
                </div>
              </div>

              {/* 右側: 情報グリッド */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', textAlign: isMobile ? 'center' : 'left' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: theme === 'light' ? 'var(--text-muted)' : 'rgba(255,255,255,0.6)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Roblox Citizen Identifier</span>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: theme === 'light' ? 'var(--text-main)' : '#ffffff', margin: 0, letterSpacing: '0.02em' }}>{currentUser.roblox_username || currentUser.username}</h2>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', borderTop: theme === 'light' ? '1px solid var(--border)' : '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: theme === 'light' ? 'var(--text-muted)' : 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>ROLE</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: currentUser.role === 'admin' ? (theme === 'light' ? 'var(--secondary)' : '#00d2fc') : (theme === 'light' ? 'var(--text-main)' : '#ffffff') }}>
                      {currentUser.role === 'admin' ? '運営メンバー' : '一般メンバー'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: theme === 'light' ? 'var(--text-muted)' : 'rgba(255,255,255,0.5)', display: 'block', marginBottom: '4px' }}>STATUS</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: myApplication?.status === 'approved' ? 'var(--primary)' : myApplication?.status === 'rejected' ? 'var(--error)' : (theme === 'light' ? 'var(--text-muted)' : 'rgba(255,255,255,0.5)') }}>
                      {myApplication?.status === 'approved' ? '認可済み' : myApplication?.status === 'pending' ? '審査中' : myApplication?.status === 'rejected' ? '却下' : '未登録'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* クイックメニューセクション */}
            <div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '4px', height: '18px', background: 'var(--primary)', borderRadius: '2px', display: 'inline-block' }} />
                証明書・メニュー
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                
                <button className="glass card" onClick={() => setView('intro')} style={{ textAlign: 'left', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--panel-bg)', borderRadius: '20px', transition: 'transform 0.2s, border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>🔰 解説・ルール</div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(0,193,102,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={22} style={{ color: 'var(--primary)' }} />
                  </div>
                </button>

                <button className="glass card" onClick={() => setView('apply')} style={{ textAlign: 'left', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--panel-bg)', borderRadius: '20px', transition: 'transform 0.2s, border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>🪪 市民申請</div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ width: '48px', height: '48px', background: myApplication?.status === 'approved' ? 'rgba(0,193,102,0.15)' : (theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)'), borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {myApplication?.status === 'approved' ? <CheckCircle2 size={22} style={{ color: 'var(--primary)' }} /> : <Clock size={22} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </button>

                <button className="glass card" onClick={() => setView('garage')} style={{ textAlign: 'left', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--panel-bg)', borderRadius: '20px', transition: 'transform 0.2s, border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>🚗 ガレージ</div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ width: '48px', height: '48px', background: 'rgba(0,160,204,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Car size={22} style={{ color: 'var(--secondary)' }} />
                  </div>
                </button>

                {currentUser.role === 'admin' && (
                  <button className="glass card" onClick={() => setView('admin')} style={{ textAlign: 'left', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--panel-bg)', borderRadius: '20px', transition: 'transform 0.2s, border-color 0.2s' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>🛡️ 管理パネル</div>
                      <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <div style={{ width: '48px', height: '48px', background: 'rgba(255,177,66,0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={22} style={{ color: '#ffb142' }} />
                    </div>
                  </button>
                )}

                <button className="glass card" onClick={() => setView('profile')} style={{ textAlign: 'left', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'pointer', border: '1px solid var(--glass-border)', background: 'var(--panel-bg)', borderRadius: '20px', transition: 'transform 0.2s, border-color 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>⚙️ 設定</div>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ width: '48px', height: '48px', background: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <UserIcon size={22} style={{ color: 'var(--text-main)' }} />
                  </div>
                </button>

              </div>
            </div>
          </div>
        ) : view === 'intro' ? (
          <div className="animate-fade" style={{ maxWidth: '800px', margin: '0 auto', color: 'var(--text-main)' }}>
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
          />
        ) : (
          <AdminDashboardView
            adminTab={adminTab}
            setAdminTabPersist={setAdminTabPersist}
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
        <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--nav-bg)', backdropFilter: 'blur(10px)', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-around', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 1000 }}>
          <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', color: (view === 'home' || view === 'intro') ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <Home size={24} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>ホーム</span>
          </button>
          <button onClick={() => setView('apply')} style={{ background: 'none', border: 'none', color: view === 'apply' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, padding: '4px 0', position: 'relative', cursor: 'pointer' }}>
            <ClipboardList size={24} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>市民申請</span>
            {(!myApplication || myApplication.status === 'rejected') && <span style={{ position: 'absolute', top: 0, right: 'calc(50% - 16px)', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--error)' }} />}
          </button>
          <button onClick={() => setView('garage')} style={{ background: 'none', border: 'none', color: view === 'garage' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <LayoutDashboard size={24} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>ガレージ</span>
          </button>
          {currentUser.role === 'admin' && (
            <button onClick={() => setView('admin')} style={{ background: 'none', border: 'none', color: view === 'admin' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
              <ShieldCheck size={24} />
              <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>管理パネル</span>
            </button>
          )}
          <button onClick={() => setView('profile')} style={{ background: 'none', border: 'none', color: view === 'profile' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1, padding: '4px 0', cursor: 'pointer' }}>
            <UserIcon size={24} />
            <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>設定</span>
          </button>
        </nav>
      )}

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div className="glass card animate-fade" style={{ width: '100%', maxWidth: '680px', padding: isMobile ? '20px' : '40px', borderRadius: '24px', maxHeight: '90vh', overflowY: 'auto' }}>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>{editingVehicleId ? '車両情報の修正' : '新規車両の登録'}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>必要な情報を入力してください。</p>
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
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number</label>
                 <input type="text" placeholder="例: ABC-1234" value={formData.plate} onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, background: 'var(--input-bg)' }} />
              </div>

              <div>
                 <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                   Vehicle Images (最大4枚)
                 </label>
                 <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px', alignItems: 'center' }}>
                   {parseImages(formData.image_data).map((imgUrl, i) => (
                     <div key={i} style={{ width: '120px', height: '120px', flexShrink: 0, borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', position: 'relative', overflow: 'hidden' }}>
                       <img src={imgUrl} alt={`preview ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                       <button type="button" onClick={() => handleRemoveImage(i)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: 'var(--text-main)', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>&times;</button>
                     </div>
                   ))}
                   {parseImages(formData.image_data).length < 4 && (
                     <div style={{ width: '120px', height: '120px', flexShrink: 0, borderRadius: '12px', border: '2px dashed rgba(255,255,255,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', background: 'var(--input-bg)' }}>
                       <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}><ImageIcon size={24} style={{ margin: '0 auto 4px' }}/>追加 ({parseImages(formData.image_data).length}/4)</div>
                       <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
                     </div>
                   )}
                 </div>



              </div>


              <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: '1rem', borderRadius: '12px' }}>キャンセル</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 2, padding: '16px', fontSize: '1rem', borderRadius: '12px' }}
                >
                  {editingVehicleId ? '変更を保存する' : '申請を送信する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTrailerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px', overflowY: 'auto' }}>
          <div className="glass card animate-fade" style={{ width: '100%', maxWidth: '560px', padding: isMobile ? '20px' : '40px', borderRadius: '24px' }}>

            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '4px' }}>🚛 トレーラーを追加</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9rem' }}>被牽引車（トレーラー）の登録申請を行います。</p>
            <form onSubmit={handleSubmitTrailer} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '20px' }}>
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
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>License Plate Number *</label>
                <input type="text" placeholder="例: TRL-1234" value={trailerFormData.plate} onChange={e => setTrailerFormData({...trailerFormData, plate: e.target.value.toUpperCase()})} required className="glass" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-main)', fontSize: '1.2rem', fontFamily: 'monospace', fontWeight: 700, background: 'var(--input-bg)' }} />
              </div>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowTrailerModal(false)} className="btn btn-secondary" style={{ flex: 1, padding: '16px', borderRadius: '12px' }} disabled={trailerSubmitting}>キャンセル</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2, padding: '16px', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem' }} disabled={trailerSubmitting}>
                  {trailerSubmitting ? '送信中...' : '🚛 登録申請を送信'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBetaAutoFillModal && (

        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div className="glass card animate-fade" style={{ width: '100%', maxWidth: '500px', padding: '40px', borderRadius: '24px', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 700, marginBottom: '8px' }}>✨ 自動入力 (Beta)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>
              {formData.game_type === 'rc' 
                ? 'Rensselaer County内のスマホ詳細画面スクリーンショットから、' 
                : 'Greenville内のスマホ車両画面スクリーンショットから、'}
              <br />
              情報を読み取って自動入力します。
            </p>

            {ocrLoading ? (
              <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255,255,255,0.05)', borderRadius: '50%' }} />
                  <div style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1.5s linear infinite' }} />
                  <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--primary)', opacity: 0.8 }} />
                </div>
                <div style={{ width: '100%', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{ocrStatus || '処理を開始しています...'}</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{Math.round(ocrProgress * 100)}%</span>
                  </div>
                  <div className="ocr-progress-container">
                    <div className="ocr-progress-bar" style={{ width: `${ocrProgress * 100}%` }} />
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>解析には数秒から数十秒かかる場合があります。しばらくお待ちください。</p>
              </div>
            ) : (
              <div style={{ border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '16px', padding: '40px', position: 'relative', background: 'var(--input-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <ImageIcon size={48} style={{ color: 'var(--text-muted)' }} />
                <div style={{ color: 'var(--text-main)', fontWeight: 'bold' }}>ここをクリックして画像を選択</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>または、スクショ画像をペースト (Ctrl+V) も可能です。</div>
                <input 
                  type="file" 
                  accept="image/jpeg, image/png" 
                  onChange={handleOCRFileSelect} 
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} 
                />
              </div>
            )}

            <div style={{ marginTop: '32px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowBetaAutoFillModal(false)} 
                disabled={ocrLoading}
                style={{ width: '100%', padding: '16px', fontSize: '1rem', borderRadius: '12px' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {rejectModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '24px' }}>
          <div className="glass card animate-fade" style={{ width: '100%', maxWidth: '520px', padding: '28px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
        <div style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '24px' }}>
          <div className="glass card animate-fade" style={{ width: '100%', maxWidth: '480px', padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--panel-bg)', border: '1px solid var(--glass-border)', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
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
          style={{ position: 'fixed', inset: 0, background: 'var(--modal-overlay, rgba(10,12,16,0.85))', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '24px' }}
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
                  ? 'linear-gradient(135deg, var(--primary) 0%, #00c166 100%)'
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
  );
}
