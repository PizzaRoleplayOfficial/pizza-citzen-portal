/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    isDesktop: boolean;
    platform: string;
    showNotification: (options: { title: string; body: string; action?: string; param?: string; sound?: boolean }) => Promise<boolean>;
    updateBadge: (count: number) => Promise<boolean>;
    getIdleTime?: () => Promise<number>;
    getSettings: () => Promise<{ openAtLogin: boolean; closeToTray: boolean }>;
    setSetting: (key: string, val: any) => Promise<boolean>;
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    onNavigate: (callback: (data: { action: string; param?: string }) => void) => () => void;
    onPowerModeChange: (callback: (mode: 'sleep' | 'active') => void) => () => void;
  };
}
