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
