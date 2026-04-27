(function (global) {
  var VERSION = '1.0.0';

  var styles = {
    badge:   'background: #0064ff; color: #fff; padding: 2px 8px; border-radius: 20px; font-weight: 700; font-size: 11px; letter-spacing: 0.5px;',
    version: 'color: #999; font-size: 10px;',
    success: 'color: #22c55e; font-weight: 600;',
    info:    'color: #0064ff; font-weight: 600;',
    muted:   'color: #888; font-size: 11px;',
  };

  function log(level, message, data) {
    var style = styles[level] || styles.info;
    if (data !== undefined) {
      console.log('%c Quix %c ' + message, styles.badge, style, data);
    } else {
      console.log('%c Quix %c ' + message, styles.badge, style);
    }
  }

  var QuixPlugin = {

    _groupOpen: false,

    _syncRoute: function () {
      var path = window.location.pathname + window.location.search + window.location.hash;
      log('info', '⟶ navigate ' + path);
      window.parent.postMessage({ type: 'NAVIGATE', path: path }, '*');
    },

    _initNavigation: function () {
      var push = history.pushState.bind(history);
      var replace = history.replaceState.bind(history);
      history.pushState = function () { push.apply(history, arguments); QuixPlugin._syncRoute(); };
      history.replaceState = function () { replace.apply(history, arguments); QuixPlugin._syncRoute(); };
      window.addEventListener('popstate', function () { QuixPlugin._syncRoute(); });
      QuixPlugin._syncRoute();
    },

    _tokenCallbacks: [],

    onToken: function (callback) {
      this._tokenCallbacks.push(callback);
      return this;
    },

    _handleToken: function (token) {
      log('success', '✓ Auth token received', token.substring(0, 20) + '••••');
      if (QuixPlugin._groupOpen) {
        console.groupEnd();
        QuixPlugin._groupOpen = false;
      }
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

    init: function () {
      console.groupCollapsed(
        '%c Quix Plugin SDK %c v' + VERSION,
        styles.badge,
        styles.version
      );
      QuixPlugin._groupOpen = true;
      log('info',    '◎ Initialising');
      this._initNavigation();
      this._initToken();
      log('success', '✓ Ready');
      return this;
    }

  };

  global.QuixPlugin = QuixPlugin;
})(window);
