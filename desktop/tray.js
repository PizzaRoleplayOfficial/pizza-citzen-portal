// desktop/tray.js - Discord-style System Tray Controller
const { Tray, Menu, app, nativeImage } = require('electron');
const path = require('path');

let tray = null;
let currentBadgeCount = 0;
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
    const isAutostart = app.getLoginItemSettings().openAtLogin;
    const isCloseToTray = store.get('closeToTray', true);

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
        label: currentBadgeCount > 0 ? `🛡️ 管理パネルを開く (${currentBadgeCount}件の申請)` : '🛡️ 管理パネルを開く',
        click: () => {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          onAction({ action: 'admin' });
        }
      },
      {
        label: '💬 メッセージを開く',
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
    updateBadge: (count) => {
      currentBadgeCount = count;
      if (count > 0) {
        tray.setImage(iconBadgePath);
        tray.setToolTip(`ぴっざぁ市民ポータル (${count}件の未読/保留)`);
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
