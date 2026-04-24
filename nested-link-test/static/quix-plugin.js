(function (global) {
  var VERSION = '1.0.0';

  var styles = {
    badge:    'background: #6C63FF; color: #fff; padding: 2px 8px; border-radius: 20px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px;',
    version:  'color: #999; font-size: 10px;',
    success:  'color: #22c55e; font-weight: 600;',
    info:     'color: #6C63FF; font-weight: 600;',
    muted:    'color: #888; font-size: 11px;',
    data:     'color: #f59e0b; font-weight: 600;',
  };

  function log(level, message, data) {
    var style = styles[level] || styles.info;
    if (data !== undefined) {
      console.log('%c Quix %c ' + message, styles.badge, style, data);
    } else {
      console.log('%c Quix %c ' + message, styles.badge, style);
    }
    // Relay structured event to parent portal
    window.parent.postMessage({ type: 'quixplugin-log', level: level, message: message, data: data }, '*');
  }

  var QuixPlugin = {

    // ── Navigation ──────────────────────────────────────────
    _syncRoute: function () {
      var path = window.location.pathname;
      log('info', '⟶ navigate ' + path);
      window.parent.postMessage({ type: 'navigate', path: path }, '*');
    },

    _initNavigation: function () {
      var push = history.pushState.bind(history);
      var replace = history.replaceState.bind(history);

      history.pushState = function () { push.apply(history, arguments); QuixPlugin._syncRoute(); };
      history.replaceState = function () { replace.apply(history, arguments); QuixPlugin._syncRoute(); };

      window.addEventListener('popstate', function () { QuixPlugin._syncRoute(); });
      QuixPlugin._syncRoute();
    },

    // ── Auth Token ──────────────────────────────────────────
    _tokenCallbacks: [],

    onToken: function (callback) {
      this._tokenCallbacks.push(callback);
      return this;
    },

    _handleToken: function (token) {
      log('success', '✓ Auth token received', token.substring(0, 20) + '••••');
      this._tokenCallbacks.forEach(function (fn) { fn(token); });
    },

    _initToken: function () {
      window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'AUTH_TOKEN' && event.data.token) {
          QuixPlugin._handleToken(event.data.token);
        }
      });
      log('muted', '⟳ Requesting auth token...');
      window.parent.postMessage({ type: 'REQUEST_AUTH_TOKEN' }, '*');
    },

    // ── Init ─────────────────────────────────────────────────
    init: function () {
      console.groupCollapsed(
        '%c Quix Plugin SDK %c v' + VERSION,
        styles.badge,
        styles.version
      );
      log('info',    '◎ Initialising');
      this._initNavigation();
      this._initToken();
      log('success', '✓ Ready');
      console.groupEnd();
      return this;
    }

  };

  global.QuixPlugin = QuixPlugin;
})(window);
