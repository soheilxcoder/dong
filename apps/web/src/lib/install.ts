// PWA install helpers: Android/desktop (beforeinstallprompt) + iOS (manual add-to-home-screen)
export { isNative } from './native';
export const APK_URL = 'https://github.com/soheilxcoder/dong/releases/download/apk-latest/dong-latest.apk';
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
