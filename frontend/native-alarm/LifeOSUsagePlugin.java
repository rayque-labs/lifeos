package com.rayquelabs.lifeos;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Process;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

@CapacitorPlugin(name = "LifeOSUsage")
public class LifeOSUsagePlugin extends Plugin {
  private boolean authorized() {
    AppOpsManager ops = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
    int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
    return mode == AppOpsManager.MODE_ALLOWED;
  }

  @PluginMethod public void status(PluginCall call) {
    JSObject result = new JSObject();
    result.put("authorized", authorized());
    call.resolve(result);
  }

  @PluginMethod public void openSettings(PluginCall call) {
    Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    try { getContext().startActivity(intent); call.resolve(); }
    catch (Exception e) { call.reject("Não foi possível abrir o acesso de uso", e); }
  }

  @PluginMethod public void getTodayUsage(PluginCall call) {
    if (!authorized()) { call.reject("Acesso às estatísticas de uso não autorizado"); return; }
    UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
    java.util.Calendar day = java.util.Calendar.getInstance();
    day.set(java.util.Calendar.HOUR_OF_DAY, 0);
    day.set(java.util.Calendar.MINUTE, 0);
    day.set(java.util.Calendar.SECOND, 0);
    day.set(java.util.Calendar.MILLISECOND, 0);
    long now = System.currentTimeMillis();
    List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, day.getTimeInMillis(), now);
    long total = 0;
    if (stats != null) for (UsageStats stat : stats) {
      if (!getContext().getPackageName().equals(stat.getPackageName())) total += Math.max(0, stat.getTotalTimeInForeground());
    }
    JSObject result = new JSObject();
    result.put("minutes", Math.round(total / 60000.0));
    result.put("observedAt", now);
    call.resolve(result);
  }
}
