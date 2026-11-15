// Builds the Module into dist/ (committed, because gh/ installs read the repo tree through jsDelivr).
// `node scripts/build.mjs --watch` rebuilds on change (used by scripts/dev.mjs).
import { build, context } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

export const options = {
  entryPoints: [
    { in: join(root, 'src/main.tsx'), out: 'app' },
    { in: join(root, 'src/styles.css'), out: 'app' },
  ],
  outdir: dist,
  bundle: true,
  minify: true,
  sourcemap: false,
  target: 'chrome63',
  format: 'iife',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
};

// The TizenBrew serviceFile: ES5 source bundled into one file, because the sandbox `require`
// only has Node built ins. scripts/check-syntax.mjs gates it as ES5 for Node 4.4.3.
export const serviceOptions = {
  entryPoints: [join(root, 'src/service/main.cjs')],
  outfile: join(dist, 'service.js'),
  bundle: true,
  minify: false,
  platform: 'node',
  format: 'cjs',
  target: 'es5',
  logLevel: 'info',
};

function copyStatic() {
  copyFileSync(join(root, 'src/index.html'), join(dist, 'index.html'));
}

export async function watch() {
  mkdirSync(dist, { recursive: true });
  copyStatic();
  const ctx = await context(options);
  await ctx.watch();
  const serviceCtx = await context(serviceOptions);
  await serviceCtx.watch();
  return ctx;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(dist, { recursive: true });
  await build(options);
  await build(serviceOptions);
  copyStatic();
}
