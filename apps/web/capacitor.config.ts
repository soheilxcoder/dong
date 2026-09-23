import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.dong.app',
  appName: 'دُنگ',
  webDir: 'dist',
  android: { allowMixedContent: false, backgroundColor: '#0F1416' },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#0a5c46', androidScaleType: 'CENTER_CROP', showSpinner: false },
    StatusBar: { style: 'DARK', backgroundColor: '#0a5c46', overlaysWebView: true },
    LocalNotifications: { smallIcon: 'ic_stat_dong', iconColor: '#0FB88A' },
  },
};
export default config;
