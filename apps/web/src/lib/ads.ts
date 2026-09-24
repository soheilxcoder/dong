/**
 * Ads policy (owner's decision): exactly ONE full-screen ad per app launch, shown right after
 * login / when the home screen first appears. No banners, nothing during expense entry or settlements.
 * The skip/close timing inside the ad is controlled by Tapsell, not by the app.
 *
 * Monetisation: Tapsell Mediation (Iranian ad network) via our tiny native bridge
 * (android/app/src/main/java/ir/dong/app/TapsellPlugin.java). Native Android only — never on web.
 *
 * User-friendly defaults:
 *  - one 320×50 banner anchored at the bottom; the UI shifts up via --safe-bottom so nothing is covered
 *  - a rare interstitial after "natural break" actions (save expense / confirm settlement),
 *    max 1 per 3 minutes and never during the first minute after launch
 *  - Tapsell's public TEST zones are used unless real zone ids are provided at build time
 *    (VITE_TAPSELL_BANNER_ZONE / VITE_TAPSELL_INTERSTITIAL_ZONE), so a build without a Tapsell
 *    account shows test ads instead of breaking.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface TapsellPlugin {
  showBanner(o: { zoneId: string }): Promise<void>;
  hideBanner(): Promise<void>;
  prepareInterstitial(o: { zoneId: string }): Promise<void>;
  showInterstitial(): Promise<{ shown: boolean }>;
  addListener(event: 'bannerHeight', cb: (e: { height: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'interstitialClosed', cb: () => void): Promise<PluginListenerHandle>;
}
const Tapsell = registerPlugin<TapsellPlugin>('Tapsell');

const TEST_ZONES = {
  banner: 'e3d5999c-5990-4e31-8ce9-642ce040a7f4',
  interstitial: 'b3972749-f62a-475a-9ff2-cfc9e2a40f87',
};
const env = import.meta.env as Record<string, string | undefined>;
export const ADS = {
  enabled: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && env.VITE_ADS_ENABLED !== 'false',
  usingTestZones: !env.VITE_TAPSELL_BANNER_ZONE,
  banner: env.VITE_TAPSELL_BANNER_ZONE || TEST_ZONES.banner,
  interstitial: env.VITE_TAPSELL_INTERSTITIAL_ZONE || TEST_ZONES.interstitial,
};

let ready = false;
let interstitialReady = false;
let shownThisLaunch = false;

export async function initAds() {
  if (!ADS.enabled || ready) return;
  ready = true;
  try {
    await Tapsell.addListener('interstitialClosed', () => { interstitialReady = false; });
    await prepareInterstitial();
  } catch (e) {
    console.warn('[ads] init failed', e);
  }
}

async function prepareInterstitial() {
  if (!ready || interstitialReady || shownThisLaunch) return;
  try { await Tapsell.prepareInterstitial({ zoneId: ADS.interstitial }); interstitialReady = true; }
  catch { /* no fill / offline — we simply skip the ad this launch */ }
}

/** The single startup ad: called when the home screen appears after login. Waits up to ~12s for the ad to load, shows once per launch. */
export async function showStartupAd() {
  if (!ADS.enabled || shownThisLaunch) return;
  shownThisLaunch = true;
  if (!ready) await initAds();
  for (let i = 0; i < 24 && !interstitialReady; i++) { // ad may still be loading
    if (i % 6 === 5) void prepareInterstitial();
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!interstitialReady) return;
  try { await Tapsell.showInterstitial(); } catch { /* ignore */ }
  interstitialReady = false;
}

/** Kept for API compatibility — no longer shows anything (one ad per launch only). */
export async function maybeShowInterstitial() { /* intentionally empty */ }
export async function showBanner() { /* banners removed */ }
export async function hideBanner() { /* banners removed */ }
