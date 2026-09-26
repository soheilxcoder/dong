import { initAds } from './ads';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { registerPlugin } from '@capacitor/core';

const SystemBars = registerPlugin<{ setColors(o: { status: string; nav: string; dark: boolean }): Promise<void> }>('SystemBars');
/** Match Android status/navigation bar colors to the in-app theme. No-op on web. */
export function syncSystemBars(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  const bg = dark ? '#0F1416' : '#F7F9FA';
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
  SystemBars.setColors({ status: bg, nav: bg, dark }).catch(() => {});
}
import { SplashScreen } from '@capacitor/splash-screen';
import '@capacitor/haptics';
import '@capacitor/share';
import '@capacitor/clipboard';
import '@capacitor/local-notifications';

/** Native bootstrap: deep links, status bar, back button. No-op on web. */
export function initNative(navigate: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return;
  setTimeout(() => { void initAds(); }, 800); // preload the single startup ad
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  syncSystemBars(document.documentElement.classList.contains('dark'));
  SplashScreen.hide().catch(() => {});
  App.addListener('appUrlOpen', ({ url }) => {
    // https://soheilxcoder.github.io/dong/#/join/TOKEN?s=SNAPSHOT  or  dong://join/TOKEN?s=...
    const i = url.indexOf('#/');
    if (i >= 0) { navigate(url.slice(i + 1)); return; }
    const m = url.match(/join\/([A-Za-z0-9_-]+)(\?[^#]*)?/);
    if (m) navigate(`/join/${m[1]}${m[2] ?? ''}`);
  });
  App.addListener('backButton', ({ canGoBack }) => { if (canGoBack) history.back(); else App.exitApp(); });
}
