// Screenshot of the HTML boot splash (as a phone sees it before any JS loads) for visual checks.
import { createRequire } from 'module'; import path from 'path'; import { execSync } from 'child_process';
const require = createRequire(import.meta.url); const puppeteer = require('puppeteer-core');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const srv = execSync('true') && (await import('child_process')).spawn('npx', ['--yes','serve','-s','apps/web/dist','-l','8089'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 5000));
const b = await puppeteer.launch({ executablePath: root + '/.cache/chromium/chromium', args: ['--no-sandbox','--disable-gpu','--single-process','--no-zygote'] });
for (const [w,h,name] of [[360,800,'small'],[412,915,'normal'],[430,932,'large'],[800,1280,'tablet']]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.setRequestInterception(true); p.on('request', r => { if (/\.js(\?.*)?$/.test(r.url())) r.abort(); else r.continue(); });
  await p.goto('http://localhost:8089/', { waitUntil: 'networkidle0' }); await new Promise(r => setTimeout(r, 400));
  await p.screenshot({ path: `/tmp/fit/boot-${name}.png` }); await p.close();
}
await b.close(); srv.kill();
