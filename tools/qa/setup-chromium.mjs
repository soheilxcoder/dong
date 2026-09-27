// Unpacks @sparticuz/chromium into .cache/chromium (headless browser for screenshots/QA). Idempotent.
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import { execSync } from 'child_process';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, '.cache/chromium'); const bin = path.join(root, 'node_modules/@sparticuz/chromium/bin');
if (fs.existsSync(path.join(out, 'chromium'))) { console.log('chromium ready'); process.exit(0); }
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'chromium'), zlib.brotliDecompressSync(fs.readFileSync(path.join(bin, 'chromium.br'))), { mode: 0o755 });
for (const f of ['al2.tar.br', 'al2023.tar.br', 'swiftshader.tar.br', 'fonts.tar.br']) {
  const tar = path.join(out, f.replace('.br', '')); fs.writeFileSync(tar, zlib.brotliDecompressSync(fs.readFileSync(path.join(bin, f))));
  execSync(`tar -xf "${tar}" -C "${out}"`); fs.unlinkSync(tar);
}
console.log('chromium unpacked →', out);
