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
const js = files.filter((f) => f.endsWith('.js'));
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
scan(js, regexRules);
scan(css, cssRules);

if (problems.length) {
  console.error('check:syntax failed: output is not safe for Chromium 63\n' + problems.join('\n'));
  process.exit(1);
}
console.log('check:syntax ok: ' + js.length + ' JS and ' + css.length + ' CSS files are Chromium 63 safe');
