package ir.dong.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Background poller — the "no Google" notification channel.
 * Every ~15 minutes (Android's minimum for periodic work) it asks OUR server
 *   GET {api}/users/me/notifications?since=<last seen>
 * and shows anything new as a system notification. Tapping opens the related group.
 * Nothing leaves the phone except this request to the user's own Dong server.
 */
public class NotifyWorker extends Worker {
    static final String PREFS = "dong_notify";
    static final String CHANNEL = "dong";

    public NotifyWorker(@NonNull Context ctx, @NonNull WorkerParameters p) { super(ctx, p); }

    @NonNull
    @Override
    public Result doWork() {
        Context ctx = getApplicationContext();
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String api = sp.getString("apiUrl", null);
        String token = sp.getString("token", null);
        if (api == null || token == null) return Result.success();
        // The web app is open right now → it shows things in-app itself; avoid double notifications.
        if (sp.getBoolean("foreground", false)) return Result.success();

        String since = sp.getString("since", "");
        HttpURLConnection c = null;
        try {
            URL url = new URL(api + "/users/me/notifications?since=" + Uri.encode(since));
            c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(15000); c.setReadTimeout(15000);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/json");
            if (c.getResponseCode() == 401) { sp.edit().remove("token").apply(); return Result.success(); }
            if (c.getResponseCode() != 200) return Result.retry();
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8))) {
                String line; while ((line = r.readLine()) != null) sb.append(line);
            }
            JSONArray arr = new JSONArray(sb.toString());
            if (arr.length() == 0) return Result.success();
            ensureChannel(ctx);
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            String last = since;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject n = arr.getJSONObject(i);
                String gid = n.optString("groupId", "");
                String hash = gid.isEmpty() ? "#/" : "#/g/" + gid;
                Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("dong://open" + hash), ctx, MainActivity.class);
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                PendingIntent pi = PendingIntent.getActivity(ctx, n.optString("id").hashCode(), open, flags);
                Notification notif = new NotificationCompat.Builder(ctx, CHANNEL)
                        .setSmallIcon(R.drawable.ic_stat_dong)
                        .setColor(0xFF0FB88A)
                        .setContentTitle(n.optString("title", "دُنگ"))
                        .setContentText(n.optString("body", ""))
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(n.optString("body", "")))
                        .setAutoCancel(true)
                        .setContentIntent(pi)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .build();
                nm.notify(n.optString("id").hashCode(), notif);
                last = n.optString("createdAt", last);
            }
            sp.edit().putString("since", last).apply();
            return Result.success();
        } catch (Exception e) {
            return Result.retry();
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, "دُنگ", NotificationManager.IMPORTANCE_HIGH);
                ch.setDescription("هزینه‌ها، پرداخت‌ها و یادآوری‌ها");
                ch.enableVibration(true);
                nm.createNotificationChannel(ch);
            }
        }
    }
}
