package com.rayquelabs.lifeos;

import android.app.*;
import android.content.*;
import android.os.Build;

public class AlarmReceiver extends android.content.BroadcastReceiver {
  public static final String CHANNEL = "lifeos_alarms";
  @Override public void onReceive(Context context, Intent intent) {
    String title = intent.getStringExtra("title");
    if (title == null) title = "Lembrete LifeOS";
    int id = intent.getIntExtra("id", 1);
    intent.putExtra("speech", AlarmPersonality.announce(context, id, title, intent.getStringExtra("category")));
    NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(CHANNEL, "Alarmes LifeOS", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Alarmes e lembretes importantes");
      channel.enableVibration(true);
      manager.createNotificationChannel(channel);
    }
    Intent screen = new Intent(context, AlarmActivity.class);
    screen.putExtras(intent);
    screen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent full = PendingIntent.getActivity(context, id, screen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(context, CHANNEL) : new Notification.Builder(context);
    builder.setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(title)
      .setContentText("Seu alarme LifeOS está tocando").setCategory(Notification.CATEGORY_ALARM)
      .setPriority(Notification.PRIORITY_MAX).setAutoCancel(false).setOngoing(true)
      .setContentIntent(full).setFullScreenIntent(full, true);
    try { manager.notify(id, builder.build()); } catch (SecurityException ignored) {}
    // Full-screen intent is controlled by Android permissions and lock-screen policy.
  }
}
