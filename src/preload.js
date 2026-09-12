const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('avolaDesktop', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  runDiagnostics: () => ipcRenderer.invoke('run-diagnostics'),
  runSpeedTest: () => ipcRenderer.invoke('run-speed-test'),
  startPresence: (clientId) => ipcRenderer.invoke('start-presence', clientId),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  restartPortalProcess: () => ipcRenderer.invoke('restart-portal-process'),
  openDevTools: () => ipcRenderer.invoke('open-devtools'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onRequestError: (callback) => ipcRenderer.on('portal-request-error', (_event, payload) => callback(payload)),
  onMutationConfirmed: (callback) => ipcRenderer.on('portal-mutation-confirmed', (_event, payload) => callback(payload)),
  onPresenceUpdate: (callback) => ipcRenderer.on('presence-update', (_event, payload) => callback(payload)),
  onProcessGone: (callback) => ipcRenderer.on('portal-process-gone', (_event, payload) => callback(payload)),
  onUnresponsive: (callback) => ipcRenderer.on('portal-unresponsive', callback),
  onResponsive: (callback) => ipcRenderer.on('portal-responsive', callback),
  onUpdateState: (callback) => ipcRenderer.on('update-state', (_event, payload) => callback(payload))
});
