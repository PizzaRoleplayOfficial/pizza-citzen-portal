/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    isDesktop: boolean;
    platform: string;
    appVersion?: string;
    getAppVersion?: () => Promise<string>;
    showNotification: (options: { title: string; body: string; action?: string; param?: string; sound?: boolean }) => Promise<boolean>;
    updateBadge: (count: number | { total: number; pendingApps?: number; unreadMessages?: number }) => Promise<boolean>;
    getIdleTime?: () => Promise<number>;
    installUpdate?: (downloadUrl: string) => Promise<{ success: boolean; error?: string }>;
    onUpdateProgress?: (callback: (progress: number) => void) => () => void;
    setUpdateAvailable?: (ver: string | null) => Promise<boolean>;
    getSettings: () => Promise<{ openAtLogin: boolean; closeToTray: boolean }>;
    setSetting: (key: string, val: any) => Promise<boolean>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    onNavigate: (callback: (data: { action: string; param?: string }) => void) => () => void;
    onPowerModeChange: (callback: (mode: 'sleep' | 'active') => void) => () => void;
  };
}
