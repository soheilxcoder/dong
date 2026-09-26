package ir.dong.app;

import android.app.Activity;
import android.app.Application;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.TextView;

/**
 * Owner's policy: a full-screen ad may hold the user for at most AD_MAX_SECONDS. Tapsell's own
 * creatives decide their skip timing, so we add a safety net: while any Tapsell ad activity is
 * in the foreground, after AD_MAX_SECONDS a «رد تبلیغ ✕» pill is overlaid at the top of that
 * activity; tapping it finishes the ad activity and the app resumes (the SDK still reports
 * onAdClosed). If the ad closes itself earlier nothing is shown.
 */
final class AdSkipGuard implements Application.ActivityLifecycleCallbacks {
    static final int AD_MAX_SECONDS = 15;
    private static final int TAG_ID = 0x7f0d0ad5;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pending;

    static void install(Application app) { app.registerActivityLifecycleCallbacks(new AdSkipGuard()); }

    private static boolean isAdActivity(Activity a) {
        String n = a.getClass().getName().toLowerCase();
        return n.contains("tapsell") || n.contains("ir.tapsell") || n.contains("adactivity") || n.contains(".ad.");
    }

    @Override public void onActivityResumed(Activity a) {
        if (!isAdActivity(a) || a instanceof MainActivity) return;
        cancel();
        pending = () -> { pending = null; if (!a.isFinishing() && !a.isDestroyed()) addSkip(a); };
        handler.postDelayed(pending, AD_MAX_SECONDS * 1000L);
    }
    @Override public void onActivityPaused(Activity a) { if (isAdActivity(a)) cancel(); }
    @Override public void onActivityDestroyed(Activity a) { if (isAdActivity(a)) cancel(); }
    private void cancel() { if (pending != null) { handler.removeCallbacks(pending); pending = null; } }

    private void addSkip(Activity a) {
        try {
            ViewGroup decor = (ViewGroup) a.getWindow().getDecorView();
            if (decor.findViewWithTag(TAG_ID) != null) return;
            float d = a.getResources().getDisplayMetrics().density;
            TextView tv = new TextView(a);
            tv.setTag(TAG_ID);
            tv.setText("رد تبلیغ  ✕");
            tv.setTextColor(Color.WHITE);
            tv.setTextSize(15);
            tv.setTypeface(Typeface.DEFAULT_BOLD);
            tv.setPadding((int) (18 * d), (int) (10 * d), (int) (18 * d), (int) (10 * d));
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(Color.parseColor("#E6111827"));
            bg.setCornerRadius(999 * d);
            bg.setStroke((int) (1.5f * d), Color.parseColor("#66FFFFFF"));
            tv.setBackground(bg);
            tv.setElevation(30 * d);
            tv.setAlpha(0f);
            FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.gravity = Gravity.TOP | Gravity.END;
            int statusBar = 0;
            int resId = a.getResources().getIdentifier("status_bar_height", "dimen", "android");
            if (resId > 0) statusBar = a.getResources().getDimensionPixelSize(resId);
            lp.topMargin = statusBar + (int) (12 * d);
            lp.rightMargin = (int) (14 * d);
            tv.setLayoutParams(lp);
            tv.setOnClickListener(v -> { try { a.finish(); } catch (Throwable ignored) {} });
            decor.addView(tv);
            tv.animate().alpha(1f).setDuration(220).start();
        } catch (Throwable ignored) {
            // never let the guard crash the ad or the app
        }
    }

    @Override public void onActivityCreated(Activity a, Bundle b) {}
    @Override public void onActivityStarted(Activity a) {}
    @Override public void onActivityStopped(Activity a) {}
    @Override public void onActivitySaveInstanceState(Activity a, Bundle b) {}
}
