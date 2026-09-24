package ir.dong.app;

import android.util.DisplayMetrics;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import ir.tapsell.mediation.Tapsell;
import ir.tapsell.mediation.ad.AdStateListener;
import ir.tapsell.mediation.ad.request.BannerSize;
import ir.tapsell.mediation.ad.request.RequestResultListener;
import ir.tapsell.mediation.ad.show.AdShowCompletionState;
import ir.tapsell.mediation.ad.views.banner.BannerContainer;

/**
 * Minimal bridge between the web app and Tapsell Mediation.
 * JS side: apps/web/src/lib/ads.ts  (registerPlugin('Tapsell'))
 *
 *  showBanner({ zoneId })        -> anchors a 320x50 banner at the bottom, emits "bannerHeight" {height:px}
 *  hideBanner()                  -> removes it, emits height 0
 *  prepareInterstitial({ zoneId })
 *  showInterstitial()            -> resolves { shown: boolean }; emits "interstitialClosed"
 */
@CapacitorPlugin(name = "Tapsell")
public class TapsellPlugin extends Plugin {
    private static final int BANNER_H_DP = 50;
    private BannerContainer bannerContainer;
    private String bannerAdId;
    private String interstitialAdId;
    private boolean interstitialLoading = false;

    private int dp(int v) {
        DisplayMetrics m = getContext().getResources().getDisplayMetrics();
        return Math.round(v * m.density);
    }

    private void emitHeight(int px) {
        JSObject o = new JSObject();
        o.put("height", Math.round(px / getContext().getResources().getDisplayMetrics().density));
        notifyListeners("bannerHeight", o);
    }

    @PluginMethod
    public void showBanner(PluginCall call) {
        final String zone = call.getString("zoneId");
        if (zone == null) { call.reject("zoneId required"); return; }
        getActivity().runOnUiThread(() -> {
            if (bannerContainer == null) {
                bannerContainer = new BannerContainer(getContext());
                FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
                ViewGroup root = getActivity().findViewById(android.R.id.content);
                root.addView(bannerContainer, lp);
            }
            Tapsell.requestBannerAd(zone, BannerSize.BANNER_320_50, new RequestResultListener() {
                @Override public void onSuccess(@NonNull String adId) {
                    bannerAdId = adId;
                    getActivity().runOnUiThread(() -> Tapsell.showBannerAd(adId, bannerContainer, getActivity(), new AdStateListener.Banner() {
                        @Override public void onAdImpression() { emitHeight(dp(BANNER_H_DP)); }
                        @Override public void onAdClicked() {}
                        @Override public void onAdFailed(@NonNull String message) { emitHeight(0); }
                    }));
                    // reserve space right away so the UI doesn't jump when the ad paints
                    emitHeight(dp(BANNER_H_DP));
                    call.resolve();
                }
                @Override public void onFailure(@NonNull String message) { emitHeight(0); call.reject(message); }
            });
        });
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerAdId != null) { try { Tapsell.destroyBannerAd(bannerAdId); } catch (Throwable ignored) {} bannerAdId = null; }
            if (bannerContainer != null) {
                ViewGroup root = getActivity().findViewById(android.R.id.content);
                root.removeView(bannerContainer);
                bannerContainer = null;
            }
            emitHeight(0);
            call.resolve();
        });
    }

    @PluginMethod
    public void prepareInterstitial(PluginCall call) {
        final String zone = call.getString("zoneId");
        if (zone == null) { call.reject("zoneId required"); return; }
        if (interstitialAdId != null || interstitialLoading) { call.resolve(); return; }
        interstitialLoading = true;
        Tapsell.requestInterstitialAd(zone, new RequestResultListener() {
            @Override public void onSuccess(@NonNull String adId) { interstitialAdId = adId; interstitialLoading = false; call.resolve(); }
            @Override public void onFailure(@NonNull String message) { interstitialLoading = false; call.reject(message); }
        });
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        final String adId = interstitialAdId;
        JSObject res = new JSObject();
        if (adId == null) { res.put("shown", false); call.resolve(res); return; }
        interstitialAdId = null;
        getActivity().runOnUiThread(() -> Tapsell.showInterstitialAd(adId, getActivity(), new AdStateListener.Interstitial() {
            @Override public void onAdImpression() {}
            @Override public void onAdClicked() {}
            @Override public void onAdClosed(@NonNull AdShowCompletionState state) { notifyListeners("interstitialClosed", new JSObject()); }
            @Override public void onAdFailed(@NonNull String message) { notifyListeners("interstitialClosed", new JSObject()); }
        }));
        res.put("shown", true);
        call.resolve(res);
    }
}
