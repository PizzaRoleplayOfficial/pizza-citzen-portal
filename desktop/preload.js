// desktop/preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,

  // Windows Native Toast Notification
  showNotification: (options) => ipcRenderer.invoke('desktop:show-notification', options),

  // Update System Tray Badge (Count & Icon)
  updateBadge: (count) => ipcRenderer.invoke('desktop:update-badge', count),

  // System Idle Time (for Discord-style presence detection)
  getIdleTime: () => ipcRenderer.invoke('desktop:get-idle-time'),

  // Settings: Autostart, Close to Tray, etc.
  getSettings: () => ipcRenderer.invoke('desktop:get-settings'),
  setSetting: (key, val) => ipcRenderer.invoke('desktop:set-setting', key, val),

  // Window Controls (if using custom titlebar)
  minimizeWindow: () => ipcRenderer.invoke('desktop:window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('desktop:window-maximize'),
  closeWindow: () => ipcRenderer.invoke('desktop:window-close'),

  // Listeners from Main process
  onNavigate: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('desktop:navigate', handler);
    return () => ipcRenderer.removeListener('desktop:navigate', handler);
  },

  onPowerModeChange: (callback) => {
    const handler = (_event, mode) => callback(mode);
    ipcRenderer.on('desktop:power-mode', handler);
    return () => ipcRenderer.removeListener('desktop:power-mode', handler);
  }
});
