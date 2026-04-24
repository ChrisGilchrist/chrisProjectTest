(function (global) {
  const QuixPlugin = {

    // ── Navigation ──────────────────────────────────────────
    _syncRoute: function () {
      window.parent.postMessage({ type: 'navigate', path: window.location.pathname }, '*');
    },

    _initNavigation: function () {
      const push = history.pushState.bind(history);
      const replace = history.replaceState.bind(history);

      history.pushState = function (...args) { push(...args); QuixPlugin._syncRoute(); };
      history.replaceState = function (...args) { replace(...args); QuixPlugin._syncRoute(); };

      window.addEventListener('popstate', () => QuixPlugin._syncRoute());
      QuixPlugin._syncRoute();
    },

    // ── Auth Token ──────────────────────────────────────────
    _tokenCallbacks: [],

    onToken: function (callback) {
      this._tokenCallbacks.push(callback);
      return this;
    },

    _handleToken: function (token) {
      this._tokenCallbacks.forEach(fn => fn(token));
    },

    _initToken: function () {
      function messageHandler(event) {
        if (event.data?.type !== 'AUTH_TOKEN' || !event.data.token) return;
        QuixPlugin._handleToken(event.data.token);
      }
      window.addEventListener('message', messageHandler);
      window.parent.postMessage({ type: 'REQUEST_AUTH_TOKEN' }, '*');
    },

    // ── Init ─────────────────────────────────────────────────
    init: function () {
      this._initNavigation();
      this._initToken();
      return this;
    }

  };

  global.QuixPlugin = QuixPlugin;
})(window);
