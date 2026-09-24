/*
 * App shell: view registry, icon navigation, file loading.
 * The config file is read with FileReader only – nothing leaves the browser.
 */
(function (root) {
  'use strict';

  const Forge = (root.Forge = root.Forge || {});

  /* ---------- View registry ---------- */

  const views = [];

  Forge.views = {
    /**
     * Registers a navigation entry.
     * @param {{id: string, label: string, icon: string, render: function(Config): Node}} view
     */
    register: function (view) {
      views.push(view);
    },
    all: function () {
      return views.slice();
    },
  };

  /* ---------- State ---------- */

  const state = {
    config: null,
    fileName: null,
    viewId: null,
  };

  /* ---------- Bootstrapping (called after all view scripts loaded) ---------- */

  Forge.start = function () {
    const ui = Forge.ui;
    const h = ui.h;

    const nav = document.getElementById('nav');
    const main = document.getElementById('main');
    const fileInput = document.getElementById('file-input');
    const title = document.getElementById('topbar-title');
    const meta = document.getElementById('topbar-meta');
    const themeToggle = document.getElementById('theme-toggle');

    state.viewId = viewFromHash() || (views[0] && views[0].id);

    views.forEach(function (view) {
      nav.appendChild(h('a', {
        class: 'nav-item',
        href: '#' + view.id,
        'data-view': view.id,
        title: view.label,
        'aria-label': view.label,
      }, h('span', { class: 'nav-icon', html: view.icon }), h('span', { class: 'nav-label' }, view.label)));
    });

    document.querySelectorAll('[data-action="open-file"]').forEach(function (btn) {
      btn.addEventListener('click', function () { fileInput.click(); });
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) loadFile(fileInput.files[0]);
      fileInput.value = '';
    });

    themeToggle.addEventListener('click', function () {
      setTheme(isDarkActive() ? 'light' : 'dark');
    });
    syncThemeToggleLabel();

    root.addEventListener('hashchange', function () {
      const id = viewFromHash();
      if (id) {
        state.viewId = id;
        render();
      }
    });

    // Drag & drop anywhere on the page.
    let dragDepth = 0;
    document.addEventListener('dragenter', function (e) {
      e.preventDefault();
      dragDepth++;
      document.body.classList.add('dragging');
    });
    document.addEventListener('dragleave', function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) document.body.classList.remove('dragging');
    });
    document.addEventListener('dragover', function (e) { e.preventDefault(); });
    document.addEventListener('drop', function (e) {
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging');
      const file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    function isDarkActive() {
      const theme = document.documentElement.dataset.theme;
      return theme === 'dark' || (!theme && root.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem('forge-theme', theme); } catch (e) { /* localStorage unavailable */ }
      syncThemeToggleLabel();
    }

    function syncThemeToggleLabel() {
      const label = isDarkActive() ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggle.title = label;
      themeToggle.setAttribute('aria-label', label);
    }

    function viewFromHash() {
      const id = root.location.hash.slice(1);
      return views.some(function (v) { return v.id === id; }) ? id : null;
    }

    function loadFile(file) {
      const reader = new FileReader();
      reader.onload = function () {
        try {
          state.config = Forge.parser.parseConfig(reader.result);
          state.fileName = file.name;
        } catch (err) {
          state.config = null;
          showError('Could not parse "' + file.name + '": ' + err.message);
          return;
        }
        if (!state.config.values.size) {
          state.config = null;
          showError('"' + file.name + '" contains no icom OS configuration entries.');
          return;
        }
        render();
      };
      reader.onerror = function () { showError('Could not read "' + file.name + '".'); };
      reader.readAsText(file);
    }

    function showError(message) {
      render();
      main.prepend(h('div', { class: 'alert', role: 'alert' }, message));
    }

    function render() {
      nav.querySelectorAll('.nav-item').forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('data-view') === state.viewId);
      });

      main.replaceChildren();
      document.body.classList.toggle('has-config', !!state.config);

      if (!state.config) {
        title.textContent = 'INSYS Forge';
        meta.replaceChildren();
        main.appendChild(emptyState());
        return;
      }

      const view = views.find(function (v) { return v.id === state.viewId; }) || views[0];
      const hostname = state.config.get('administration.hostnames.hostname');
      title.textContent = view.label;
      meta.replaceChildren.apply(meta, [
        hostname ? h('span', { class: 'meta-host' }, hostname) : null,
        h('span', { class: 'meta-file', title: state.fileName }, state.fileName),
        state.config.warnings.length
          ? h('span', { class: 'meta-warn', title: state.config.warnings.map(function (w) { return 'Line ' + w.line + ': ' + w.message + ' (' + w.text + ')'; }).join('\n') },
            state.config.warnings.length + ' parser warning' + (state.config.warnings.length > 1 ? 's' : ''))
          : null,
      ].filter(Boolean));

      main.appendChild(view.render(state.config));
      document.title = (hostname ? hostname + ' · ' : '') + view.label + ' · INSYS Forge';
    }

    function emptyState() {
      return h('div', { class: 'empty-state' },
        h('div', { class: 'dropzone' },
          h('div', { class: 'dropzone-icon', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/></svg>' }),
          h('h1', null, 'Open an icom OS config export'),
          h('p', null, 'Drop the exported ', h('code', null, '.txt'), ' file here or choose it from disk.'),
          h('button', { class: 'btn btn-primary', type: 'button', onclick: function () { fileInput.click(); } }, 'Choose file'),
          h('p', { class: 'privacy' }, 'The file is parsed locally in your browser and is never uploaded.')));
    }

    render();
  };
})(window);
