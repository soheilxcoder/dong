package ir.dong.app;

import android.content.Context;
import android.content.SharedPreferences;

import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.TimeUnit;

/**
 * JS bridge for the Google-free background poller (see NotifyWorker).
 *   configure({ apiUrl, token })  → start polling the user's own server every ~15 min
 *   disable()                     → stop + forget credentials (logout / toggle off / FCM took over)
 *   checkNow()                    → one immediate poll (used right after the app goes to background)
 */
@CapacitorPlugin(name = "DongNotify")
public class DongNotifyPlugin extends Plugin {
    private static final String WORK = "dong-notify";

    private static String nowIso() {
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US);
        f.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
        return f.format(new java.util.Date());
    }

    private SharedPreferences prefs() { return getContext().getSharedPreferences(NotifyWorker.PREFS, Context.MODE_PRIVATE); }

    @PluginMethod
    public void configure(PluginCall call) {
        String api = call.getString("apiUrl");
        String token = call.getString("token");
        if (api == null || token == null) { call.reject("apiUrl and token required"); return; }
        SharedPreferences sp = prefs();
        String since = sp.getString("since", null);
        SharedPreferences.Editor ed = sp.edit().putString("apiUrl", api.replaceAll("/+$", "")).putString("token", token);
        if (since == null) ed.putString("since", nowIso()); // don't replay old history on first run
        ed.apply();
        NotifyWorker.ensureChannel(getContext());
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(NotifyWorker.class, 15, TimeUnit.MINUTES)
                .setConstraints(net).build();
        WorkManager.getInstance(getContext()).enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.KEEP, req);
        JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
    }

    @PluginMethod
    public void checkNow(PluginCall call) {
        Constraints net = new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build();
        WorkManager.getInstance(getContext()).enqueueUniqueWork(WORK + "-now", ExistingWorkPolicy.REPLACE,
                new OneTimeWorkRequest.Builder(NotifyWorker.class).setConstraints(net).build());
        call.resolve();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        WorkManager.getInstance(getContext()).cancelUniqueWork(WORK);
        prefs().edit().remove("apiUrl").remove("token").remove("since").apply();
        call.resolve();
    }

    // While the web view is in front, the web app itself shows new items (toast + refresh) → worker stays quiet.
    @Override protected void handleOnResume() { prefs().edit().putBoolean("foreground", true).apply(); }
    @Override protected void handleOnPause() {
        prefs().edit().putBoolean("foreground", false).apply();
    }
}
