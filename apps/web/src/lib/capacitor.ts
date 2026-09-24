import { initAds } from './ads';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import '@capacitor/haptics';
import '@capacitor/share';
import '@capacitor/clipboard';
import '@capacitor/local-notifications';

/** Native bootstrap: deep links, status bar, back button. No-op on web. */
export function initNative(navigate: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return;
  setTimeout(() => { void initAds(); }, 800); // preload the single startup ad
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
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
