export interface OutboxItem {
  id: string; // 一意なID
  url: string;
  method: 'POST' | 'DELETE' | 'PATCH';
  body: any;
  headers?: Record<string, string>;
  description: string; // UI表示用、LiveProgress 進捗表示用 ("新規投稿の送信"など)
  tempId?: string; // 楽観的UI更新の差し替え用
  timestamp: number;
}

const OUTBOX_STORAGE_KEY = 'gvvr_outbox_queue';

/**
 * ローカルのOutboxキューを取得します。
 */
export const getOutbox = (): OutboxItem[] => {
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to parse outbox queue:', err);
    return [];
  }
};

/**
 * ローカルのOutboxキューを保存します。
 */
export const saveOutbox = (queue: OutboxItem[]) => {
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save outbox queue:', err);
  }
};

/**
 * 送信失敗したリクエストをOutboxキューに追加します。
 */
export const addToOutbox = (item: Omit<OutboxItem, 'id' | 'timestamp'>): OutboxItem => {
  const queue = getOutbox();
  const newItem: OutboxItem = {
    ...item,
    id: 'outbox_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
    timestamp: Date.now()
  };
  queue.push(newItem);
  saveOutbox(queue);
  console.log('Added item to Outbox:', newItem);
  
  // キューが変更されたことを知らせるイベントをディスパッチ
  window.dispatchEvent(new CustomEvent('gvvr-outbox-changed', { detail: queue }));
  return newItem;
};

/**
 * 指定したアイテムをキューから削除します。
 */
export const removeFromOutbox = (id: string) => {
  const queue = getOutbox();
  const next = queue.filter(item => item.id !== id);
  saveOutbox(next);
  window.dispatchEvent(new CustomEvent('gvvr-outbox-changed', { detail: next }));
};

/**
 * キュー全体をクリアします。
 */
export const clearOutbox = () => {
  saveOutbox([]);
  window.dispatchEvent(new CustomEvent('gvvr-outbox-changed', { detail: [] }));
};
