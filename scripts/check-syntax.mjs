// Build gate: fails when the shipped output uses syntax or features newer than Chromium 63
// (Tizen 5.0, 2019 TVs). Usage: node scripts/check-syntax.mjs [dir]   (default: dist)
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] ? resolve(process.argv[2]) : join(root, 'dist');

if (!existsSync(dir)) {
  console.error('check:syntax: ' + dir + ' does not exist. Run `npm run build` first.');
  process.exit(1);
}

function walk(d) {
  return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)],
  );
}

const files = walk(dir);
// dist/service.js is the TizenBrew serviceFile: it runs in Node 4.4.3 on Tizen 5, not in Chromium.
const SERVICE = join(dir, 'service.js');
const js = files.filter((f) => f.endsWith('.js') && f !== SERVICE);
const css = files.filter((f) => f.endsWith('.css'));
const problems = [];

// 1. JS syntax and built in features, through es-check.
// globalThis and ErrorCause are ignored: hls.js (ticket 03) guards them safely.
if (js.length) {
  const esCheck = join(root, 'node_modules/.bin/es-check');
  const r = spawnSync(
    esCheck,
    ['checkBrowser', ...js, '--browserslistQuery', 'chrome 63', '--checkFeatures', '--ignore', 'globalThis,ErrorCause'],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) problems.push('es-check:\n' + (r.stdout || '') + (r.stderr || ''));
}

// 2. Regex syntax es-check does not flag. esbuild turns these into `new RegExp(...)`,
// which throws at runtime on Chromium 63.
const regexRules = [
  [/\(\?<[A-Za-z_$]/, 'named capture group (Chrome 64)'],
  [/\\[pP]\{/, 'unicode property escape (Chrome 64)'],
];

// 3. CSS that Chromium 63 ignores.
const cssRules = [
  [/(^|[;{])\s*aspect-ratio\s*:/, 'aspect-ratio (Chrome 88)'],
  [/(^|[;{])\s*inset\s*:/, 'inset (Chrome 87)'],
  [/:focus-visible/, ':focus-visible (Chrome 86)'],
  [/(^|[;{])\s*gap\s*:/, 'gap (flexbox gap is Chrome 84; use grid-gap or margins)'],
];

function scan(list, rules) {
  for (const f of list) {
    const src = readFileSync(f, 'utf8');
    for (const [re, what] of rules) {
      if (re.test(src)) problems.push(relative(root, f) + ': ' + what);
    }
  }
}
// 4. The serviceFile: ES5 syntax, and no Node APIs newer than 4.4.3 (or ES2016+ built ins).
if (existsSync(SERVICE)) {
  const esCheck = join(root, 'node_modules/.bin/es-check');
  const r = spawnSync(esCheck, ['es5', SERVICE], { encoding: 'utf8' });
  if (r.status !== 0) problems.push('es-check es5 (service):\n' + (r.stdout || '') + (r.stderr || ''));
}
const serviceRules = [
  [/Buffer\.(from|alloc|allocUnsafe)\s*\(/, 'Buffer.from/alloc (use new Buffer, Node 4.4.3)'],
  [/\.includes\s*\(/, 'includes() (ES2016; use indexOf)'],
  [/\.(padStart|padEnd)\s*\(/, 'padStart/padEnd (ES2017)'],
  [/Object\.(values|entries)\s*\(/, 'Object.values/entries (Node 7)'],
];

scan(js, regexRules);
if (existsSync(SERVICE)) scan([SERVICE], serviceRules);
scan(css, cssRules);

if (problems.length) {
  console.error('check:syntax failed: output is not safe for Chromium 63\n' + problems.join('\n'));
  process.exit(1);
}
console.log(
  'check:syntax ok: ' + js.length + ' JS and ' + css.length + ' CSS files are Chromium 63 safe' +
    (existsSync(SERVICE) ? '; service.js is ES5 for Node 4.4.3' : ''),
);
