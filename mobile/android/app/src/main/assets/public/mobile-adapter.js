(() => {
  'use strict';

  if (window.__coopAvolaMobileAdapter) {
    window.__coopAvolaMobileAdapter.refresh();
    return;
  }

  const state = {
    sidebar: null,
    cards: [],
    teamOnly: false,
    selectedJob: '',
    refreshTimer: null
  };

  const normalize = (value) => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const visible = (element) => {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 1 && rect.height > 1;
  };

  const elementText = (element) => {
    const extra = [...element.querySelectorAll('img, [aria-label], [title]')]
      .flatMap((item) => [item.alt, item.getAttribute('aria-label'), item.title])
      .filter(Boolean)
      .join(' ');
    return normalize(`${element.innerText || element.textContent || ''} ${extra}`);
  };

  function installViewport() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      document.head.appendChild(viewport);
    }
    viewport.content = 'width=device-width, initial-scale=1, maximum-scale=3, viewport-fit=cover';
  }

  function installStyles() {
    if (document.getElementById('coop-avola-mobile-style')) return;
    const style = document.createElement('style');
    style.id = 'coop-avola-mobile-style';
    style.textContent = `
      :root { --coop-mobile-green: #16784a; --coop-mobile-bar: 112px; }
      html, body { max-width: 100vw !important; overflow-x: hidden !important; }
      body.coop-mobile-ready { padding-top: calc(var(--coop-mobile-bar) + env(safe-area-inset-top)) !important; }
      #coop-mobile-toolbar {
        position: fixed; z-index: 2147483647; inset: 0 0 auto 0;
        min-height: var(--coop-mobile-bar); padding: calc(7px + env(safe-area-inset-top)) 8px 7px;
        display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 7px;
        background: rgba(255,255,255,.98); border-bottom: 1px solid #cfd9d3;
        box-shadow: 0 3px 14px rgba(0,0,0,.16); font-family: Arial, sans-serif;
      }
      #coop-mobile-toolbar button, #coop-mobile-toolbar input, #coop-mobile-toolbar select {
        min-height: 42px; border: 1px solid #cbd5cf; border-radius: 9px;
        background: #fff; color: #18231d; font: 600 14px Arial, sans-serif;
      }
      #coop-mobile-toolbar button { padding: 8px 11px; }
      #coop-mobile-toolbar button.coop-active { background: var(--coop-mobile-green); color: #fff; border-color: var(--coop-mobile-green); }
      #coop-mobile-name { width: 100%; padding: 8px 10px; font-weight: 500 !important; }
      #coop-mobile-job { grid-column: 1 / -1; width: 100%; padding: 7px 10px; font-weight: 500 !important; }
      [data-coop-mobile-sidebar] {
        position: fixed !important; z-index: 2147483646 !important;
        top: calc(var(--coop-mobile-bar) + env(safe-area-inset-top)) !important;
        bottom: 0 !important; left: 0 !important; width: min(88vw, 380px) !important;
        max-width: none !important; height: auto !important; overflow: auto !important;
        background: #fff !important; transform: translateX(-105%) !important;
        transition: transform .2s ease !important; box-shadow: 8px 0 25px rgba(0,0,0,.22) !important;
      }
      [data-coop-mobile-sidebar].coop-mobile-open { transform: translateX(0) !important; }
      #coop-mobile-scrim { position: fixed; z-index: 2147483645; inset: var(--coop-mobile-bar) 0 0; background: rgba(0,0,0,.32); }
      #coop-mobile-scrim[hidden] { display: none !important; }
      [data-coop-mobile-board] {
        display: flex !important; flex-direction: column !important; align-items: stretch !important;
        width: 100% !important; min-width: 0 !important; max-width: 100vw !important;
        height: auto !important; overflow: visible !important; transform: none !important;
      }
      [data-coop-mobile-card] {
        display: block !important; position: relative !important; inset: auto !important;
        transform: none !important; width: calc(100vw - 16px) !important;
        min-width: 0 !important; max-width: none !important; height: auto !important;
        margin: 8px !important; box-sizing: border-box !important;
      }
      [data-coop-mobile-card].coop-mobile-filtered { display: none !important; }
      @media (orientation: landscape) {
        :root { --coop-mobile-bar: 62px; }
        #coop-mobile-toolbar { grid-template-columns: auto minmax(160px, 1fr) auto minmax(190px, .8fr); }
        #coop-mobile-job { grid-column: auto; }
      }
    `;
    document.head.appendChild(style);
  }

  function findSidebar() {
    const candidates = [...document.querySelectorAll('aside, nav, [class*="sidebar" i], [class*="sidenav" i], [class*="menu" i], div')]
      .filter((element) => {
        if (!visible(element) || element.id === 'coop-mobile-toolbar') return false;
        const rect = element.getBoundingClientRect();
        const controls = element.querySelectorAll('a, button, [role="button"]').length;
        return rect.left < 45 && rect.width >= 130 && rect.width <= 460 && rect.height >= innerHeight * .45 && controls >= 2;
      })
      .sort((a, b) => {
        const score = (element) => {
          const text = normalize(element.innerText);
          return (/commess|lavagna|pianific/.test(text) ? 1000 : 0) + element.querySelectorAll('a, button, [role="button"]').length - element.children.length;
        };
        return score(b) - score(a);
      });
    return candidates[0] || null;
  }

  function findCards() {
    const candidates = [...document.querySelectorAll('article, section, [class*="card" i], [class*="panel" i], div')]
      .filter((element) => {
        if (!visible(element) || element.closest('#coop-mobile-toolbar')) return false;
        const rect = element.getBoundingClientRect();
        const text = normalize(element.innerText);
        return rect.width >= 180 && rect.height >= 90 && rect.height <= 900 && /(^| )note( |$)/.test(text);
      });
    return candidates.filter((element) => !candidates.some((other) => other !== element && element.contains(other)));
  }

  function titleFor(card) {
    const text = String(card.innerText || card.textContent || '').split('\n')
      .map((line) => line.trim()).filter(Boolean);
    return text.find((line) => !/^note$/i.test(line) && !/^nessuna risorsa/i.test(line)) || 'Commessa';
  }

  function updateJobs() {
    const select = document.getElementById('coop-mobile-job');
    if (!select) return;
    const selected = state.selectedJob || select.value;
    const jobs = [...new Set(state.cards.map(titleFor))];
    select.replaceChildren(new Option('Tutte le commesse', ''));
    jobs.forEach((job) => select.add(new Option(job, normalize(job))));
    if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  }

  function applyFilters() {
    const input = document.getElementById('coop-mobile-name');
    const query = normalize(input?.value);
    if (input) localStorage.setItem('coop_avola_mobile_name', input.value.trim());
    for (const card of state.cards) {
      const haystack = elementText(card);
      const matchesName = !query || !state.teamOnly || haystack.includes(query);
      const matchesJob = !state.selectedJob || haystack.includes(state.selectedJob);
      card.classList.toggle('coop-mobile-filtered', !(matchesName && matchesJob));
    }
  }

  function toggleSidebar(force) {
    if (!state.sidebar) state.sidebar = findSidebar();
    if (!state.sidebar) {
      alert('Il menu delle commesse padre non è ancora disponibile. Attendi il caricamento della lavagna.');
      return;
    }
    const open = typeof force === 'boolean' ? force : !state.sidebar.classList.contains('coop-mobile-open');
    state.sidebar.classList.toggle('coop-mobile-open', open);
    document.getElementById('coop-mobile-scrim').hidden = !open;
  }

  function installToolbar() {
    if (document.getElementById('coop-mobile-toolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'coop-mobile-toolbar';
    toolbar.innerHTML = `
      <button id="coop-mobile-menu" type="button" aria-label="Apri commesse padre">☰ Commesse</button>
      <input id="coop-mobile-name" type="search" autocomplete="name" placeholder="Scrivi il tuo nome" />
      <button id="coop-mobile-team" type="button">La mia squadra</button>
      <select id="coop-mobile-job" aria-label="Mostra per commessa"><option value="">Tutte le commesse</option></select>
    `;
    const scrim = document.createElement('div');
    scrim.id = 'coop-mobile-scrim';
    scrim.hidden = true;
    document.body.prepend(scrim);
    document.body.prepend(toolbar);
    document.body.classList.add('coop-mobile-ready');

    const input = toolbar.querySelector('#coop-mobile-name');
    input.value = localStorage.getItem('coop_avola_mobile_name') || '';
    toolbar.querySelector('#coop-mobile-menu').addEventListener('click', () => toggleSidebar());
    toolbar.querySelector('#coop-mobile-team').addEventListener('click', (event) => {
      if (!normalize(input.value)) {
        input.focus();
        alert('Scrivi prima il tuo nome. Poi premi “La mia squadra”.');
        return;
      }
      state.teamOnly = !state.teamOnly;
      event.currentTarget.classList.toggle('coop-active', state.teamOnly);
      applyFilters();
    });
    input.addEventListener('input', applyFilters);
    toolbar.querySelector('#coop-mobile-job').addEventListener('change', (event) => {
      state.selectedJob = event.target.value;
      applyFilters();
    });
    scrim.addEventListener('click', () => toggleSidebar(false));
  }

  function refresh() {
    installViewport();
    installStyles();
    const cards = findCards();
    if (!cards.length) return;
    installToolbar();

    if (state.sidebar && !state.sidebar.isConnected) state.sidebar = null;
    state.sidebar ||= findSidebar();
    if (state.sidebar) {
      state.sidebar.dataset.coopMobileSidebar = 'true';
      if (!state.sidebar.dataset.coopMobileListener) {
        state.sidebar.dataset.coopMobileListener = 'true';
        state.sidebar.addEventListener('click', (event) => {
          if (event.target.closest('a, button, [role="button"]')) setTimeout(() => toggleSidebar(false), 150);
        });
      }
    }

    document.querySelectorAll('[data-coop-mobile-card]').forEach((card) => {
      if (!cards.includes(card)) delete card.dataset.coopMobileCard;
    });
    state.cards = cards;
    cards.forEach((card) => { card.dataset.coopMobileCard = 'true'; });
    const parents = [...new Set(cards.map((card) => card.parentElement).filter(Boolean))];
    const board = parents.sort((a, b) => b.querySelectorAll('[data-coop-mobile-card]').length - a.querySelectorAll('[data-coop-mobile-card]').length)[0];
    if (board) board.dataset.coopMobileBoard = 'true';
    updateJobs();
    applyFilters();
  }

  window.__coopAvolaMobileAdapter = { refresh };
  const observer = new MutationObserver(() => {
    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(refresh, 350);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  refresh();
  setInterval(refresh, 4000);
})();
