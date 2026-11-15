// TizenBrew serviceFile entry (package.json `serviceFile: dist/service.js`). ES5, see proxy.cjs.
// TizenBrew runs this file's top level in a vm sandbox and never calls module.exports.onStart,
// so start here. The guard keeps a second evaluation from opening a second server.
'use strict';

var proxy = require('./proxy.cjs');

if (!global.__kickTizenbrewService) {
  global.__kickTizenbrewService = true;
  process.on('uncaughtException', function (e) {
    try {
      console.log('kick-tizenbrew service: ' + (e && e.stack ? e.stack : e));
    } catch (ignored) {}
  });
  proxy.start(proxy.PORT);
}

module.exports.onStart = function () {};
