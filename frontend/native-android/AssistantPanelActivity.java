package com.rayquelabs.lifeos;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;

public class AssistantPanelActivity extends MainActivity {
    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!AssistantOverlayService.isDefaultAssistant(this)) {
            finish();
            return;
        }
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        if (getBridge() != null) getBridge().getWebView().setBackgroundColor(Color.TRANSPARENT);
    }
}
