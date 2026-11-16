package com.rayquelabs.lifeos;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.role.RoleManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.content.res.Configuration;
import android.database.ContentObserver;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.WindowManager;

import java.io.IOException;
import java.io.InputStream;

public class AssistantOverlayService extends Service {
    private static final String CHANNEL = "lifeos_assistant_overlay";
    private static final String STOP = "com.rayquelabs.lifeos.STOP_OVERLAY";
    private static AssistantOverlayService instance;
    private static int resumedActivities;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ContentObserver assistantChange = new ContentObserver(handler) {
        @Override
        public void onChange(boolean selfChange) { updateMascot(); }
    };
    private WindowManager windows;
    private WindowManager.LayoutParams placement;
    private View mascot;
    private Bitmap artwork;
    private boolean showing;
    private boolean panelOpening;

    static boolean isRunning() {
        return instance != null;
    }

    static boolean isDefaultAssistant(Context context) {
        if (Build.VERSION.SDK_INT >= 29) {
            RoleManager roles = context.getSystemService(RoleManager.class);
            return roles != null && roles.isRoleHeld(RoleManager.ROLE_ASSISTANT);
        }
        String selected = Settings.Secure.getString(context.getContentResolver(), "assistant");
        ComponentName component = selected == null ? null : ComponentName.unflattenFromString(selected);
        return component != null && context.getPackageName().equals(component.getPackageName());
    }

    static void activityVisibilityChanged(boolean visible) {
        resumedActivities = Math.max(0, resumedActivities + (visible ? 1 : -1));
        if (instance != null) instance.updateMascot();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windows = getSystemService(WindowManager.class);
        getContentResolver().registerContentObserver(Settings.Secure.getUriFor("assistant"), false, assistantChange);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || STOP.equals(intent.getAction()) ||
            !Settings.canDrawOverlays(this) || !isDefaultAssistant(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        NotificationManager notifications = getSystemService(NotificationManager.class);
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= 26) {
            notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "Toph flutuante", NotificationManager.IMPORTANCE_LOW));
            builder = new Notification.Builder(this, CHANNEL);
        } else {
            builder = new Notification.Builder(this);
        }
        PendingIntent stop = PendingIntent.getService(this, 0,
            new Intent(this, AssistantOverlayService.class).setAction(STOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = builder.setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setContentTitle("Toph flutuante")
            .setContentText("Disponível sobre outros aplicativos")
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "Encerrar Toph", stop).build())
            .build();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(706, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(706, notification);
        }
        updateMascot();
        return START_NOT_STICKY;
    }

    private void updateMascot() {
        if (!Settings.canDrawOverlays(this) || !isDefaultAssistant(this)) {
            hideMascot();
            stopSelf();
            return;
        }
        if (resumedActivities > 0 || panelOpening) {
            hideMascot();
            return;
        }
        if (showing) return;
        if (mascot == null) {
            try (InputStream input = getAssets().open("public/toph-artwork.jpg")) {
                BitmapFactory.Options options = new BitmapFactory.Options();
                options.inSampleSize = 2;
                artwork = BitmapFactory.decodeStream(input, null, options);
                if (artwork == null) throw new IOException("Imagem inválida");
            } catch (IOException error) {
                Log.e(CHANNEL, "Não foi possível abrir a arte da Toph", error);
                stopSelf();
                return;
            }
            mascot = new MascotView();
            mascot.setContentDescription("Abrir conversa com a Toph");
            mascot.setOnClickListener(view -> openConversation());
            mascot.setOnTouchListener(new MascotDrag());
            int type = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;
            placement = new WindowManager.LayoutParams(dp(88), dp(100), type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
            placement.gravity = Gravity.TOP | Gravity.LEFT;
            placement.x = dp(10);
            placement.y = displaySize().y - dp(190);
        }
        clampPosition();
        try {
            windows.addView(mascot, placement);
            showing = true;
        } catch (WindowManager.BadTokenException | SecurityException error) {
            Log.e(CHANNEL, "A sobreposição da Toph foi bloqueada", error);
            stopSelf();
        }
    }

    private void openConversation() {
        if (!Settings.canDrawOverlays(this) || !isDefaultAssistant(this)) {
            updateMascot();
            return;
        }
        panelOpening = true;
        try {
            startActivity(new Intent(this, AssistantPanelActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (RuntimeException error) {
            Log.w(CHANNEL, "O Android bloqueou a abertura do painel", error);
        } finally {
            handler.postDelayed(() -> {
                panelOpening = false;
                if (instance == this) updateMascot();
            }, 700);
        }
    }

    private int dp(int amount) {
        return Math.round(amount * getResources().getDisplayMetrics().density);
    }

    private Point displaySize() {
        Point size = new Point();
        windows.getDefaultDisplay().getRealSize(size);
        return size;
    }

    private void clampPosition() {
        Point size = displaySize();
        placement.x = Math.max(0, Math.min(placement.x, size.x - placement.width));
        placement.y = Math.max(0, Math.min(placement.y, size.y - placement.height - dp(28)));
    }

    @Override
    public void onConfigurationChanged(Configuration configuration) {
        super.onConfigurationChanged(configuration);
        if (showing) {
            clampPosition();
            windows.updateViewLayout(mascot, placement);
        }
    }

    private void hideMascot() {
        if (showing) windows.removeViewImmediate(mascot);
        showing = false;
    }

    @Override
    public void onDestroy() {
        getContentResolver().unregisterContentObserver(assistantChange);
        handler.removeCallbacksAndMessages(null);
        hideMascot();
        instance = null;
        super.onDestroy();
    }

    private class MascotDrag implements View.OnTouchListener {
        private float downX;
        private float downY;
        private int originX;
        private int originY;
        private boolean moved;
        private final int threshold = ViewConfiguration.get(AssistantOverlayService.this).getScaledTouchSlop();

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downX = event.getRawX();
                    downY = event.getRawY();
                    originX = placement.x;
                    originY = placement.y;
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = event.getRawX() - downX;
                    float dy = event.getRawY() - downY;
                    if (!moved && Math.hypot(dx, dy) < threshold) return true;
                    moved = true;
                    placement.x = originX + Math.round(dx);
                    placement.y = originY + Math.round(dy);
                    clampPosition();
                    if (showing) windows.updateViewLayout(mascot, placement);
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) view.performClick();
                    return true;
                case MotionEvent.ACTION_CANCEL:
                    return true;
                default:
                    return false;
            }
        }
    }

    private class MascotView extends View {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
        private final RectF artworkBounds = new RectF(-160, 0, 1376, 1024);
        private final Path silhouette = new Path();

        MascotView() {
            super(AssistantOverlayService.this);
            // Coordinates follow the original artwork, with the poster copy and pedestal outside the silhouette.
            int[] points = { 18,220, 24,135, 100,54, 254,4, 371,3, 441,23, 468,50, 458,88,
                422,66, 343,57, 262,73, 186,125, 150,173, 205,169, 328,104, 454,98, 531,107,
                577,125, 602,154, 629,210, 673,263, 664,313, 688,374, 690,446, 660,497, 590,523,
                477,538, 520,551, 566,582, 598,634, 599,707, 575,724, 534,658, 511,626, 485,665,
                465,721, 403,779, 343,846, 323,832, 311,746, 281,738, 215,754, 135,778, 129,814,
                150,852, 239,921, 207,920, 131,875, 94,826, 58,778, 66,736, 104,699, 177,683,
                271,669, 300,642, 295,607, 251,595, 205,611, 135,587, 123,572, 146,549, 211,527,
                289,530, 346,516, 278,513, 207,489, 157,473, 126,448, 111,397, 104,339, 128,291,
                146,273, 98,272, 38,258 };
            silhouette.moveTo(points[0], points[1]);
            for (int i = 2; i < points.length; i += 2) silhouette.lineTo(points[i], points[i + 1]);
            silhouette.close();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            canvas.save();
            canvas.scale(getWidth() / 900f, getHeight() / 1024f);
            canvas.translate(72, 38);
            canvas.clipPath(silhouette);
            canvas.drawBitmap(artwork, null, artworkBounds, paint);
            canvas.restore();
        }
    }
}
