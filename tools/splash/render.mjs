// Renders tools/splash/splash.html → all Android splash densities + web boot image.
// usage: LD_LIBRARY_PATH=/tmp/al/lib node render.mjs   (needs puppeteer in /tmp/pw or node_modules)
import { createRequire } from 'module'; import { execSync } from 'child_process'; import path from 'path';
const require = createRequire('/tmp/pw/'); const puppeteer = require('puppeteer');
const here = path.dirname(new URL(import.meta.url).pathname); const root = path.resolve(here, '../..');
const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/tmp/al/chromium', args: ['--no-sandbox','--disable-gpu','--single-process','--no-zygote','--allow-file-access-from-files'] });
const p = await b.newPage(); await p.setViewport({ width: 2732, height: 2732 });
await p.goto('file://' + here + '/splash.html'); await p.evaluate(() => document.fonts.ready); await new Promise(r => setTimeout(r, 600));
const out = root + '/store-assets/splash-2732.png'; await p.screenshot({ path: out }); await b.close();
const res = root + '/apps/web/android/app/src/main/res';
for (const d of execSync(`ls -d ${res}/drawable*/splash.png`).toString().trim().split('\n')) {
  const sz = execSync(`identify -format '%wx%h' ${d}`).toString().trim();
  execSync(`convert ${out} -resize "${sz}^" -gravity center -extent ${sz} ${d}`);
}
execSync(`convert ${out} -resize 1080x1080 ${root}/store-assets/splash-preview-1080.png`);
console.log('splash rendered →', out);
