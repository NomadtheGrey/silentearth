/**
 * Build-time PWA icon decode (2026-10-29).
 *
 * The manifest's PNG icons (public/icons/*.png) are
 * generated, never committed: our push route moves text
 * only, so the PNGs live in the repo as base64 text at
 * assets-src/*.png.b64 (the family's settled pattern for
 * binary assets) and this script decodes them into
 * public/icons/ before Vite builds. Wired as the npm
 * "prebuild" hook, so the dashboard's `npm run build`
 * (and any local build) produces them automatically.
 * The generated PNGs are gitignored.
 *
 * Art source: public/favicon.svg, rasterized at 192 /
 * 512 (plus a maskable 512 with the favicon ground color
 * full-bleed and the art at 78%). If the favicon art
 * changes, re-rasterize and replace the .b64 files.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });
for (const name of ['icon-192', 'icon-512', 'icon-maskable-512']) {
  const b64 = readFileSync(join(root, 'assets-src', `${name}.png.b64`), 'utf8');
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(b64.trim(), 'base64'));
}
console.log('PWA icons decoded into public/icons/');
