/*
 * Spike probe for tizen.kick.com inside TizenBrew.
 * Shows a small diagnostic panel. Press the BLUE key to show or hide it.
 * Written in ES5 so it runs on Tizen 5.5 (Chromium 69).
 */
(function () {
  if (window.__kickProbe) return;
  window.__kickProbe = true;

  var lines = [];
  var header = [];
  var panel = null;
  var visible = true;

  function log(msg) {
    var t = new Date().toTimeString().slice(0, 8);
    lines.push(t + ' ' + msg);
    if (lines.length > 14) lines.shift();
    render();
  }

  function render() {
    if (!panel) return;
    panel.textContent = 'KICK PROBE (blue key hides)\n' + header.join('\n') + '\n----\n' + lines.join('\n');
  }

  function mount() {
    if (panel || !document.body) return;
    panel = document.createElement('pre');
    panel.style.cssText = [
      'position:fixed', 'right:20px', 'bottom:20px', 'z-index:2147483647',
      'max-width:700px', 'margin:0', 'padding:12px', 'font:16px/1.3 monospace',
      'color:#53fc18', 'background:rgba(0,0,0,0.8)', 'white-space:pre-wrap',
      'pointer-events:none', 'border:1px solid #53fc18'
    ].join(';');
    document.body.appendChild(panel);
    render();
  }

  // Tizen UAs omit "Chrome/": e.g. "... (KHTML, like Gecko) 69.0.3497.106.1/5.5 TV Safari/537.36"
  var chrome = navigator.userAgent.match(/Chrome\/(\d+)/) || navigator.userAgent.match(/\) (\d+)\.\d+\.\d+\.\d+[^ ]*\/[\d.]+ TV/);
  var model = 'unknown';
  try { model = window.webapis.productinfo.getRealModel(); } catch (e) {}
  header.push('chromium: ' + (chrome ? chrome[1] : 'unknown') + ', model: ' + model);
  header.push('ua: ' + navigator.userAgent);
  header.push('tizen api: ' + (typeof window.tizen) + ', webapis: ' + (typeof window.webapis));
  log('url: ' + location.href);

  var keyNames = { 403: 'RED', 404: 'GREEN', 405: 'YELLOW', 406: 'BLUE', 10252: 'PLAYPAUSE', 415: 'PLAY', 19: 'PAUSE', 413: 'STOP', 10009: 'BACK' };
  document.addEventListener('keydown', function (e) {
    log('key: ' + e.keyCode + (keyNames[e.keyCode] ? ' ' + keyNames[e.keyCode] : '') + ' (' + e.key + ')');
    if (e.keyCode === 406 && panel) {
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    }
  }, true);

  var seenVideos = [];
  function watchVideos() {
    var vids = document.getElementsByTagName('video');
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i];
      if (seenVideos.indexOf(v) !== -1) continue;
      seenVideos.push(v);
      log('video found #' + seenVideos.length);
      ['playing', 'waiting', 'error', 'ended'].forEach(function (ev) {
        v.addEventListener(ev, function () {
          var extra = ev === 'error' && this.error ? ' code=' + this.error.code : '';
          log('video ' + ev + extra + ' ' + this.videoWidth + 'x' + this.videoHeight);
        });
      });
    }
  }

  window.addEventListener('error', function (e) {
    log('js error: ' + e.message + (e.filename ? ' @' + e.filename.split('/').pop() : ''));
  });

  var lastUrl = location.href;
  setInterval(function () {
    mount();
    watchVideos();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      log('nav: ' + lastUrl);
    }
  }, 1000);
})();
