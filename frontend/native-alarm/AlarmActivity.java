package com.rayquelabs.lifeos;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.os.*;
import android.speech.tts.TextToSpeech;
import android.view.*;
import android.widget.*;
import java.util.Locale;

public class AlarmActivity extends Activity {
  private TextToSpeech tts;
  private Vibrator vibrator;
  private final Handler handler = new Handler(Looper.getMainLooper());
  private int id;
  private String title;
  private String message;
  private boolean stopped = false;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    if (Build.VERSION.SDK_INT >= 27) setShowWhenLocked(true);
    if (Build.VERSION.SDK_INT >= 27) setTurnScreenOn(true);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
      WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    getWindow().getDecorView().setSystemUiVisibility(5894 | 1024 | 512);
    id = getIntent().getIntExtra("id", 1);
    title = getIntent().getStringExtra("title");
    if (title == null) title = "Seu compromisso";
    message = getIntent().getStringExtra("speech");
    if (message == null || message.trim().isEmpty()) message = "Ei, chegou a hora de " + title + ". Vamos nessa?";
    vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
    if (vibrator != null && vibrator.hasVibrator()) {
      if (Build.VERSION.SDK_INT >= 26) vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 450, 300, 450}, 0));
      else vibrator.vibrate(new long[]{0, 450, 300, 450}, 0);
    }
    LinearLayout root = new LinearLayout(this);
    root.setOrientation(LinearLayout.VERTICAL);
    root.setGravity(Gravity.CENTER);
    root.setPadding(36, 40, 36, 40);
    root.setBackgroundColor(Color.rgb(16,16,16));
    TextView brand = text("LIFEOS  •  ALARME", 16, 0xFFC5FF4A);
    TextView heading = text(title, 30, Color.WHITE);
    TextView transcript = text(message, 17, 0xFFCCCCCC);
    root.addView(brand); root.addView(heading); root.addView(transcript);
    Button snooze = new Button(this); snooze.setText("ADIAR 5 MIN"); root.addView(snooze);
    Button stop = new Button(this); stop.setText("PARAR ALARME"); root.addView(stop);
    Button mute = new Button(this); mute.setText("SILENCIAR VOZ"); root.addView(mute);
    snooze.setOnClickListener(v -> {
      Intent next = new Intent(this, AlarmReceiver.class);
      next.putExtra("id", id); next.putExtra("title", title);
      next.putExtra("speech", "Ah, de novo? Seu lembrete voltou: " + title);
      PendingIntent pending = PendingIntent.getBroadcast(this, id, next, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      AlarmManager alarms = (AlarmManager) getSystemService(ALARM_SERVICE);
      long at = System.currentTimeMillis() + 300000L;
      try {
        if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms()) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
        else alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending);
      } catch (SecurityException e) { alarms.set(AlarmManager.RTC_WAKEUP, at, pending); }
      closeAlarm();
    });
    stop.setOnClickListener(v -> closeAlarm());
    mute.setOnClickListener(v -> { if (tts != null) tts.stop(); mute.setEnabled(false); });
    setContentView(root);
    tts = new TextToSpeech(this, status -> {
      if (status == TextToSpeech.SUCCESS) {
        tts.setLanguage(new Locale("pt", "BR"));
        tts.setSpeechRate(1.03f);
        handler.postDelayed(() -> {
          if (!stopped && tts != null) {
            if (vibrator != null) vibrator.cancel();
            tts.speak(message, TextToSpeech.QUEUE_FLUSH, null, "lifeos-" + id);
          }
        }, 2000);
      }
    });
  }
  private TextView text(String value, int size, int color) {
    TextView view = new TextView(this);
    view.setText(value); view.setTextSize(size); view.setTextColor(color);
    view.setGravity(Gravity.CENTER); view.setPadding(0, 22, 0, 22); return view;
  }
  private void closeAlarm() {
    stopped = true;
    if (vibrator != null) vibrator.cancel();
    if (tts != null) tts.stop();
    ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).cancel(id);
    finish();
  }
  @Override protected void onDestroy() {
    handler.removeCallbacksAndMessages(null);
    if (vibrator != null) vibrator.cancel();
    if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
    super.onDestroy();
  }
}
