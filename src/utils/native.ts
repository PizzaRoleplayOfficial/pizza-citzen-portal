import { Capacitor, registerPlugin } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { compressImage } from './helpers';

export interface PixelHapticsPlugin {
  trigger(options: { type: 'tick' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'segment_tick' | 'segment_frequent' | 'drag_start' | 'gesture_start' | 'gesture_end' }): Promise<void>;
}
const PixelHaptics = registerPlugin<PixelHapticsPlugin>('PixelHaptics');

export interface PhotoPickerPlugin {
  pickImages(options: { maxSelectionCount: number }): Promise<{ paths: string[] }>;
}
const PhotoPicker = registerPlugin<PhotoPickerPlugin>('PhotoPicker');


/**
 * アプリが現在スマホ実機などのネイティブ環境（Android等）で動作しているか判定します。
 */
export const isNative = Capacitor.isNativePlatform() && Capacitor.getPlatform() !== 'web';

/**
 * 触覚（振動）フィードバックをトリガーします。
 * ブラウザ上などのネイティブ以外の環境では何も行いません。
 */
export const triggerHaptic = async (
  type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'segment_tick' | 'segment_frequent' | 'drag_start' | 'gesture_start' | 'gesture_end'
) => {
  if (!isNative) return;
  
  try {
    const platform = Capacitor.getPlatform();
    
    // Android 環境かつ自作プラグインが有効な場合、Pixel/Android向け極限ハプティクスを使用
    if (platform === 'android') {
      try {
        let nativeType: 'tick' | 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'segment_tick' | 'segment_frequent' | 'drag_start' | 'gesture_start' | 'gesture_end' = 'tick';
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
          case 'segment_tick':
          case 'segment_frequent':
          case 'drag_start':
          case 'gesture_start':
          case 'gesture_end':
            nativeType = type;
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
      case 'segment_tick':
      case 'gesture_start':
        // 従来の Light よりさらに繊細で微細な「コトッ」とした感触を得るために Selection 触覚を使用
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        break;
      case 'medium':
      case 'drag_start':
      case 'gesture_end':
        // 従来の Medium は強すぎるため、マイルドで軽快な Light に変更
        await Haptics.impact({ style: ImpactStyle.Light });
        break;
      case 'heavy':
        // 従来の Heavy も強すぎるため、しっかり感じつつも上品な Medium に変更
        await Haptics.impact({ style: ImpactStyle.Medium });
        break;
      case 'segment_frequent':
        // 高頻度な微小振動のシミュレート
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
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
 * ネイティブの写真ピッカーを起動し、選択された画像を圧縮してBase64形式の配列で返します。
 */
export const pickImagesNative = async (maxCount: number = 1): Promise<string[]> => {
  if (!isNative) {
    throw new Error('Not running on a native platform');
  }

  try {
    const result = await PhotoPicker.pickImages({ maxSelectionCount: maxCount });
    if (!result || !result.paths || result.paths.length === 0) {
      return [];
    }

    const base64List = await Promise.all(
      result.paths.map(async (uri) => {
        try {
          const webUrl = Capacitor.convertFileSrc(uri);
          const res = await fetch(webUrl);
          const blob = await res.blob();
          const file = new File([blob], 'image.jpeg', { type: blob.type || 'image/jpeg' });
          return await compressImage(file);
        } catch (innerErr) {
          console.error('Failed to convert/compress native image URI:', uri, innerErr);
          throw innerErr;
        }
      })
    );

    return base64List;
  } catch (err) {
    console.error('pickImagesNative failed:', err);
    throw err;
  }
};

/**
 * ネイティブの写真ピッカーを起動し、選択された画像を JavaScript の File オブジェクトの配列として返します。
 */
export const pickImageFilesNative = async (maxCount: number = 1): Promise<File[]> => {
  if (!isNative) {
    throw new Error('Not running on a native platform');
  }

  try {
    const result = await PhotoPicker.pickImages({ maxSelectionCount: maxCount });
    if (!result || !result.paths || result.paths.length === 0) {
      return [];
    }

    const fileList = await Promise.all(
      result.paths.map(async (uri) => {
        try {
          const webUrl = Capacitor.convertFileSrc(uri);
          const res = await fetch(webUrl);
          const blob = await res.blob();
          return new File([blob], 'image.jpeg', { type: blob.type || 'image/jpeg' });
        } catch (innerErr) {
          console.error('Failed to convert native image URI to File:', uri, innerErr);
          throw innerErr;
        }
      })
    );

    return fileList;
  } catch (err) {
    console.error('pickImageFilesNative failed:', err);
    throw err;
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
  if (!isNative) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if (delayMs > 0) {
          setTimeout(() => {
            new Notification(title, { 
              body,
              icon: '/favicon.ico'
            });
          }, delayMs);
        } else {
          new Notification(title, { 
            body,
            icon: '/favicon.ico'
          });
        }
      } catch (err) {
        console.error('Web Notification creation failed:', err);
      }
    }
    return;
  }

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
  if (!isNative) {
    if ('Notification' in window) {
      try {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
          await Notification.requestPermission();
        }
      } catch (err) {
        console.error('Web Notification permission request failed:', err);
      }
    }
    return;
  }
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
        name: '新規申請の管理者向け通知',
        description: '運営管理者向けの新規申請到着などを通知します。',
        importance: 3, // DEFAULT
        visibility: 1,
        sound: 'default'
      },
      {
        id: 'admin_edit_notifications_channel',
        name: '登録編集申請の管理者向け通知',
        description: '運営管理者向けの車両登録情報の編集申請到着などを通知します。',
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

/**
 * 端末固有の永続化デバイスIDを取得または作成します。
 */
export const getOrCreateDeviceId = (): string => {
  let id = localStorage.getItem('gvvr_device_id');
  if (!id) {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      id = crypto.randomUUID();
    } else {
      id = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    localStorage.setItem('gvvr_device_id', id);
  }
  return id;
};

/**
 * FCMプッシュ通知の登録を行い、トークンを取得してサーバーへ登録します。
 */
export const registerPushNotifications = async (
  userId: string,
  onAction?: (actionData: { action: string; tab?: string }) => void
) => {
  if (!isNative) return;

  try {
    // 1. パーミッションの確認とリクエスト
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive !== 'granted') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permissions.');
      return;
    }

    // 2. リスナーの追加 (重複登録を避けるため、一旦すべてのリスナーを解除)
    await PushNotifications.removeAllListeners();

    // トークン取得成功時のイベント
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      
      // 前回の登録トークンと同じかチェックして、違えばサーバーに送る、あるいは毎回同期する
      localStorage.setItem('fcm_token', token.value);

      try {
        const platform = Capacitor.getPlatform();
        const deviceId = getOrCreateDeviceId();
        const resultsEnabled = localStorage.getItem('gvvr_push_results') !== 'false';
        const adminEnabled = localStorage.getItem('gvvr_push_admin') !== 'false';
        const adminEditEnabled = localStorage.getItem('gvvr_push_admin_edit') !== 'false';
        const timelineLikeEnabled = localStorage.getItem('gvvr_push_timeline_like') !== 'false';
        const timelineCommentEnabled = localStorage.getItem('gvvr_push_timeline_comment') !== 'false';
        const timelineNewPostEnabled = localStorage.getItem('gvvr_push_timeline_new_post') !== 'false';

        const res = await fetch('/api/push-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            token: token.value,
            platform,
            deviceId,
            resultsEnabled,
            adminEnabled,
            adminEditEnabled,
            timelineLikeEnabled,
            timelineCommentEnabled,
            timelineNewPostEnabled
          })
        });
        if (!res.ok) {
          throw new Error(`Server returned status ${res.status}`);
        }
        console.log('Push token successfully registered to server.');
      } catch (err) {
        console.error('Failed to send push token to server:', err);
      }
    });

    // トークン取得失敗時のイベント
    await PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', JSON.stringify(error));
    });

    // フォアグラウンドで通知を受信した時のイベント
    await PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('Push notification received in foreground:', notification);
        // フォアグラウンドでの受信時はハプティクスなどを鳴らす
        await triggerHaptic('success');
      }
    );

    // 通知をタップした時のイベント
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification: ActionPerformed) => {
        console.log('Push notification action performed:', notification);
        try {
          const data = notification.notification?.data;
          if (data && data.action && onAction) {
            console.log('Push Action Hook: Routing to page...', data);
            onAction({
              action: String(data.action),
              tab: data.tab ? String(data.tab) : undefined
            });
          }
        } catch (err) {
          console.error('Failed to handle push redirect action:', err);
        }
      }
    );

    // 3. FCMへ登録（これによって registration リスナーがトリガーされる）
    await PushNotifications.register();
  } catch (err) {
    console.error('Failed to register push notifications:', err);
  }
};

/**
 * ログアウト時にFCMトークンを解除します。
 */
export const unregisterPushNotifications = async (userId: string) => {
  if (!isNative) return;

  try {
    const token = localStorage.getItem('fcm_token');
    if (token) {
      console.log('Unregistering push token from server...');
      await fetch('/api/push-token', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          token
        })
      }).catch(err => console.error('Failed to call delete token API:', err));

      localStorage.removeItem('fcm_token');
    }
    await PushNotifications.removeAllListeners();
    console.log('Push notification listeners removed.');
  } catch (err) {
    console.error('Failed to unregister push notifications:', err);
  }
};

export interface LiveProgressPlugin {
  start(options: {
    title: string;
    text: string;
    progress: number;
    segments?: string;
    points?: string;
  }): Promise<{ success: boolean }>;
  update(options: {
    title: string;
    text: string;
    progress: number;
    segments?: string;
    points?: string;
  }): Promise<{ success: boolean }>;
  stop(options?: { title?: string; id?: string }): Promise<{ success: boolean }>;
}
const LiveProgress = registerPlugin<LiveProgressPlugin>('LiveProgress');

export const getLiveProgress = () => {
  return LiveProgress;
};

// ---- 内部トラッカー状態管理 ----
// 市民申請・車両登録の2種類のトラッカーで誤って消し合わないように管理する
let _appTrackerActive = false;
let _vehicleTrackerActive = false;

/**
 * ユーザーの市民申請ステータスに応じて Android 16 の進行状況重視通知 (Live Update) を開始・更新・終了します。
 * pending の間は常駐し、承認・却下で自動消去します。
 */
export const updateApplicationTrackerNotification = (app: any) => {
  if (!isNative) return;

  try {
    if (app && app.status === 'pending') {
      const hasAutoScore = app.auto_score !== undefined && app.auto_score !== null;
      let progress = 30;
      let text = '市民申請を受け付けました。自動採点中...';

      if (hasAutoScore) {
        progress = 65;
        text = `自動採点完了 (${app.auto_score}/${app.auto_score_max}問)。管理者の最終審査待ち...`;
      }

      // Segments: Submitted (30%), Waiting Review (35%), Approved/Done (35%)
      const segments = JSON.stringify([
        { weight: 30, color: "#3B82F6" }, // Blue
        { weight: 35, color: "#EAB308" }, // Yellow
        { weight: 35, color: "#10B981" }  // Green
      ]);
      const points = JSON.stringify([
        { position: 30, color: "#3B82F6" },
        { position: 65, color: "#EAB308" }
      ]);

      const opts = { title: '市民申請の審査状況', text, progress, segments, points };
      // 初回は start、以降は update でセグメントを保持したまま更新
      const action = _appTrackerActive ? LiveProgress.update(opts) : LiveProgress.start(opts);
      _appTrackerActive = true;
      action.then(() => {
        console.log('Application LiveProgress tracker started/updated.');
      }).catch(err => {
        console.error('Failed to start/update Application LiveProgress tracker:', err);
      });
    } else {
      // 承認・却下済み → 確実に消去
      if (_appTrackerActive) {
        _appTrackerActive = false;
        LiveProgress.stop({ title: '市民申請の審査状況' }).then(() => {
          console.log('Application LiveProgress tracker stopped.');
        }).catch(err => {
          console.error('Failed to stop Application LiveProgress tracker:', err);
        });
      }
    }
  } catch (err) {
    console.error('Error in updateApplicationTrackerNotification:', err);
  }
};

/**
 * ユーザーの車両登録申請ステータスに応じて Android 16 の進行状況重視通知 (Live Update) を開始・更新・終了します。
 * 審査待ち（pending）の間は常駐し、審査完了（approved/rejected）になると自動消去します。
 */
export const updateVehicleTrackerNotification = (vehicles: any[]) => {
  if (!isNative) return;

  try {
    const pendingVehicles = Array.isArray(vehicles) ? vehicles.filter((v: any) => v.status === 'pending') : [];

    if (pendingVehicles.length > 0) {
      // 最も新しい申請中の車両を取得
      const pendingVehicle = pendingVehicles[pendingVehicles.length - 1];
      const carName = `${pendingVehicle.year}年式 ${pendingVehicle.maker} ${pendingVehicle.model}`;

      // Segments: Submitted (50%), Approved/Done (50%)
      const segments = JSON.stringify([
        { weight: 50, color: "#3B82F6" }, // Submitted (Blue)
        { weight: 50, color: "#10B981" }  // Approved/Done (Green)
      ]);
      const points = JSON.stringify([
        { position: 50, color: "#3B82F6" }
      ]);
      const text = `車両「${carName}」（ナンバー: ${pendingVehicle.plate}）の申請を確認中...`;

      const opts = {
        title: '車両登録の審査状況',
        text,
        progress: 50,
        segments,
        points
      };

      // 初回は start、以降は update（セグメントを毎回送って保持）
      const action = _vehicleTrackerActive ? LiveProgress.update(opts) : LiveProgress.start(opts);
      _vehicleTrackerActive = true;
      action.then(() => {
        console.log('Vehicle LiveProgress tracker started/updated.');
      }).catch(err => {
        console.error('Failed to start/update vehicle LiveProgress tracker:', err);
        // フォールバック: start を再試行
        _vehicleTrackerActive = false;
        LiveProgress.start(opts).catch(e => console.error('Retry start failed:', e));
        _vehicleTrackerActive = true;
      });
    } else {
      // 審査中の車両がなくなった → 通知を確実に消去
      if (_vehicleTrackerActive) {
        _vehicleTrackerActive = false;
        LiveProgress.stop({ title: '車両登録の審査状況' }).then(() => {
          console.log('Vehicle LiveProgress tracker stopped (no pending vehicles).');
        }).catch(err => {
          console.error('Failed to stop vehicle LiveProgress tracker:', err);
        });
      }
    }
  } catch (err) {
    console.error('Error in updateVehicleTrackerNotification:', err);
  }
};
