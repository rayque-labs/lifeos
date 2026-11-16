package com.rayquelabs.lifeos;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.ResultReceiver;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

public final class ScreenReadingService extends Service {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private MediaProjection projection;
    private VirtualDisplay display;
    private ImageReader reader;
    private ResultReceiver result;
    private TextRecognizer recognizer;
    private boolean captured;

    private final MediaProjection.Callback callback = new MediaProjection.Callback() {
        @Override public void onStop() {
            if (!captured) finish(null, "A captura foi encerrada pelo Android.");
        }
    };

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override public int onStartCommand(Intent request, int flags, int startId) {
        if (request == null || result != null) {
            if (request == null) stopSelf();
            return START_NOT_STICKY;
        }
        result = request.getParcelableExtra("receiver");
        Intent permission = request.getParcelableExtra("permission");
        if (result == null || permission == null) {
            finish(null, "A autorização de captura não está disponível.");
            return START_NOT_STICKY;
        }

        try {
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= 26) {
                getSystemService(NotificationManager.class).createNotificationChannel(
                    new NotificationChannel("lifeos_screen", "Leitura de tela", NotificationManager.IMPORTANCE_LOW));
                builder = new Notification.Builder(this, "lifeos_screen");
            } else {
                builder = new Notification.Builder(this);
            }
            Notification notice = builder.setSmallIcon(android.R.drawable.ic_menu_camera)
                .setContentTitle("Toph está lendo a tela").setOngoing(true).build();
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(708, notice, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
            } else {
                startForeground(708, notice);
            }

            projection = getSystemService(MediaProjectionManager.class)
                .getMediaProjection(Activity.RESULT_OK, permission);
            if (projection == null) throw new IllegalStateException("Sem sessão de captura");
            projection.registerCallback(callback, handler);
            DisplayMetrics metrics = new DisplayMetrics();
            getSystemService(WindowManager.class).getDefaultDisplay().getRealMetrics(metrics);
            reader = ImageReader.newInstance(metrics.widthPixels, metrics.heightPixels, PixelFormat.RGBA_8888, 2);
            ImageReader.OnImageAvailableListener read = source -> {
                try (Image frame = source.acquireLatestImage()) {
                    if (frame != null && !captured) {
                        capture(frame);
                    }
                } catch (RuntimeException error) {
                    if (!captured) finish(null, "Não consegui obter a imagem da tela.");
                }
            };
            handler.postDelayed(() -> {
                if (reader == null) return;
                reader.setOnImageAvailableListener(read, handler);
                read.onImageAvailable(reader);
            }, 650);
            display = projection.createVirtualDisplay("LifeOS screen reading", metrics.widthPixels, metrics.heightPixels,
                metrics.densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.getSurface(), null, handler);
            if (display == null) throw new IllegalStateException("Sem tela virtual");
            handler.postDelayed(() -> finish(null, "A leitura da tela demorou demais. Tente novamente."), 12000);
        } catch (RuntimeException error) {
            finish(null, "Não consegui iniciar a captura de tela autorizada.");
        }
        return START_NOT_STICKY;
    }

    private void capture(Image frame) {
        Image.Plane plane = frame.getPlanes()[0];
        int paddedWidth = plane.getRowStride() / plane.getPixelStride();
        Bitmap padded = Bitmap.createBitmap(paddedWidth, frame.getHeight(), Bitmap.Config.ARGB_8888);
        padded.copyPixelsFromBuffer(plane.getBuffer());
        Bitmap bitmap = Bitmap.createBitmap(padded, 0, 0, frame.getWidth(), frame.getHeight());
        if (padded != bitmap) padded.recycle();
        captured = true;
        handler.post(() -> {
            releaseProjection();
            if (result == null) { bitmap.recycle(); return; }
            try {
                recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                recognizer.process(InputImage.fromBitmap(bitmap, 0))
                    .addOnSuccessListener(text -> {
                        String value = text.getText().trim();
                        if (value.isEmpty()) finish(null, "Não encontrei texto legível. A tela pode estar protegida.");
                        else finish(value.substring(0, Math.min(4000, value.length())), null);
                    })
                    .addOnFailureListener(error -> finish(null, "Não consegui reconhecer o texto da tela."))
                    .addOnCompleteListener(task -> bitmap.recycle());
            } catch (RuntimeException error) {
                bitmap.recycle();
                finish(null, "Não consegui iniciar o reconhecimento de texto.");
            }
        });
    }

    private void releaseProjection() {
        if (display != null) { display.release(); display = null; }
        if (reader != null) { reader.close(); reader = null; }
        if (projection != null) {
            projection.unregisterCallback(callback);
            projection.stop();
            projection = null;
        }
    }

    private void deliver(String text, String error) {
        if (result == null) return;
        Bundle payload = new Bundle();
        payload.putString("text", text);
        payload.putString("error", error);
        result.send(error == null ? Activity.RESULT_OK : Activity.RESULT_CANCELED, payload);
        result = null;
    }

    private void finish(String text, String error) {
        deliver(text, error);
        stopSelf();
    }

    @Override public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        releaseProjection();
        if (recognizer != null) recognizer.close();
        deliver(null, "A leitura de tela foi encerrada.");
        super.onDestroy();
    }
}
