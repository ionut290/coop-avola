const { app, BrowserWindow, ipcMain, net, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const dns = require('node:dns').promises;
const dgram = require('node:dgram');
const fs = require('node:fs');
const path = require('node:path');

const APP_URL = 'https://coopavola.eggsnext.cloud/main/functions/home';
const APP_ORIGIN = new URL(APP_URL).origin;
const PRESENCE_ADDRESS = '239.255.42.99';
const PRESENCE_PORT = 32123;
const PRESENCE_INTERVAL_MS = 10 * 1000;
const PRESENCE_EXPIRY_MS = 35 * 1000;
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const UPDATE_FEED = Object.freeze({
  provider: 'github',
  owner: 'ionut290',
  repo: 'coop-avola'
});

let mainWindow;
let attachedPortalContents;
let presenceClientId = '';
let presenceTimer = null;
let presenceSocket = null;
let updateTimer = null;
let updateReady = false;
const presencePeers = new Map();

const DEFAULT_SETTINGS = Object.freeze({
  openBoard: true,
  fullscreen: false,
  hideLeftMenu: false,
  hideRightPanel: false,
  protectDrafts: true
});

function settingsPath() {
  return path.join(app.getPath('userData'), 'desktop-settings.json');
}

function readStoredSettings() {
  try {
    const stored = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    return {
      openBoard: stored.openBoard !== false,
      fullscreen: Boolean(stored.fullscreen),
      hideLeftMenu: Boolean(stored.hideLeftMenu),
      hideRightPanel: Boolean(stored.hideRightPanel),
      protectDrafts: stored.protectDrafts !== false
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function publicSettings() {
  return readStoredSettings();
}

function saveSettings(input) {
  const next = {
    openBoard: Boolean(input?.openBoard),
    fullscreen: Boolean(input?.fullscreen),
    hideLeftMenu: Boolean(input?.hideLeftMenu),
    hideRightPanel: Boolean(input?.hideRightPanel),
    protectDrafts: input?.protectDrafts !== false
  };

  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), { mode: 0o600 });
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setFullScreen(next.fullscreen);
  return publicSettings();
}

function isTrustedUrl(rawUrl) {
  try {
    return new URL(rawUrl).origin === APP_ORIGIN;
  } catch {
    return false;
  }
}

function attachPortalSecurity(contents) {
  attachedPortalContents = contents;

  contents.setWindowOpenHandler(({ url }) => {
    if (isTrustedUrl(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('render-process-gone', (_event, details) => {
    mainWindow?.webContents.send('portal-process-gone', details);
  });

  contents.on('unresponsive', () => {
    mainWindow?.webContents.send('portal-unresponsive');
  });

  contents.on('responsive', () => {
    mainWindow?.webContents.send('portal-responsive');
  });
}

function configureSession() {
  const portalSession = session.fromPartition('coop-avola-manual-login');

  portalSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const allowed = new Set(['geolocation', 'notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write']);
    return typeof requestingOrigin === 'string' && requestingOrigin.startsWith(APP_ORIGIN) && allowed.has(permission);
  });

  portalSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    const allowed = new Set(['geolocation', 'notifications', 'media', 'clipboard-read', 'clipboard-sanitized-write']);
    callback(isTrustedUrl(origin) && allowed.has(permission));
  });

  portalSession.webRequest.onErrorOccurred((details) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!isTrustedUrl(details.url)) return;
    mainWindow.webContents.send('portal-request-error', {
      url: details.url,
      error: details.error,
      resourceType: details.resourceType,
      time: new Date().toISOString()
    });
  });

  portalSession.webRequest.onCompleted((details) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!isTrustedUrl(details.url)) return;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(details.method)) return;
    if (details.statusCode < 200 || details.statusCode >= 300) return;
    mainWindow.webContents.send('portal-mutation-confirmed', {
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      time: new Date().toISOString()
    });
  });
}

function emitPresence(error = null) {
  const now = Date.now();
  for (const [clientId, lastSeen] of presencePeers) {
    if (now - lastSeen > PRESENCE_EXPIRY_MS) presencePeers.delete(clientId);
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('presence-update', error ? {
    ok: false,
    error,
    checkedAt: now
  } : {
    ok: true,
    count: presencePeers.size,
    checkedAt: now,
    scope: 'rete-locale'
  });
}

function sendPresence(action = 'heartbeat') {
  if (!presenceSocket || !presenceClientId) return;
  if (action === 'offline') presencePeers.delete(presenceClientId);
  else presencePeers.set(presenceClientId, Date.now());
  const packet = Buffer.from(JSON.stringify({
    marker: 'coop-avola-desktop-presence-v1',
    action,
    clientId: presenceClientId,
    appVersion: app.getVersion(),
    sentAt: Date.now()
  }));
  presenceSocket.send(packet, PRESENCE_PORT, PRESENCE_ADDRESS, () => {});
  presenceSocket.send(packet, PRESENCE_PORT, '255.255.255.255', () => {});
  if (action !== 'offline') emitPresence();
}

function startPresence(clientId) {
  if (!/^[a-f0-9-]{20,80}$/i.test(clientId)) return false;
  presenceClientId = clientId;
  if (presenceTimer) clearInterval(presenceTimer);
  if (presenceSocket) {
    try { presenceSocket.close(); } catch {}
  }
  presencePeers.clear();
  presencePeers.set(presenceClientId, Date.now());
  presenceSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  presenceSocket.on('message', (packet) => {
    try {
      const message = JSON.parse(packet.toString('utf8'));
      if (message.marker !== 'coop-avola-desktop-presence-v1' || !/^[a-f0-9-]{20,80}$/i.test(message.clientId || '')) return;
      if (message.action === 'offline') presencePeers.delete(message.clientId);
      else presencePeers.set(message.clientId, Date.now());
      emitPresence();
    } catch {}
  });
  presenceSocket.on('error', (error) => emitPresence(`Rete locale non disponibile: ${error.message}`));
  presenceSocket.bind(PRESENCE_PORT, '0.0.0.0', () => {
    try { presenceSocket.setBroadcast(true); } catch {}
    try { presenceSocket.addMembership(PRESENCE_ADDRESS); } catch {}
    sendPresence();
  });
  presenceTimer = setInterval(() => sendPresence(), PRESENCE_INTERVAL_MS);
  return true;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await net.fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function runSpeedTest() {
  const cacheBust = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const latencySamples = [];
  for (let index = 0; index < 3; index += 1) {
    const startedAt = performance.now();
    const response = await fetchWithTimeout(`https://speed.cloudflare.com/__down?bytes=1&cb=${cacheBust}-${index}`, {}, 10000);
    await response.arrayBuffer();
    latencySamples.push(performance.now() - startedAt);
  }

  const downloadStartedAt = performance.now();
  const downloadResponse = await fetchWithTimeout(`https://speed.cloudflare.com/__down?bytes=26214400&cb=${cacheBust}`, {}, 30000);
  const downloadData = await downloadResponse.arrayBuffer();
  const downloadSeconds = Math.max(0.001, (performance.now() - downloadStartedAt) / 1000);
  const download = (downloadData.byteLength * 8) / downloadSeconds / 1_000_000;

  const uploadData = Buffer.alloc(10 * 1024 * 1024);
  const uploadStartedAt = performance.now();
  const uploadResponse = await fetchWithTimeout('https://speed.cloudflare.com/__up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: uploadData
  }, 30000);
  await uploadResponse.arrayBuffer();
  const uploadSeconds = Math.max(0.001, (performance.now() - uploadStartedAt) / 1000);
  const upload = (uploadData.byteLength * 8) / uploadSeconds / 1_000_000;

  if (!Number.isFinite(download) || !Number.isFinite(upload) || download <= 0 || upload <= 0) {
    throw new Error('Misurazione non valida');
  }
  return {
    download,
    upload,
    latency: Math.min(...latencySamples),
    checkedAt: Date.now(),
    provider: 'Cloudflare Speed Test'
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#eef2f5',
    autoHideMenuBar: true,
    title: 'Coop Avola Desktop',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: true
    }
  });

  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    attachPortalSecurity(contents);
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => {
    mainWindow.setFullScreen(Boolean(readStoredSettings().fullscreen));
  });
}

function sendUpdateState(state, details = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('update-state', { state, ...details });
}

async function checkForUpdates() {
  if (!app.isPackaged || process.platform !== 'win32') {
    return { supported: false, state: 'development' };
  }
  try {
    await autoUpdater.checkForUpdates();
    return { supported: true, state: 'checking' };
  } catch (error) {
    sendUpdateState('error', { message: error.message });
    return { supported: true, state: 'error', message: error.message };
  }
}

function configureAutoUpdater() {
  if (!app.isPackaged || process.platform !== 'win32') return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.setFeedURL(UPDATE_FEED);

  autoUpdater.on('checking-for-update', () => sendUpdateState('checking'));
  autoUpdater.on('update-available', (info) => {
    sendUpdateState('available', { version: info.version });
  });
  autoUpdater.on('update-not-available', (info) => {
    sendUpdateState('current', { version: info.version || app.getVersion() });
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateState('downloading', {
      version: progress.version,
      percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0)))
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    updateReady = true;
    sendUpdateState('downloaded', { version: info.version });
  });
  autoUpdater.on('error', (error) => {
    sendUpdateState('error', { message: error.message });
  });

  setTimeout(checkForUpdates, 12 * 1000);
  updateTimer = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL_MS);
}

async function diagnose() {
  const startedAt = Date.now();
  const host = new URL(APP_URL).hostname;
  const result = {
    checkedAt: new Date().toISOString(),
    host,
    dns: { ok: false, address: null, ms: null, error: null },
    server: { ok: false, status: null, ms: null, error: null }
  };

  const dnsStartedAt = Date.now();
  try {
    const answer = await dns.lookup(host);
    result.dns = { ok: true, address: answer.address, ms: Date.now() - dnsStartedAt, error: null };
  } catch (error) {
    result.dns.error = error.message;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let response = await net.fetch(APP_URL, {
      method: 'HEAD',
      cache: 'no-store',
      signal: controller.signal
    });
    if (response.status === 405) {
      response = await net.fetch(APP_URL, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal
      });
    }
    result.server = {
      ok: response.status >= 200 && response.status < 500,
      status: response.status,
      ms: Date.now() - startedAt,
      error: null
    };
  } catch (error) {
    result.server.error = error.name === 'AbortError' ? 'Tempo di risposta scaduto (10 secondi)' : error.message;
  } finally {
    clearTimeout(timeout);
  }

  return result;
}

app.whenReady().then(() => {
  // Sovrascrive le vecchie impostazioni eliminando definitivamente eventuali
  // credenziali protette salvate da versioni precedenti.
  saveSettings(readStoredSettings());
  configureSession();
  createWindow();
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (updateTimer) clearInterval(updateTimer);
  if (presenceTimer) clearInterval(presenceTimer);
  sendPresence('offline');
  if (presenceSocket) {
    try { presenceSocket.close(); } catch {}
  }
});

ipcMain.handle('get-config', () => ({ appUrl: APP_URL, version: app.getVersion() }));
ipcMain.handle('check-for-updates', checkForUpdates);
ipcMain.handle('install-update', () => {
  if (!updateReady) return false;
  setImmediate(() => autoUpdater.quitAndInstall(false, true));
  return true;
});
ipcMain.handle('run-diagnostics', diagnose);
ipcMain.handle('run-speed-test', runSpeedTest);
ipcMain.handle('start-presence', (_event, clientId) => startPresence(String(clientId || '')));
ipcMain.handle('get-settings', () => publicSettings());
ipcMain.handle('save-settings', (_event, settings) => saveSettings(settings));
ipcMain.handle('open-external', (_event, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url);
  return false;
});
ipcMain.handle('restart-portal-process', () => {
  if (!attachedPortalContents || attachedPortalContents.isDestroyed()) return false;
  attachedPortalContents.reload();
  return true;
});
ipcMain.handle('open-devtools', () => {
  if (!attachedPortalContents || attachedPortalContents.isDestroyed()) return false;
  attachedPortalContents.openDevTools({ mode: 'detach' });
  return true;
});
