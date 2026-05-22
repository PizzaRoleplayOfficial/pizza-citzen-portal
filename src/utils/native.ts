import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * アプリが現在スマホ実機などのネイティブ環境（Android等）で動作しているか判定します。
 */
export const isNative = Capacitor.isNativePlatform();

/**
 * 触覚（振動）フィードバックをトリガーします。
 * ブラウザ上などのネイティブ以外の環境では何も行いません。
 */
export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
) => {
  if (!isNative) return;
  
  try {
    switch (type) {
      case 'light':
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'medium':
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'heavy':
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
      case 'success':
        // 明確なトントン（間隔を120ms空けた2連衝撃）
        await Haptics.impact({ style: ImpactStyle.Medium });
        await new Promise(resolve => setTimeout(resolve, 120));
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'warning':
        // 警告用の明確なリズム（強のあと200msおいて中）
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 200));
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'error':
        // エラー用の激しい3連打（140ms間隔のヘビー3連打）
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 140));
        await Haptics.impact({ style: ImpactStyle.Heavy });
        await new Promise(resolve => setTimeout(resolve, 140));
        await Haptics.impact({ style: ImpactStyle.Heavy });
        break;
    }
  } catch (err) {
    console.error('Haptics trigger failed:', err);
  }
};

/**
 * スマホ端末にローカル通知（プッシュ通知のローカル版）を登録・配信します。
 * 必要に応じて、初回呼び出し時に通知の権限をユーザーにリクエストします。
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  delayMs: number = 0
) => {
  if (!isNative) return;

  try {
    // 1. 通知パーミッションの確認
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== 'granted') {
        console.warn('LocalNotifications permission was not granted.');
        return;
      }
    }

    // 2. 通知のスケジュール実行
    const notificationId = Math.floor(Math.random() * 1000000);
    const scheduleAt = delayMs > 0 ? new Date(Date.now() + delayMs) : undefined;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: notificationId,
          title,
          body,
          schedule: scheduleAt ? { at: scheduleAt } : undefined,
          actionTypeId: 'pizza_alert',
          sound: undefined,
          attachments: [],
          extra: null
        }
      ]
    });
  } catch (err) {
    console.error('LocalNotification schedule failed:', err);
  }
};

/**
 * アプリの初回起動時に通知などの必要な権限を明示的にリクエストします。
 */
export const requestNotificationPermission = async () => {
  if (!isNative) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }
  } catch (err) {
    console.error('Request notification permission failed:', err);
  }
};
