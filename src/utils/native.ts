import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

/**
 * アプリが現在スマホ実機などのネイティブ環境（Android等）で動作しているか判定します。
 */
export const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() !== 'web';

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
        // 従来の Light よりさらに繊細で微細な「コトッ」とした感触を得るために Selection 触覚を使用
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        break;
      case 'medium':
        // 従来の Medium は強すぎるため、マイルドで軽快な Light に変更
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'heavy':
        // 従来の Heavy も強すぎるため、しっかり感じつつも上品な Medium に変更
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'success':
        // 成功時は「コトコトコトッ」と3つの超微細タップが流れるように（間隔60msの極小Selection連打）
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        await new Promise(resolve => setTimeout(resolve, 60));
        await Haptics.selectionChanged();
        await new Promise(resolve => setTimeout(resolve, 60));
        await Haptics.selectionChanged();
        break;
      case 'warning':
        // 警告時は「コト・コトッ」と少し間隔をあけて上品に注意喚起
        await Haptics.impact({ style: ImpactStyle.Light });
        await new Promise(resolve => setTimeout(resolve, 120));
        await Haptics.selectionChanged();
        break;
      case 'error':
        // エラー時は「コココココッ」と微弱ながら高速で心地よいタップを5回連打（間隔70msの高速Light連打）
        for (let i = 0; i < 5; i++) {
          await Haptics.impact({ style: ImpactStyle.Light });
          if (i < 4) await new Promise(resolve => setTimeout(resolve, 70));
        }
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
