import { load } from '@tauri-apps/plugin-store';
import { SubscriptionInfo, DEFAULT_SUBSCRIPTION } from '@/types/subscription';

const STORE_FILE = 'usage.json';

/**
 * ストアを取得
 */
async function getStore() {
  return await load(STORE_FILE);
}

/**
 * サブスクリプション情報を取得
 */
export async function getSubscription(): Promise<SubscriptionInfo> {
  const store = await getStore();
  const subscription = store.get('subscription') as SubscriptionInfo | undefined;

  if (!subscription) {
    return DEFAULT_SUBSCRIPTION;
  }

  return subscription;
}

/**
 * サブスクリプション情報を保存
 */
export async function saveSubscription(subscription: SubscriptionInfo): Promise<void> {
  const store = await getStore();
  store.set('subscription', subscription);
  await store.save();
}

/**
 * サブスクリプション情報を更新
 */
export async function updateSubscription(
  updates: Partial<SubscriptionInfo>
): Promise<SubscriptionInfo> {
  const currentSubscription = await getSubscription();
  const updatedSubscription = { ...currentSubscription, ...updates };

  await saveSubscription(updatedSubscription);
  return updatedSubscription;
}

/**
 * サブスクリプションをリセット（無料プランに戻す）
 */
export async function resetSubscription(): Promise<void> {
  await saveSubscription(DEFAULT_SUBSCRIPTION);
}

/**
 * 今日のリクエスト数を取得
 */
export async function getTodayRequestCount(): Promise<number> {
  const store = await getStore();
  const requestCount = store.get('request_count') as Record<string, number> | undefined;

  if (!requestCount) {
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  return requestCount[today] || 0;
}

/**
 * 変換タイプを取得
 */
export async function getConvertType(): Promise<string> {
  const store = await getStore();
  return (store.get('convert_type') as string) || 'revision';
}

/**
 * 変換タイプを保存
 */
export async function saveConvertType(convertType: string): Promise<void> {
  const store = await getStore();
  store.set('convert_type', convertType);
  await store.save();
}

/**
 * 画面タイプを取得
 */
export async function getScreenType(): Promise<string | undefined> {
  const store = await getStore();
  return store.get('screen_type') as string | undefined;
}

/**
 * 画面タイプを保存
 */
export async function saveScreenType(screenType: string): Promise<void> {
  const store = await getStore();
  store.set('screen_type', screenType);
  await store.save();
}