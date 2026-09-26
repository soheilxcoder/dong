package ir.dong.app;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Colors the Android status + navigation bars to match the in-app theme (no edge-to-edge overlap). */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    @PluginMethod
    public void setColors(PluginCall call) {
        final String status = call.getString("status", "#F7F9FA");
        final String nav = call.getString("nav", status);
        final boolean dark = Boolean.TRUE.equals(call.getBoolean("dark", false));
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                WindowCompat.setDecorFitsSystemWindows(w, true);
                w.setStatusBarColor(Color.parseColor(status));
                w.setNavigationBarColor(Color.parseColor(nav));
                if (Build.VERSION.SDK_INT >= 29) w.setNavigationBarContrastEnforced(false);
                View decor = w.getDecorView();
                WindowInsetsControllerCompat c = new WindowInsetsControllerCompat(w, decor);
                c.setAppearanceLightStatusBars(!dark);
                c.setAppearanceLightNavigationBars(!dark);
                call.resolve(new JSObject());
            } catch (Exception e) { call.reject(e.getMessage()); }
        });
    }
}
