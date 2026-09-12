const portal = document.getElementById('portal');
const loading = document.getElementById('loading');
const offlineBanner = document.getElementById('offline-banner');
const updateBanner = document.getElementById('update-banner');
const updateStatusText = document.getElementById('update-status-text');
const installUpdateButton = document.getElementById('install-update');
const diagnostics = document.getElementById('diagnostics');
const scrim = document.getElementById('scrim');
const errorLog = document.getElementById('error-log');
const internetStatus = document.getElementById('internet-status');
const serverStatus = document.getElementById('server-status');
const speedValue = document.getElementById('speed-value');
const usersValue = document.getElementById('users-value');
const saveValue = document.getElementById('save-value');
const pageDetail = document.getElementById('page-detail');
const logEntries = [];
const recentLogKeys = new Map();
let appUrl = '';
const DRAFT_STORAGE_KEY = 'coop_avola_protected_draft_v1';
let connectionWasOffline = false;
let portalMetrics = { connectedUsers: null, presenceOnline: false, lastSavedAt: null, savePending: false, draftProtectedAt: null };
let speedTestRunning = false;
let speedResult = null;
let desktopSettings = null;
let portalAutomationRunning = false;
let boardNavigationAttempted = false;

function renderUpdateState(update) {
  const version = update?.version ? ` ${update.version}` : '';
  installUpdateButton.classList.add('hidden');
  if (update?.state === 'available') {
    updateBanner.classList.remove('hidden');
    updateStatusText.textContent = `Nuova versione${version}: download automatico in corso…`;
  } else if (update?.state === 'downloading') {
    updateBanner.classList.remove('hidden');
    updateStatusText.textContent = `Aggiornamento${version}: download ${update.percent || 0}%`;
  } else if (update?.state === 'downloaded') {
    updateBanner.classList.remove('hidden');
    updateStatusText.textContent = `Aggiornamento${version} pronto.`;
    installUpdateButton.classList.remove('hidden');
  } else if (update?.state === 'current') {
    updateBanner.classList.add('hidden');
  } else if (update?.state === 'error') {
    updateBanner.classList.add('hidden');
    addLog('errore', `Aggiornamento automatico: ${update.message || 'servizio non disponibile'}`);
  }
}

function setStatus(element, state, label) {
  element.className = `status ${state}`;
  element.querySelector('span:last-child').textContent = label;
}

function addLog(kind, message) {
  const key = `${kind}:${String(message)}`;
  const now = Date.now();
  if (now - (recentLogKeys.get(key) || 0) < 5 * 60 * 1000) return;
  recentLogKeys.set(key, now);
  const entry = { time: new Date(), kind, message: String(message) };
  logEntries.unshift(entry);
  if (logEntries.length > 100) logEntries.pop();
  renderLog();
}

function renderLog() {
  errorLog.replaceChildren();
  if (!logEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nessun errore registrato.';
    errorLog.appendChild(empty);
    return;
  }
  for (const item of logEntries) {
    const row = document.createElement('p');
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = `[${item.time.toLocaleTimeString('it-IT')}] `;
    const message = document.createElement('span');
    message.className = item.kind === 'errore' ? 'error' : '';
    message.textContent = item.message;
    row.append(time, message);
    errorLog.appendChild(row);
  }
}

function setDrawer(open) {
  diagnostics.classList.toggle('open', open);
  diagnostics.setAttribute('aria-hidden', String(!open));
  scrim.classList.toggle('hidden', !open);
}

function updateNavigationButtons() {
  document.getElementById('back').disabled = !portal.canGoBack();
  document.getElementById('forward').disabled = !portal.canGoForward();
}

function formatElapsed(timestamp) {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'adesso';
  if (seconds < 60) return `${seconds}s fa`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h fa`;
}

function formatMbps(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return '—';
  return number.toFixed(number < 10 ? 1 : 0);
}

function renderSpeedResult() {
  if (speedTestRunning) return;
  if (!speedResult) {
    speedValue.textContent = '↓— ↑—';
    document.getElementById('speed-detail').textContent = 'Test reale non ancora eseguito';
    return;
  }
  speedValue.textContent = `↓${formatMbps(speedResult.download)} ↑${formatMbps(speedResult.upload)}`;
  document.getElementById('speed-detail').textContent =
    `Download ${formatMbps(speedResult.download)} Mb/s · Upload ${formatMbps(speedResult.upload)} Mb/s · ${formatElapsed(speedResult.checkedAt)}`;
}

function loadSpeedResult() {
  try {
    const stored = JSON.parse(localStorage.getItem('coop_avola_real_speed_v1') || 'null');
    if (Number.isFinite(stored?.download) && Number.isFinite(stored?.upload)) speedResult = stored;
  } catch {}
  renderSpeedResult();
}

async function runRealSpeedTest() {
  if (speedTestRunning) return;
  const consentKey = 'coop_avola_speed_policy_accepted_v2';
  if (localStorage.getItem(consentKey) !== 'yes') {
    const accepted = window.confirm(
      'Il test reale usa il servizio Cloudflare Speed Test e trasferisce dati temporanei per misurare download e upload. Vuoi continuare?'
    );
    if (!accepted) return;
    localStorage.setItem(consentKey, 'yes');
  }

  speedTestRunning = true;
  speedValue.textContent = 'test…';
  document.getElementById('speed-detail').textContent = 'Misurazione reale download e upload…';
  document.getElementById('test-speed').disabled = true;

  try {
    speedResult = await window.avolaDesktop.runSpeedTest();
    localStorage.setItem('coop_avola_real_speed_v1', JSON.stringify(speedResult));
    localStorage.removeItem('coop_avola_speed_failure_at');
    addLog('info', `Speed test completato: ↓ ${formatMbps(speedResult.download)} Mb/s · ↑ ${formatMbps(speedResult.upload)} Mb/s.`);
  } catch (error) {
    localStorage.setItem('coop_avola_speed_failure_at', String(Date.now()));
    addLog('errore', `Speed test non riuscito: ${error.message}`);
  } finally {
    speedTestRunning = false;
    document.getElementById('test-speed').disabled = false;
    renderSpeedResult();
  }
}

function renderPortalMetrics() {
  if (portalMetrics.presenceOnline && Number.isInteger(portalMetrics.connectedUsers)) {
    usersValue.textContent = String(portalMetrics.connectedUsers);
    document.getElementById('users-detail').textContent = `${portalMetrics.connectedUsers} PC con Coop Avola Desktop aperta · rete locale`;
  } else {
    usersValue.textContent = 'n/d';
    document.getElementById('users-detail').textContent = 'Rilevamento sulla rete locale non disponibile';
  }

  if (portalMetrics.savePending) {
    saveValue.textContent = 'in corso…';
    document.getElementById('save-detail').textContent = 'Salvataggio richiesto, in attesa di conferma';
  } else if (portalMetrics.lastSavedAt) {
    const elapsed = formatElapsed(portalMetrics.lastSavedAt);
    saveValue.textContent = elapsed;
    document.getElementById('save-detail').textContent = `${elapsed} · ${new Date(portalMetrics.lastSavedAt).toLocaleString('it-IT')}`;
  } else {
    saveValue.textContent = '—';
    document.getElementById('save-detail').textContent = 'Non ancora rilevato in questa sessione';
  }

  const draftDetail = document.getElementById('draft-detail');
  if (!desktopSettings?.protectDrafts) {
    draftDetail.textContent = 'Disattivata nelle impostazioni';
  } else if (portalMetrics.draftProtectedAt) {
    draftDetail.textContent = `Bozza locale protetta · ${formatElapsed(portalMetrics.draftProtectedAt)}`;
  } else {
    draftDetail.textContent = 'Attiva · nessuna modifica in attesa';
  }
}

function readProtectedDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

function clearProtectedDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  portalMetrics.draftProtectedAt = null;
  renderPortalMetrics();
}

async function captureProtectedDraft() {
  if (!desktopSettings?.protectDrafts) return;
  try {
    const draft = await portal.executeJavaScript(`(() => {
      const monitor = window.__coopAvolaDesktopMonitor;
      if (!monitor?.dirtyAt || monitor.dirtyAt <= (monitor.lastSavedAt || 0)) return null;
      const selectorFor = (element) => {
        if (element.id) return '#' + CSS.escape(element.id);
        if (element.name) return element.tagName.toLowerCase() + '[name="' + CSS.escape(element.name) + '"]';
        const parts = [];
        let current = element;
        while (current && current !== document.body && parts.length < 7) {
          const tag = current.tagName.toLowerCase();
          const siblings = [...current.parentElement.children].filter((item) => item.tagName === current.tagName);
          parts.unshift(tag + (siblings.length > 1 ? ':nth-of-type(' + (siblings.indexOf(current) + 1) + ')' : ''));
          current = current.parentElement;
        }
        return 'body > ' + parts.join(' > ');
      };
      const sensitive = /password|passwd|token|secret/i;
      const fields = [...document.querySelectorAll('input, textarea, select, [contenteditable="true"]')]
        .filter((element) => element.type !== 'password' && !sensitive.test(element.name || '') && !sensitive.test(element.id || ''))
        .map((element) => ({
          selector: selectorFor(element),
          kind: element.matches('[contenteditable="true"]') ? 'editable' : element.tagName.toLowerCase(),
          type: element.type || '',
          value: element.matches('[contenteditable="true"]') ? element.innerHTML : element.value,
          checked: typeof element.checked === 'boolean' ? element.checked : null
        }))
        .filter((item) => item.selector && String(item.value || '').length <= 20000)
        .slice(0, 500);
      return {
        url: location.href,
        title: document.title,
        capturedAt: Date.now(),
        dirtyAt: monitor.dirtyAt,
        lastSavedAt: monitor.lastSavedAt || null,
        scrollX,
        scrollY,
        fields
      };
    })()`);
    if (!draft) return;
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    portalMetrics.draftProtectedAt = draft.capturedAt;
    renderPortalMetrics();
  } catch (error) {
    if (!/destroyed|navigation|closed/i.test(error.message)) addLog('errore', `Protezione bozza: ${error.message}`);
  }
}

async function restoreProtectedDraft() {
  if (!desktopSettings?.protectDrafts) return false;
  const draft = readProtectedDraft();
  if (!draft?.fields?.length) return false;
  try {
    const payload = JSON.stringify(draft);
    const result = await portal.executeJavaScript(`(() => {
      const draft = ${payload};
      const current = new URL(location.href);
      const saved = new URL(draft.url);
      if (current.origin !== saved.origin || current.pathname !== saved.pathname) return { restored: 0, reason: 'pagina-diversa' };
      const monitor = window.__coopAvolaDesktopMonitor;
      if ((monitor?.lastSavedAt || 0) >= draft.dirtyAt) return { restored: 0, reason: 'gia-salvata' };
      let restored = 0;
      for (const item of draft.fields) {
        let element;
        try { element = document.querySelector(item.selector); } catch { continue; }
        if (!element || element.type === 'password') continue;
        if (item.kind === 'editable') element.innerHTML = item.value || '';
        else {
          const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
            : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          if (setter) setter.call(element, item.value ?? '');
          else element.value = item.value ?? '';
          if (item.checked !== null && 'checked' in element) element.checked = item.checked;
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        restored += 1;
      }
      scrollTo(draft.scrollX || 0, draft.scrollY || 0);
      if (monitor && restored) monitor.dirtyAt = draft.dirtyAt;
      return { restored, reason: restored ? 'ripristinata' : 'campi-non-trovati' };
    })()`);
    if (result?.reason === 'gia-salvata') clearProtectedDraft();
    if (result?.restored) {
      portalMetrics.draftProtectedAt = draft.capturedAt;
      renderPortalMetrics();
      addLog('info', `Ripristinata automaticamente la bozza locale (${result.restored} campi).`);
      return true;
    }
  } catch (error) {
    if (!/destroyed|navigation|closed/i.test(error.message)) addLog('errore', `Ripristino bozza: ${error.message}`);
  }
  return false;
}

function hasProtectedDraft() {
  const draft = readProtectedDraft();
  return Boolean(draft?.dirtyAt && draft.dirtyAt > (draft.lastSavedAt || 0));
}

async function confirmRiskyReload(action) {
  await captureProtectedDraft();
  if (!hasProtectedDraft()) return true;
  return window.confirm(`Ci sono modifiche non ancora confermate dal server. Una copia locale è stata protetta, ma ${action} potrebbe perdere elementi della lavagna. Vuoi continuare?`);
}

async function installPortalMonitor() {
  try {
    await portal.executeJavaScript(`(() => {
      if (window.__coopAvolaDesktopMonitor) return true;
      const storageKey = '__coop_avola_last_saved_at';
      const activityKey = '__coop_avola_last_activity_at';
      const monitor = window.__coopAvolaDesktopMonitor = {
        pendingAt: null,
        lastSavedAt: Number(localStorage.getItem(storageKey)) || null,
        startedAt: Date.now(),
        lastActivityAt: Number(sessionStorage.getItem(activityKey)) || Date.now(),
        dirtyAt: null
      };
      monitor.confirmSaved = () => {
        monitor.lastSavedAt = Date.now();
        monitor.pendingAt = null;
        localStorage.setItem(storageKey, String(monitor.lastSavedAt));
        return monitor.lastSavedAt;
      };
      document.addEventListener('click', (event) => {
        const control = event.target.closest('button, [role="button"], input[type="submit"]');
        if (!control) return;
        const label = (control.innerText || control.value || control.getAttribute('aria-label') || '').trim().toLowerCase();
        if (/^salva(?:$|\\s)/.test(label)) monitor.pendingAt = Date.now();
      }, true);
      const noteActivity = () => {
        monitor.lastActivityAt = Date.now();
        sessionStorage.setItem(activityKey, String(monitor.lastActivityAt));
      };
      const noteDirty = () => {
        monitor.dirtyAt = Date.now();
      };
      for (const eventName of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        document.addEventListener(eventName, noteActivity, { capture: true, passive: true });
      }
      for (const eventName of ['input', 'change', 'drop']) {
        document.addEventListener(eventName, noteDirty, { capture: true, passive: true });
      }
      return true;
    })()`);
  } catch (error) {
    addLog('errore', `Monitor lavagna non disponibile: ${error.message}`);
  }
}

function showSettingsMessage(message, isError = false) {
  const element = document.getElementById('settings-message');
  element.textContent = message;
  element.classList.toggle('error', isError);
}

function populateSettings(settings) {
  desktopSettings = settings;
  document.getElementById('setting-open-board').checked = Boolean(settings.openBoard);
  document.getElementById('setting-fullscreen').checked = Boolean(settings.fullscreen);
  document.getElementById('setting-hide-left').checked = Boolean(settings.hideLeftMenu);
  document.getElementById('setting-hide-right').checked = Boolean(settings.hideRightPanel);
  document.getElementById('setting-protect-drafts').checked = settings.protectDrafts !== false;
}

function collectSettings() {
  return {
    openBoard: document.getElementById('setting-open-board').checked,
    fullscreen: document.getElementById('setting-fullscreen').checked,
    hideLeftMenu: document.getElementById('setting-hide-left').checked,
    hideRightPanel: document.getElementById('setting-hide-right').checked,
    protectDrafts: document.getElementById('setting-protect-drafts').checked
  };
}

async function loadSettings() {
  try {
    populateSettings(await window.avolaDesktop.getSettings());
  } catch (error) {
    showSettingsMessage(`Impostazioni non disponibili: ${error.message}`, true);
  }
}

async function saveDesktopSettings() {
  try {
    const values = collectSettings();
    const saved = await window.avolaDesktop.saveSettings(values);
    populateSettings(saved);
    boardNavigationAttempted = false;
    showSettingsMessage('Impostazioni salvate e applicate.');
    await runPortalAutomation();
  } catch (error) {
    showSettingsMessage(error.message, true);
  }
}

async function applyPortalLayout() {
  if (!desktopSettings) return null;
  const options = JSON.stringify({
    openBoard: desktopSettings.openBoard && !boardNavigationAttempted,
    hideLeftMenu: desktopSettings.hideLeftMenu,
    hideRightPanel: desktopSettings.hideRightPanel
  });
  const result = await portal.executeJavaScript(`(() => {
    const options = ${options};
    const visible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const text = (element) => (element.innerText || element.textContent || '').trim();
    const passwordVisible = [...document.querySelectorAll('input[type="password"]')].some(visible);
    const boardActive = /lavagna\s+pianificazione/i.test(document.body.innerText || '');
    let boardClicked = false;
    if (!passwordVisible && !boardActive && options.openBoard) {
      const boardControl = [...document.querySelectorAll('a, button, [role="button"]')]
        .find((element) => visible(element) && /^lavagna$/i.test(text(element)));
      if (boardControl) {
        boardControl.click();
        boardClicked = true;
      }
    }
    const restore = (side) => {
      for (const element of document.querySelectorAll('[data-coop-avola-hidden="' + side + '"]')) {
        element.style.display = element.dataset.coopAvolaDisplay || '';
        delete element.dataset.coopAvolaHidden;
        delete element.dataset.coopAvolaDisplay;
      }
    };
    const hideSide = (side, labelPattern) => {
      restore(side);
      const candidates = [...document.querySelectorAll('div, aside, nav, section')]
        .filter((element) => visible(element) && labelPattern.test(text(element).split('\\n')[0] || ''));
      let best = null;
      for (const start of candidates) {
        let element = start;
        for (let level = 0; element && level < 7; level += 1, element = element.parentElement) {
          const rect = element.getBoundingClientRect();
          const atEdge = side === 'left' ? rect.left < 40 : rect.right > innerWidth - 40;
          if (atEdge && rect.width >= 140 && rect.width <= 420 && rect.height >= innerHeight * 0.55) {
            if (!best || rect.height > best.getBoundingClientRect().height) best = element;
          }
        }
      }
      if (best) {
        best.dataset.coopAvolaDisplay = best.style.display || '';
        best.dataset.coopAvolaHidden = side;
        best.style.setProperty('display', 'none', 'important');
        return true;
      }
      return false;
    };
    const leftHidden = options.hideLeftMenu ? hideSide('left', /^(preferiti|menu)$/i) : (restore('left'), false);
    const rightHidden = options.hideRightPanel ? hideSide('right', /^legenda$/i) : (restore('right'), false);
    return { passwordVisible, boardClicked, leftHidden, rightHidden };
  })()`);
  if (result?.boardClicked) boardNavigationAttempted = true;
  return result;
}

async function runPortalAutomation() {
  if (portalAutomationRunning || !desktopSettings) return;
  portalAutomationRunning = true;
  try {
    await applyPortalLayout();
  } catch (error) {
    if (!/destroyed|navigation|closed/i.test(error.message)) addLog('errore', `Automazione Lavagna: ${error.message}`);
  } finally {
    portalAutomationRunning = false;
  }
}

async function pollPortalMetrics() {
  try {
    const metrics = await portal.executeJavaScript(`(() => {
      const monitor = window.__coopAvolaDesktopMonitor || {};
      let savePending = Boolean(monitor.pendingAt);
      if (savePending && Date.now() - monitor.pendingAt > 30000) {
        monitor.pendingAt = null;
        savePending = false;
      }
      return { lastSavedAt: monitor.lastSavedAt || null, savePending };
    })()`);
    portalMetrics = { ...portalMetrics, ...metrics };
    renderPortalMetrics();
  } catch {
    portalMetrics = { ...portalMetrics, lastSavedAt: null, savePending: false };
    renderPortalMetrics();
  }
}

async function runDiagnostics() {
  setStatus(internetStatus, 'pending', 'Internet: verifica…');
  setStatus(serverStatus, 'pending', 'Server: verifica…');
  const result = await window.avolaDesktop.runDiagnostics();
  const browserOnline = navigator.onLine;
  const internetOk = browserOnline && result.dns.ok;

  setStatus(internetStatus, internetOk ? 'ok' : 'error', internetOk ? 'Internet: online' : 'Internet: assente');
  setStatus(serverStatus, result.server.ok ? 'ok' : 'error', result.server.ok ? `Server: HTTP ${result.server.status}` : 'Server: non raggiungibile');
  if (result.server.ok && result.server.ms != null) {
    setStatus(serverStatus, 'ok', `Server: ${result.server.status} · ${result.server.ms} ms`);
  }
  document.getElementById('dns-detail').textContent = result.dns.ok ? `${result.dns.address} · ${result.dns.ms} ms` : (result.dns.error || 'Non disponibile');
  document.getElementById('server-detail').textContent = result.server.ok ? `HTTP ${result.server.status} · ${result.server.ms} ms` : (result.server.error || 'Non disponibile');
  document.getElementById('last-check').textContent = `Ultima verifica: ${new Date(result.checkedAt).toLocaleString('it-IT')}`;
  offlineBanner.classList.toggle('hidden', internetOk);
  if (!internetOk) connectionWasOffline = true;
  if (internetOk && connectionWasOffline) {
    connectionWasOffline = false;
    addLog('info', 'Connessione ripristinata: la lavagna è rimasta aperta senza ricaricarsi.');
  }
}

window.addEventListener('DOMContentLoaded', async () => {
  const config = await window.avolaDesktop.getConfig();
  appUrl = config.appUrl;
  document.getElementById('version-detail').textContent = config.version;
  portal.src = appUrl;
  await loadSettings();
  let clientId = localStorage.getItem('coop_avola_desktop_client_id');
  if (!/^[a-f0-9-]{20,80}$/i.test(clientId || '')) {
    clientId = crypto.randomUUID();
    localStorage.setItem('coop_avola_desktop_client_id', clientId);
  }
  window.avolaDesktop.startPresence(clientId);
  runDiagnostics();
  setInterval(runDiagnostics, 15000);
  loadSpeedResult();
  setInterval(renderSpeedResult, 1000);
  setInterval(() => {
    const accepted = localStorage.getItem('coop_avola_speed_policy_accepted_v2') === 'yes';
    const stale = !speedResult || Date.now() - speedResult.checkedAt > 10 * 60 * 1000;
    const lastFailureAt = Number(localStorage.getItem('coop_avola_speed_failure_at')) || 0;
    const retryAllowed = Date.now() - lastFailureAt > 30 * 60 * 1000;
    if (accepted && stale && retryAllowed && navigator.onLine) runRealSpeedTest();
  }, 60 * 1000);
  setInterval(renderPortalMetrics, 1000);
  setInterval(pollPortalMetrics, 3000);
  setInterval(captureProtectedDraft, 5000);
  setInterval(runPortalAutomation, 3000);
});

window.addEventListener('online', runDiagnostics);
window.addEventListener('offline', runDiagnostics);

portal.addEventListener('did-start-loading', () => {
  loading.classList.remove('hidden');
  pageDetail.textContent = 'Caricamento';
});

portal.addEventListener('did-stop-loading', () => {
  loading.classList.add('hidden');
  pageDetail.textContent = 'Operativa';
  updateNavigationButtons();
});

portal.addEventListener('dom-ready', async () => {
  await installPortalMonitor();
  await restoreProtectedDraft();
  await pollPortalMetrics();
  await runPortalAutomation();
});

portal.addEventListener('did-navigate', () => {
  boardNavigationAttempted = false;
  updateNavigationButtons();
});
portal.addEventListener('did-navigate-in-page', updateNavigationButtons);

portal.addEventListener('did-fail-load', (event) => {
  if (event.errorCode === -3) return;
  const detail = `${event.errorDescription} (${event.errorCode}) — ${event.validatedURL || appUrl}`;
  addLog('errore', detail);
  pageDetail.textContent = 'Errore caricamento';
  setDrawer(true);
});

portal.addEventListener('console-message', (event) => {
  if (event.level >= 2) addLog('errore', `Pagina: ${event.message}`);
});

document.getElementById('back').addEventListener('click', async () => {
  if (portal.canGoBack() && await confirmRiskyReload('il ritorno alla pagina precedente')) portal.goBack();
});
document.getElementById('forward').addEventListener('click', async () => {
  if (portal.canGoForward() && await confirmRiskyReload('il passaggio alla pagina successiva')) portal.goForward();
});
document.getElementById('home').addEventListener('click', async () => {
  if (await confirmRiskyReload('il ritorno alla pagina iniziale')) portal.loadURL(appUrl);
});
document.getElementById('reload').addEventListener('click', async () => {
  if (await confirmRiskyReload('la ricarica')) portal.reload();
});
document.getElementById('tools').addEventListener('click', () => setDrawer(true));
document.getElementById('close-tools').addEventListener('click', () => setDrawer(false));
scrim.addEventListener('click', () => setDrawer(false));
internetStatus.addEventListener('click', () => { setDrawer(true); runDiagnostics(); });
serverStatus.addEventListener('click', () => { setDrawer(true); runDiagnostics(); });
document.getElementById('speed-status').addEventListener('click', () => setDrawer(true));
document.getElementById('users-status').addEventListener('click', () => setDrawer(true));
document.getElementById('save-status').addEventListener('click', () => setDrawer(true));
document.getElementById('diagnose-now').addEventListener('click', runDiagnostics);
document.getElementById('test-speed').addEventListener('click', runRealSpeedTest);
document.getElementById('save-settings').addEventListener('click', () => saveDesktopSettings());
document.getElementById('hard-reload').addEventListener('click', async () => {
  if (await confirmRiskyReload('la ricarica completa')) portal.reloadIgnoringCache();
});
document.getElementById('restart').addEventListener('click', async () => {
  if (!(await confirmRiskyReload('il riavvio'))) return;
  addLog('info', 'Riavvio del portale richiesto.');
  await window.avolaDesktop.restartPortalProcess();
});
document.getElementById('check-update').addEventListener('click', async () => {
  const button = document.getElementById('check-update');
  button.disabled = true;
  button.textContent = 'Verifica in corso…';
  try {
    const result = await window.avolaDesktop.checkForUpdates();
    if (result?.supported === false) addLog('info', 'Gli aggiornamenti automatici sono attivi nella versione Windows installata.');
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = 'Verifica aggiornamenti';
    }, 1500);
  }
});
installUpdateButton.addEventListener('click', async () => {
  installUpdateButton.disabled = true;
  updateStatusText.textContent = 'Protezione del lavoro e riavvio…';
  await captureProtectedDraft();
  const started = await window.avolaDesktop.installUpdate();
  if (!started) {
    installUpdateButton.disabled = false;
    updateStatusText.textContent = 'Aggiornamento non ancora pronto. Riprova tra poco.';
  }
});
document.getElementById('devtools').addEventListener('click', () => window.avolaDesktop.openDevTools());
document.getElementById('clear-log').addEventListener('click', () => { logEntries.length = 0; renderLog(); });
document.getElementById('copy-log').addEventListener('click', async () => {
  const text = logEntries.map((e) => `[${e.time.toISOString()}] ${e.kind.toUpperCase()}: ${e.message}`).join('\n') || 'Nessun errore registrato.';
  await navigator.clipboard.writeText(text);
});

window.avolaDesktop.onRequestError((details) => {
  addLog('errore', `${details.resourceType}: ${details.error} — ${details.url}`);
});
window.avolaDesktop.onMutationConfirmed(async (details) => {
  try {
    const confirmedAt = await portal.executeJavaScript(`(() => {
      const monitor = window.__coopAvolaDesktopMonitor;
      if (!monitor?.pendingAt || Date.now() - monitor.pendingAt > 30000) return null;
      return monitor.confirmSaved();
    })()`);
    if (confirmedAt) {
      portalMetrics.lastSavedAt = Number(confirmedAt);
      portalMetrics.savePending = false;
      renderPortalMetrics();
      clearProtectedDraft();
    }
  } catch (error) {
    addLog('errore', `Conferma salvataggio non leggibile: ${error.message}`);
  }
});
window.avolaDesktop.onPresenceUpdate((result) => {
  if (result.ok && Number.isInteger(result.count)) {
    portalMetrics.connectedUsers = result.count;
    portalMetrics.presenceOnline = true;
  } else {
    portalMetrics.connectedUsers = null;
    portalMetrics.presenceOnline = false;
    if (result.error) addLog('errore', `Presenza desktop: ${result.error}`);
  }
  renderPortalMetrics();
});
window.avolaDesktop.onProcessGone((details) => {
  addLog('errore', `Il processo della pagina si è chiuso: ${details.reason}`);
  pageDetail.textContent = 'Processo interrotto';
  setDrawer(true);
});
window.avolaDesktop.onUnresponsive(() => {
  addLog('errore', 'La pagina non risponde. È possibile riavviare il portale dalla diagnosi.');
  pageDetail.textContent = 'Non risponde';
  setDrawer(true);
});
window.avolaDesktop.onResponsive(() => {
  addLog('info', 'La pagina ha ripreso a rispondere.');
  pageDetail.textContent = 'Operativa';
});
window.avolaDesktop.onUpdateState(renderUpdateState);
