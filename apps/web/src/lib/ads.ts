/**
 * Monetisation: Google AdMob via @capacitor-community/admob (native Android only — never on web).
 *
 * Policy-friendly defaults:
 *  - one adaptive banner anchored at the bottom (UI shifts up via --safe-bottom so nothing is covered)
 *  - a rare interstitial after "natural break" actions (max 1 per 3 minutes, never on first launch)
 *  - GDPR/UMP consent form is requested before any ad is loaded
 *  - Google TEST ad units are used unless real IDs are provided at build time (VITE_ADMOB_*),
 *    so a build without an AdMob account never violates AdMob policy.
 */
import { Capacitor } from '@capacitor/core';

const TEST = {
  banner: 'ca-app-pub-3940256099942544/6300978111',
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
};
const env = import.meta.env as Record<string, string | undefined>;
export const ADS = {
  enabled: Capacitor.isNativePlatform() && env.VITE_ADS_ENABLED !== 'false',
  usingTestIds: !env.VITE_ADMOB_BANNER_ID,
  banner: env.VITE_ADMOB_BANNER_ID || TEST.banner,
  interstitial: env.VITE_ADMOB_INTERSTITIAL_ID || TEST.interstitial,
};

type AdMobPlugin = typeof import('@capacitor-community/admob').AdMob;
let admob: AdMobPlugin | null = null;
let ready = false;
let bannerShown = false;
let lastInterstitial = 0;
let interstitialLoaded = false;
const INTERSTITIAL_GAP_MS = 3 * 60 * 1000;

function setBottomInset(px: number) {
  document.documentElement.style.setProperty('--safe-bottom', `calc(env(safe-area-inset-bottom, 0px) + ${px}px)`);
}

export async function initAds() {
  if (!ADS.enabled || ready) return;
  try {
    const mod = await import('@capacitor-community/admob');
    admob = mod.AdMob;
    await admob.initialize({ initializeForTesting: ADS.usingTestIds });

    // Consent (UMP). Required for EEA/UK users; harmless elsewhere.
    try {
      const info = await admob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === mod.AdmobConsentStatus.REQUIRED) await admob.showConsentForm();
    } catch { /* consent not configured in AdMob console yet — continue with non-personalised ads */ }

    admob.addListener(mod.BannerAdPluginEvents.SizeChanged, (s: { height: number }) => setBottomInset(s.height));
    admob.addListener(mod.InterstitialAdPluginEvents.Loaded, () => { interstitialLoaded = true; });
    admob.addListener(mod.InterstitialAdPluginEvents.Dismissed, () => { interstitialLoaded = false; void prepareInterstitial(); });
    ready = true;
    lastInterstitial = Date.now(); // never show an interstitial right after launch
    await showBanner();
    void prepareInterstitial();
  } catch (e) {
    console.warn('[ads] init failed', e);
  }
}

export async function showBanner() {
  if (!ready || !admob || bannerShown) return;
  const mod = await import('@capacitor-community/admob');
  try {
    await admob.showBanner({
      adId: ADS.banner,
      adSize: mod.BannerAdSize.ADAPTIVE_BANNER,
      position: mod.BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: ADS.usingTestIds,
    });
    bannerShown = true;
  } catch (e) { console.warn('[ads] banner', e); }
}

export async function hideBanner() {
  if (!ready || !admob || !bannerShown) return;
  try { await admob.hideBanner(); bannerShown = false; setBottomInset(0); } catch { /* ignore */ }
}

export async function resumeBanner() {
  if (!ready || !admob || bannerShown) return;
  try { await admob.resumeBanner(); bannerShown = true; } catch { await showBanner(); }
}

async function prepareInterstitial() {
  if (!ready || !admob || interstitialLoaded) return;
  try { await admob.prepareInterstitial({ adId: ADS.interstitial, isTesting: ADS.usingTestIds }); } catch { /* ignore */ }
}

/** Call at natural break points (after saving an expense / confirming a settlement). Rate-limited. */
export async function maybeShowInterstitial() {
  if (!ready || !admob || !interstitialLoaded) return;
  if (Date.now() - lastInterstitial < INTERSTITIAL_GAP_MS) return;
  try { await admob.showInterstitial(); lastInterstitial = Date.now(); } catch { /* ignore */ }
}
