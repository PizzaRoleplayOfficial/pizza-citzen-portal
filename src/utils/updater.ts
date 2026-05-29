import { registerPlugin, Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

// 現在のアプリバージョン
export const CURRENT_VERSION = '2.2.11'; // 2.2.11 (表示数・共有・アプリ移動機能実装・共有バグ＆プレビューOGP画像対応版)

// GitHub リポジトリ設定 (必要に応じて変更可能)
export const GITHUB_REPO_OWNER = 'PizzaRoleplayOfficial';
export const GITHUB_REPO_NAME = 'pizza-citzen-portal';

export interface ApkInstallerPlugin {
  installApk(options: { filePath: string }): Promise<{ success: boolean }>;
}

export interface LiveUpdatePlugin {
  startDownload(options: { url: string }): Promise<{ success: boolean }>;
}

// 読み込みタイミングの Race Condition を避けるため、使用時に動的取得する getter を定義します
export const getApkInstaller = () => registerPlugin<ApkInstallerPlugin>('ApkInstaller');
export const getLiveUpdate = () => registerPlugin<LiveUpdatePlugin>('LiveUpdate');

export interface GitHubRelease {
  version: string;
  notes: string;
  apkUrl: string;
}

/**
 * セマンティックバージョニングの比較を行います。
 * latest (最新版) が current (現在のバージョン) より新しければ true を返します。
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map(Number);
  const currentParsed = parse(current);
  const latestParsed = parse(latest);

  // パース失敗時の安全ガード
  if (currentParsed.length < 3 || latestParsed.length < 3) {
    return latest.replace(/^v/, '') !== current.replace(/^v/, '');
  }

  const [cMajor, cMinor, cPatch] = currentParsed;
  const [lMajor, lMinor, lPatch] = latestParsed;

  if (lMajor > cMajor) return true;
  if (lMajor < cMajor) return false;

  if (lMinor > cMinor) return true;
  if (lMinor < cMinor) return false;

  return lPatch > cPatch;
}

/**
 * GitHub APIから最新のリリース情報を取得します
 */
export async function checkLatestRelease(): Promise<GitHubRelease | null> {
  try {
    // プレリリース(Pre-release)も含めて最新リリースを取得するため、全リリース一覧の先頭を取得します
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`);
    if (!res.ok) {
      throw new Error(`GitHub API returned status ${res.status}`);
    }
    const releases = await res.json();
    if (!Array.isArray(releases) || releases.length === 0) {
      console.warn('No releases found.');
      return null;
    }

    const data = releases[0];

    // APKファイルのアセット（.apkで終わるもの）を探す
    const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));
    if (!apkAsset) {
      console.warn('No APK asset found in the latest release.');
      return null;
    }

    return {
      version: data.tag_name,
      notes: data.body || '',
      apkUrl: apkAsset.browser_download_url
    };
  } catch (err) {
    console.error('Failed to check latest release:', err);
    return null;
  }
}

/**
 * APKファイルをダウンロードし、カスタムネイティブプラグインを呼び出してインストールを開始します
 */
export async function downloadAndInstallApk(
  downloadUrl: string,
  onProgress: (percentage: number) => void
): Promise<{ isBackground: boolean }> {
  // 実験的で動かない可能性のある LiveUpdate バックグラウンドサービスをバイパスし、
  // 確実なフォアグラウンドダウンロード（進捗表示）＋フォアグラウンドインストールに統一します。

  let progressListener: any = null;
  try {
    // 1. ダウンロード進捗の監視
    progressListener = await Filesystem.addListener('progress', (progress) => {
      if (progress.contentLength > 0) {
        const percentage = Math.round((progress.bytes / progress.contentLength) * 100);
        onProgress(percentage);
      }
    });

    // 2. アプリのキャッシュ領域にダウンロード (パーミッション不要、FileProviderでの共有に対応)
    const filename = 'pizza_update.apk';
    const result = await Filesystem.downloadFile({
      url: downloadUrl,
      path: filename,
      directory: Directory.Cache,
      progress: true
    });

    // 3. ダウンロード後のファイルパス検証
    if (!result.path) {
      throw new Error('Download finished but local file path is empty.');
    }

    // 4. 進捗リスナーの解除
    if (progressListener) {
      await progressListener.remove();
      progressListener = null;
    }

    // 5. 自作ネイティブプラグインの呼び出し
    const apkInstaller = getApkInstaller();
    await apkInstaller.installApk({ filePath: result.path });
    return { isBackground: false };
  } catch (err) {
    if (progressListener) {
      await progressListener.remove();
    }
    throw err;
  }
}
