// desktop/tray.js - Discord-style System Tray Controller
const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let currentBadge = { total: 0, pendingApps: 0, unreadMessages: 0 };
let availableUpdateVersion = null;

function createTray(mainWindow, store, onAction) {
  const iconNormalPath = path.join(__dirname, 'assets', 'icon.ico');
  const iconBadgePath = path.join(__dirname, 'assets', 'icon_badge.ico');

  tray = new Tray(iconNormalPath);
  tray.setToolTip('ぴっざぁ市民ポータル');

  // Discord behavior: Left click toggles window show/focus or hide
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      if (mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.focus();
      }
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Double click also shows window
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  function updateMenu() {
    const isAutostart = store.get('openAtLogin', false);
    const isCloseToTray = store.get('closeToTray', true);

    const adminLabel = currentBadge.pendingApps > 0
      ? `🛡️ 管理パネルを開く (${currentBadge.pendingApps}件の申請)`
      : '🛡️ 管理パネルを開く';

    const messagesLabel = currentBadge.unreadMessages > 0
      ? `💬 メッセージを開く (${currentBadge.unreadMessages}件の未読)`
      : '💬 メッセージを開く';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '🍕 ぴっざぁ市民ポータルを開く',
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      },
      {
        label: adminLabel,
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          onAction({ action: 'admin' });
        }
      },
      {
        label: messagesLabel,
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          onAction({ action: 'messages' });
        }
      },
      { type: 'separator' },
      ...(availableUpdateVersion ? [{
        label: `🚀 新バージョン v${availableUpdateVersion} を更新...`,
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          onAction({ action: 'check-update' });
        }
      }] : [{
        label: '🔄 アップデートを確認...',
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          onAction({ action: 'check-update' });
        }
      }]),
      {
        label: '⚙️ Windows 起動時に自動起動',
        type: 'checkbox',
        checked: isAutostart,
        click: (item) => {
          store.set('openAtLogin', item.checked);
          app.setLoginItemSettings({
            openAtLogin: item.checked,
            args: ['--hidden']
          });
        }
      },
      {
        label: '📥 閉じる時にトレイへ最小化',
        type: 'checkbox',
        checked: isCloseToTray,
        click: (item) => {
          store.set('closeToTray', item.checked);
        }
      },
      { type: 'separator' },
      {
        label: '❌ ぴっざぁポータルを終了',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  updateMenu();

  return {
    tray,
    updateBadge: (data) => {
      if (typeof data === 'number') {
        currentBadge = { total: data, pendingApps: data, unreadMessages: 0 };
      } else if (data && typeof data === 'object') {
        currentBadge = {
          total: Number(data.total) || 0,
          pendingApps: Number(data.pendingApps) || 0,
          unreadMessages: Number(data.unreadMessages) || 0
        };
      } else {
        currentBadge = { total: 0, pendingApps: 0, unreadMessages: 0 };
      }

      if (currentBadge.total > 0) {
        tray.setImage(iconBadgePath);
        if (currentBadge.pendingApps > 0 && currentBadge.unreadMessages > 0) {
          tray.setToolTip(`ぴっざぁ市民ポータル (申請 ${currentBadge.pendingApps}件, 未読メッセージ ${currentBadge.unreadMessages}件)`);
        } else if (currentBadge.unreadMessages > 0) {
          tray.setToolTip(`ぴっざぁ市民ポータル (${currentBadge.unreadMessages}件の未読メッセージ)`);
        } else {
          tray.setToolTip(`ぴっざぁ市民ポータル (${currentBadge.pendingApps}件の保留申請)`);
        }
      } else {
        tray.setImage(iconNormalPath);
        tray.setToolTip('ぴっざぁ市民ポータル');
      }
      updateMenu();
    },
    updateMenu,
    setUpdateAvailable: (ver) => {
      availableUpdateVersion = ver;
      updateMenu();
    }
  };
}

module.exports = { createTray };
