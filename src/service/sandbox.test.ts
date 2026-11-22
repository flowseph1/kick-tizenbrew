import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const require = createRequire(import.meta.url);

/**
 * Runs `dist/service.js` the way TizenBrew does (service-nextgen/service/utils/serviceLauncher.js):
 * a copy of Node's globals without `global`, `module` and TizenBrew's own names, plus `require`
 * and a fresh `module`, then the top level only.
 */
function runLikeTizenBrew(script: string) {
  const sandbox: Record<string, unknown> = {};
  const disallowed = ['services', 'module', 'global', 'inDebug', 'currentClient', 'currentModule'];
  for (const prop of Object.getOwnPropertyNames(globalThis)) {
    if (disallowed.indexOf(prop) >= 0) continue;
    sandbox[prop] = (globalThis as Record<string, unknown>)[prop];
  }
  sandbox.require = require;
  sandbox.module = { exports: {} };
  vm.runInContext(script, vm.createContext(sandbox));
}

describe('dist/service.js in a TizenBrew sandbox', () => {
  it('starts without `global` and answers /ping', async () => {
    const script = readFileSync(new URL('../../dist/service.js', import.meta.url), 'utf8');
    const proc = process as unknown as { __kickTizenbrewService?: boolean };
    delete proc.__kickTizenbrewService;
    expect(() => runLikeTizenBrew(script)).not.toThrow();
    // A second launch (TizenBrew relaunches the module) must not open a second server.
    expect(() => runLikeTizenBrew(script)).not.toThrow();

    let body = '';
    for (let i = 0; i < 20 && !body; i++) {
      try {
        const res = await fetch('http://127.0.0.1:8093/ping');
        body = await res.text();
      } catch (e) {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    expect(body).toMatch(/^ok /);
  });
});
