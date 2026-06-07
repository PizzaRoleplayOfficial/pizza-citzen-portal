import { registerPlugin } from '@capacitor/core';

export interface BackGestureEventData {
  progress: number;
  swipeEdge: number;
  touchX: number;
  touchY: number;
}

export interface BackGesturePluginType {
  setEnabled(options: { enabled: boolean }): Promise<{ success: boolean }>;
  addListener(
    eventName: 'backStarted',
    listenerFunc: (data: BackGestureEventData) => void
  ): Promise<any> & { remove: () => void };
  addListener(
    eventName: 'backProgressed',
    listenerFunc: (data: BackGestureEventData) => void
  ): Promise<any> & { remove: () => void };
  addListener(
    eventName: 'backCancelled',
    listenerFunc: () => void
  ): Promise<any> & { remove: () => void };
  addListener(
    eventName: 'backPressed',
    listenerFunc: () => void
  ): Promise<any> & { remove: () => void };
}

export const BackGesture = registerPlugin<BackGesturePluginType>('BackGesture');

// Global back interceptor coordinator for SPA components (like Lightbox)
declare global {
  interface Window {
    backInterceptorCount?: number;
    updateBackGestureEnabled?: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.backInterceptorCount = 0;
}

export const registerBackInterceptor = () => {
  if (typeof window !== 'undefined') {
    window.backInterceptorCount = (window.backInterceptorCount || 0) + 1;
    if (window.updateBackGestureEnabled) {
      window.updateBackGestureEnabled();
    }
  }
};

export const unregisterBackInterceptor = () => {
  if (typeof window !== 'undefined') {
    window.backInterceptorCount = Math.max(0, (window.backInterceptorCount || 0) - 1);
    if (window.updateBackGestureEnabled) {
      window.updateBackGestureEnabled();
    }
  }
};
