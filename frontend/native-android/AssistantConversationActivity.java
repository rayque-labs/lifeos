package com.rayquelabs.lifeos;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.Gravity;
import android.view.WindowManager;

public class AssistantConversationActivity extends MainActivity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!AssistantOverlayService.isDefaultAssistant(this)) {
            finish();
            return;
        }
        setCompactVoice(true);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        if (getBridge() != null) getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
    }
    void setCompactVoice(boolean compact) {
        WindowManager.LayoutParams params = getWindow().getAttributes();
        params.gravity = compact ? Gravity.BOTTOM | Gravity.LEFT : Gravity.CENTER;
        params.width = compact ? Math.round(300 * getResources().getDisplayMetrics().density) : WindowManager.LayoutParams.MATCH_PARENT;
        params.height = compact ? Math.round(125 * getResources().getDisplayMetrics().density) : WindowManager.LayoutParams.MATCH_PARENT;
        getWindow().setAttributes(params);
        if (compact) getWindow().addFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
    }
}
