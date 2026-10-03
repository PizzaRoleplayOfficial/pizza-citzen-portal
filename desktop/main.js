const { spawn } = require('child_process');
const https = require('https');
const http = require('http');
// desktop/main.js - Discord-style Windows Desktop Shell (Optimized & Silent)
const { app, BrowserWindow, ipcMain, Notification, session, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');
const { createTray } = require('./tray');

// App name and Windows Action Center AUMID
app.name = 'ぴっざぁ市民ポータル';
app.setAppUserModelId('jp.pizzaroleplay.citizenportal');

// Fast startup & performance switches
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

// Simple file-based config store for desktop preferences
const configPath = path.join(app.getPath('userData'), 'desktop_config.json');
const store = {
  get(key, defaultValue) {
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        return data[key] !== undefined ? data[key] : defaultValue;
      }
    } catch {}
    return defaultValue;
  },
  set(key, value) {
    try {
      let data = {};
      if (fs.existsSync(configPath)) {
        data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      data[key] = value;
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to write desktop config:', e);
    }
  }
};

let mainWindow = null;
let trayController = null;

// Enforce single instance lock (just like Discord)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

function createWindow() {
  const isDev = process.argv.includes('--dev');
  const isHiddenStartup = process.argv.includes('--hidden');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 600,
    show: !isHiddenStartup, // Instant display on launch (no waiting lag)
    backgroundColor: '#0a0d14',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    // Discord-like integrated titlebar with native Windows 11 controls
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#090a0f',
      symbolColor: '#94a3b8',
      height: 34
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Ensure timer polling runs reliably in system tray
      spellcheck: true
    }
  });

  // Create Discord-style System Tray
  trayController = createTray(mainWindow, store, (actionData) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('desktop:navigate', actionData);
      });
    } else {
      mainWindow.webContents.send('desktop:navigate', actionData);
    }
  });

  // Single preload configured in webPreferences

  // Allow F5 / Ctrl+R to reload ignoring cache
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // Clear HTTP cache on startup to ensure instant update pickup
  if (mainWindow.webContents.session) {
    mainWindow.webContents.session.clearCache();
  }

  // Load target URL: Dev server, Cloudflare production deployment, or local dist fallback
  let targetUrl = 'https://pizza-citzen-portal.pages.dev';
  if (isDev) {
    targetUrl = 'http://localhost:5173';
  } else if (process.argv.includes('--local')) {
    const distHtml = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(distHtml)) {
      targetUrl = `file://${distHtml}`;
    }
  }

  mainWindow.loadURL(targetUrl, {
    extraHeaders: 'pragma: no-cache\ncache-control: no-cache\n'
  }).catch((err) => {
    console.error('Failed to load target URL:', err);
    // Fallback to local dist if available
    const localHtml = path.join(__dirname, '..', 'dist', 'index.html');
    if (fs.existsSync(localHtml)) {
      mainWindow.loadFile(localHtml);
    }
  });

  // Discord behavior: Close to Tray (Silent - No balloon notification!)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      const closeToTray = store.get('closeToTray', true);
      if (closeToTray) {
        event.preventDefault();
        mainWindow.hide(); // Silently hide to tray without any popups!
      }
    }
  });

  // Discord Power Saving: Emit sleep/active signals when hidden/shown
  mainWindow.on('hide', () => {
    mainWindow.webContents.send('desktop:power-mode', 'sleep');
  });

  mainWindow.on('show', () => {
    mainWindow.webContents.send('desktop:power-mode', 'active');
  });
}

// IPC Handlers
ipcMain.handle('desktop:show-notification', (event, { title, body, action, param, sound = true }) => {
  if (!Notification.isSupported()) return false;

  const notif = new Notification({
    title: title || 'ぴっざぁ市民ポータル',
    body: body || '',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    silent: !sound,
    urgency: 'high'
  });

  notif.on('click', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (action) {
        mainWindow.webContents.send('desktop:navigate', { action, param });
      }
    }
  });

  notif.show();
  return true;
});

ipcMain.handle('desktop:update-badge', (event, badgeData) => {
  if (trayController) {
    trayController.updateBadge(badgeData);
  }
  return true;
});


// Auto Update Downloader with redirect follow & progress
function downloadUpdateFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadUpdateFile(res.headers.location, destPath, onProgress).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed with status code ${res.statusCode}`));
        return;
      }
      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let receivedBytes = 0;
      const fileStream = fs.createWriteStream(destPath);
      res.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          onProgress(pct);
        }
      });
      res.pipe(fileStream);
      fileStream.on('finish', () => {
        fileStream.close(() => resolve(destPath));
      });
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
    req.on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

ipcMain.handle('desktop:set-update-available', (event, ver) => {
  if (trayController && trayController.setUpdateAvailable) {
    trayController.setUpdateAvailable(ver);
  }
  return true;
});

ipcMain.handle('desktop:install-update', async (event, downloadUrl) => {
  try {
    const tempDir = app.getPath('temp');
    const installerPath = path.join(tempDir, 'PizzaPortal-Setup-update.exe');
    await downloadUpdateFile(downloadUrl, installerPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop:update-progress', progress);
      }
    });

    // Launch the downloaded setup silently or in one-click mode to update and restart
    setTimeout(() => {
      try {
        const child = spawn(installerPath, ['/S'], {
          detached: true,
          stdio: 'ignore'
        });
        child.unref();
        app.isQuitting = true;
        app.quit();
      } catch (spawnErr) {
        console.error('Failed to launch updater:', spawnErr);
      }
    }, 600);

    return { success: true };
  } catch (err) {
    console.error('Desktop install-update error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('desktop:get-idle-time', () => {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch {
    return 0;
  }
});

ipcMain.on('desktop:get-app-version-sync', (event) => {
  event.returnValue = app.getVersion();
});

ipcMain.handle('desktop:get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('desktop:get-settings', () => {
  return {
    openAtLogin: store.get('openAtLogin', false),
    closeToTray: store.get('closeToTray', true)
  };
});

ipcMain.handle('desktop:set-setting', (event, key, val) => {
  store.set(key, val);
  if (key === 'openAtLogin') {
    app.setLoginItemSettings({
      openAtLogin: !!val,
      args: ['--hidden']
    });
  }
  if (trayController) {
    trayController.updateMenu();
  }
  return true;
});

ipcMain.handle('desktop:window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('desktop:window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.handle('desktop:window-close', () => {
  if (mainWindow) mainWindow.close();
});

// App Lifecycle
app.whenReady().then(() => {
  // Sync autostart setting with Windows (default: false unless user explicitly turned it ON)
  const openAtLoginSetting = store.get('openAtLogin', false);
  app.setLoginItemSettings({
    openAtLogin: !!openAtLoginSetting,
    args: ['--hidden']
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // On Windows, keep running in tray unless explicit quit
  if (process.platform !== 'win32' || app.isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});
