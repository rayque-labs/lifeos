package com.rayquelabs.lifeos;

import android.content.Intent;
import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (!(this instanceof AssistantConversationActivity)) SplashScreen.installSplashScreen(this);
        registerPlugin(LifeOSAssistant.class);
        registerPlugin(TophFiles.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        AssistantOverlayService.activityVisibilityChanged(true);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!(this instanceof AssistantConversationActivity) && overlayDataChanged && getBridge() != null) {
            overlayDataChanged = false;
            getBridge().triggerWindowJSEvent("lifeos:overlay-data-changed");
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus || this instanceof AssistantConversationActivity) return;

        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        bars.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
    }

    @Override
    public void onStop() {
        AssistantOverlayService.activityVisibilityChanged(false);
        super.onStop();
    }

    static volatile boolean overlayDataChanged;

    @Override
    protected void onNewIntent(Intent intent) {
        setIntent(intent);
        super.onNewIntent(intent);
    }
}
