// PWA install helpers: Android/desktop (beforeinstallprompt) + iOS (manual add-to-home-screen)
export { isNative } from './native';
/** The APK lives on the owner's own host (branch apk-release → Plesk → /dong/apk). latest.json is written by the Android workflow. */
export const SITE_URL = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://products.arounidea.com/dong/').replace(/\/?$/, '/');
/** Illustrated user guide (apps/web/public/guide, built by tools/docs/build-guide.mjs). */
export const GUIDE_URL = SITE_URL + 'guide/';
export const APK_BASE = ((import.meta.env.VITE_PUBLIC_URL as string | undefined) || 'https://products.arounidea.com/dong/').replace(/\/?$/, '/') + 'apk/';
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0';
let cached: { version: string; url: string } | null | undefined;
/** Newest APK {version,url} from <site>/apk/latest.json; null when unreachable (then open the /apk page). */
export async function latestApk(): Promise<{ version: string; url: string } | null> {
  if (cached !== undefined) return cached;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(APK_BASE + 'latest.json?t=' + Math.floor(Date.now() / 60000), { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = (await r.json()) as { version?: string; file?: string; url?: string };
    cached = j.version && (j.file || j.url) ? { version: j.version, url: j.url || APK_BASE + j.file } : null;
  } catch { cached = null; }
  return cached;
}
/** Start downloading the newest APK (direct file when resolvable, otherwise the download page on the site). */
export async function downloadApk() { const a = await latestApk(); window.open(a?.url ?? APK_BASE, '_blank'); }
const num = (v: string) => v.split('.').map((x) => parseInt(x, 10) || 0);
export const isNewer = (a: string, b: string) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) { if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0); } return false; };
type BIP = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: BIP | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIP; subs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()); });
}
export const canPromptInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export async function promptInstall() { if (!deferred) return false; await deferred.prompt(); const r = await deferred.userChoice; deferred = null; subs.forEach((f) => f()); return r.outcome === 'accepted'; }
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
export const isDesktop = () => !isIOS() && !isAndroid();
