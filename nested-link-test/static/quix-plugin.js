(function (global) {
  const QuixPlugin = {

    _log: function (emoji, label, data) {
      const badge = 'background: #1976d2; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;';
      const text = 'color: #1976d2; font-weight: bold;';

      // Log inside iframe context
      if (data !== undefined) {
        console.log('%c QuixPlugin %c ' + emoji + ' ' + label, badge, text, data);
      } else {
        console.log('%c QuixPlugin %c ' + emoji + ' ' + label, badge, text);
      }

      // Relay to parent so it shows in the main page console
      window.parent.postMessage({ type: 'quixplugin-log', emoji: emoji, label: label, data: data }, '*');
    },

    // ── Navigation ──────────────────────────────────────────
    _syncRoute: function () {
      const path = window.location.pathname;
      QuixPlugin._log('📍', 'navigate →', path);
      window.parent.postMessage({ type: 'navigate', path: path }, '*');
    },

    _initNavigation: function () {
      const push = history.pushState.bind(history);
      const replace = history.replaceState.bind(history);

      history.pushState = function (...args) { push(...args); QuixPlugin._syncRoute(); };
      history.replaceState = function (...args) { replace(...args); QuixPlugin._syncRoute(); };

      window.addEventListener('popstate', () => QuixPlugin._syncRoute());
      QuixPlugin._log('🧭', 'Navigation sync ready');
      QuixPlugin._syncRoute();
    },

    // ── Auth Token ──────────────────────────────────────────
    _tokenCallbacks: [],

    onToken: function (callback) {
      this._tokenCallbacks.push(callback);
      return this;
    },

    _handleToken: function (token) {
      QuixPlugin._log('🔑', 'Token received', token.substring(0, 40) + '...');
      this._tokenCallbacks.forEach(fn => fn(token));
    },

    _initToken: function () {
      function messageHandler(event) {
        if (event.data?.type !== 'AUTH_TOKEN' || !event.data.token) return;
        QuixPlugin._handleToken(event.data.token);
      }
      window.addEventListener('message', messageHandler);
      QuixPlugin._log('🔐', 'Requesting token from parent...');
      window.parent.postMessage({ type: 'REQUEST_AUTH_TOKEN' }, '*');
    },

    // ── Init ─────────────────────────────────────────────────
    init: function () {
      console.group('%c QuixPlugin SDK ', 'background: #1976d2; color: white; padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 11px;');
      QuixPlugin._log('🚀', 'Initialising...');
      this._initNavigation();
      this._initToken();
      QuixPlugin._log('✅', 'Ready');
      console.groupEnd();
      return this;
    }

  };

  global.QuixPlugin = QuixPlugin;
})(window);
