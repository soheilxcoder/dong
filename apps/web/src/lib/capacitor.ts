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
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  App.addListener('appUrlOpen', ({ url }) => {
    const m = url.match(/#\/(.*)$/) || url.match(/join\/([A-Za-z0-9_-]+)/);
    if (m) navigate(url.includes('#/') ? `/${m[1]}` : `/join/${m[1]}`);
  });
  App.addListener('backButton', ({ canGoBack }) => { if (canGoBack) history.back(); else App.exitApp(); });
}
