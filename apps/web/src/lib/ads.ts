/**
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
let bannerShown = false;
let interstitialReady = false;
let lastInterstitial = 0;
const INTERSTITIAL_GAP_MS = 3 * 60 * 1000;
const FIRST_INTERSTITIAL_DELAY_MS = 60 * 1000;

function setBottomInset(px: number) {
  document.documentElement.style.setProperty('--safe-bottom', `calc(env(safe-area-inset-bottom, 0px) + ${px}px)`);
}

export async function initAds() {
  if (!ADS.enabled || ready) return;
  ready = true;
  lastInterstitial = Date.now() - INTERSTITIAL_GAP_MS + FIRST_INTERSTITIAL_DELAY_MS;
  try {
    await Tapsell.addListener('bannerHeight', ({ height }) => setBottomInset(height));
    await Tapsell.addListener('interstitialClosed', () => { interstitialReady = false; setTimeout(() => { void prepareInterstitial(); }, 5000); });
    await showBanner();
    void prepareInterstitial();
  } catch (e) {
    console.warn('[ads] init failed', e);
  }
}

export async function showBanner() {
  if (!ready || bannerShown) return;
  try { await Tapsell.showBanner({ zoneId: ADS.banner }); bannerShown = true; }
  catch (e) { console.warn('[ads] banner', e); setTimeout(() => { void showBanner(); }, 60_000); } // retry later (no fill / offline)
}

export async function hideBanner() {
  if (!ready || !bannerShown) return;
  try { await Tapsell.hideBanner(); } catch { /* ignore */ }
  bannerShown = false; setBottomInset(0);
}

async function prepareInterstitial() {
  if (!ready || interstitialReady) return;
  try { await Tapsell.prepareInterstitial({ zoneId: ADS.interstitial }); interstitialReady = true; }
  catch { setTimeout(() => { void prepareInterstitial(); }, 90_000); }
}

/** Call at natural break points (after saving an expense / confirming a settlement). Rate-limited. */
export async function maybeShowInterstitial() {
  if (!ready || !interstitialReady) return;
  if (Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return;
  try {
    const { shown } = await Tapsell.showInterstitial();
    if (shown) { lastInterstitial = Date.now(); interstitialReady = false; }
  } catch { interstitialReady = false; }
}
