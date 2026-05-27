import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface PixelHapticsPlugin {
  trigger(options: { type: 'tick' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' }): Promise<void>;
}
const PixelHaptics = registerPlugin<PixelHapticsPlugin>('PixelHaptics');


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
    const platform = Capacitor.getPlatform();
    
    // Android 環境かつ自作プラグインが有効な場合、Pixel/Android向け極限ハプティクスを使用
    if (platform === 'android') {
      try {
        let nativeType: 'tick' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'tick';
        switch (type) {
          case 'light':
            nativeType = 'tick'; // CLOCK_TICK（Pixel本来のチクタク極小触覚）
            break;
          case 'medium':
            nativeType = 'medium'; // KEYBOARD_TAP
            break;
          case 'heavy':
            nativeType = 'heavy'; // LONG_PRESS
            break;
          case 'success':
            nativeType = 'success'; // CONFIRM (トントン連打)
            break;
          case 'warning':
            nativeType = 'warning';
            break;
          case 'error':
            nativeType = 'error'; // REJECT (ブルブル連打)
            break;
        }
        await PixelHaptics.trigger({ type: nativeType });
        return;
      } catch (err) {
        console.warn('PixelHaptics native plugin execution failed, falling back to standard haptics:', err);
      }
    }

    // iOS または Android でカスタムプラグインが失敗した場合の標準フォールバック
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
  delayMs: number = 0,
  channelId?: string
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
          channelId: channelId, // Specify notification category channel
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
 * アプリの初回起動時に通知などの必要な権限を明示的にリクエストし、用途別の通知カテゴリー（チャンネル）を作成します。
 */
export const requestNotificationPermission = async () => {
  if (!isNative) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') {
      await LocalNotifications.requestPermissions();
    }

    // Create utility notification channels (Notification Categories in Android settings)
    const channels = [
      {
        id: 'application_results_channel',
        name: '申請結果通知',
        description: '市民申請や車両登録申請の審査結果を通知します。',
        importance: 4, // HIGH
        visibility: 1, // PUBLIC
        sound: 'default'
      },
      {
        id: 'admin_notifications_channel',
        name: '管理者向け通知',
        description: '運営管理者向けの新規申請到着などを通知します。',
        importance: 3, // DEFAULT
        visibility: 1,
        sound: 'default'
      },
      {
        id: 'live_update_channel',
        name: 'アプリのアップデート',
        description: 'アプリ内自動アップデートの進捗状況を通知します。',
        importance: 4, // HIGH
        visibility: 1
      }
    ];

    for (const channel of channels) {
      await LocalNotifications.createChannel(channel);
    }
    console.log('Notification channels created successfully.');
  } catch (err) {
    console.error('Request notification permission and channels failed:', err);
  }
};

export interface BackgroundPollPlugin {
  setupPoll(options: { userId: string; role: string; domain: string }): Promise<{ success: boolean }>;
  stopPoll(): Promise<{ success: boolean }>;
  updateCache(options: { vehiclesJson: string }): Promise<{ success: boolean }>;
}
const BackgroundPoll = registerPlugin<BackgroundPollPlugin>('BackgroundPoll');

export const startBackgroundPoll = async (userId: string, role: string, domain: string) => {
  if (!isNative) return;
  try {
    await BackgroundPoll.setupPoll({ userId, role, domain });
    console.log('Background polling started.');
  } catch (err) {
    console.error('Failed to start background polling:', err);
  }
};

export const stopBackgroundPoll = async () => {
  if (!isNative) return;
  try {
    await BackgroundPoll.stopPoll();
    console.log('Background polling stopped.');
  } catch (err) {
    console.error('Failed to stop background polling:', err);
  }
};

export const updateBackgroundPollCache = async (vehicles: any[]) => {
  if (!isNative || !Array.isArray(vehicles)) return;
  try {
    const map: Record<string, string> = {};
    vehicles.forEach(v => {
      if (v && v.id) {
        map[v.id] = v.status || 'pending';
      }
    });
    await BackgroundPoll.updateCache({ vehiclesJson: JSON.stringify(map) });
  } catch (err) {
    console.error('Failed to update background polling cache:', err);
  }
};
