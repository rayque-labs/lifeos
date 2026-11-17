package com.rayquelabs.lifeos;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.widget.Toast;

public class AssistantShortcutActivity extends Activity {
    private boolean requestedPermission;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestedPermission = state != null && state.getBoolean("requestedPermission");
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        state.putBoolean("requestedPermission", requestedPermission);
        super.onSaveInstanceState(state);
    }

    @Override
    protected void onPostResume() {
        super.onPostResume();
        if (!Intent.ACTION_ASSIST.equals(getIntent().getAction()) ||
            !AssistantOverlayService.isDefaultAssistant(this)) {
            finish();
            return;
        }
        try {
            if (Settings.canDrawOverlays(this)) {
                AssistantOverlayService.startFrom(this);
                finish();
            } else if (!requestedPermission) {
                requestedPermission = true;
                startActivity(AssistantOverlayService.permissionIntent(this));
            } else {
                showMessage("Autorize o LifeOS a aparecer sobre outros apps para chamar a Toph.");
                finish();
            }
        } catch (RuntimeException error) {
            showMessage("Abra o LifeOS e toque em Ativar Toph flutuante.");
            finish();
        }
    }

    private void showMessage(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }
}
