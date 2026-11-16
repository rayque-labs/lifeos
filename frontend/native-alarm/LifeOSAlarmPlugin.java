package com.rayquelabs.lifeos;

import android.app.*;
import android.content.*;
import android.os.Build;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LifeOSAlarm")
public class LifeOSAlarmPlugin extends Plugin {
  @PluginMethod public void schedule(PluginCall call) {
    Integer id = call.getInt("id");
    Long at = call.getLong("at");
    String title = call.getString("title");
    if (id == null || at == null || title == null || at <= System.currentTimeMillis()) {
      call.reject("Informe id, title e at (timestamp futuro em milissegundos)"); return;
    }
    Intent intent = new Intent(getContext(), AlarmReceiver.class);
    intent.putExtra("id", id); intent.putExtra("title", title);
    intent.putExtra("speech", call.getString("speech", ""));
    PendingIntent pending = PendingIntent.getBroadcast(getContext(), id, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    AlarmManager manager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
    boolean exact = Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms();
    try {
      if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
      else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
      JSObject result = new JSObject(); result.put("exact", exact); call.resolve(result);
    } catch (SecurityException e) { call.reject("Permissão para alarmes exatos indisponível", e); }
  }
  @PluginMethod public void cancel(PluginCall call) {
    Integer id = call.getInt("id");
    if (id == null) { call.reject("id obrigatório"); return; }
    Intent intent = new Intent(getContext(), AlarmReceiver.class);
    PendingIntent pending = PendingIntent.getBroadcast(getContext(), id, intent, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
    if (pending != null) {
      ((AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)).cancel(pending);
      pending.cancel();
    }
    call.resolve();
  }
}
