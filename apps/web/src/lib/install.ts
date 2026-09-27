// PWA install helpers: Android/desktop (beforeinstallprompt) + iOS (manual add-to-home-screen)
export { isNative } from './native';
/** Release page that always holds the newest `Dong-<version>.apk` (built by .github/workflows/android.yml). */
export const RELEASE_PAGE = 'https://github.com/soheilxcoder/dong/releases/tag/apk-latest';
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? '1.0.0';
let cached: { version: string; url: string } | null | undefined;
/** Newest APK {version,url} from the GitHub release; null when unreachable (then open RELEASE_PAGE). */
export async function latestApk(): Promise<{ version: string; url: string } | null> {
  if (cached !== undefined) return cached;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch('https://api.github.com/repos/soheilxcoder/dong/releases/tags/apk-latest', { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
    clearTimeout(t);
    const j = (await r.json()) as { assets?: { name: string; browser_download_url: string }[] };
    const a = j.assets?.find((x) => /^Dong-\d+\.\d+\.\d+\.apk$/.test(x.name));
    cached = a ? { version: a.name.replace(/^Dong-|\.apk$/g, ''), url: a.browser_download_url } : null;
  } catch { cached = null; }
  return cached;
}
/** Start downloading the newest APK (direct file when resolvable, otherwise the release page). */
export async function downloadApk() { const a = await latestApk(); window.open(a?.url ?? RELEASE_PAGE, '_blank'); }
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
