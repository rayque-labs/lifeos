package com.rayquelabs.lifeos;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Toast;

public class TophAccessibilityService extends AccessibilityService {
    static TophAccessibilityService connected;

    @Override
    protected void onServiceConnected() { connected = this; }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {}

    @Override
    public void onInterrupt() {}

    @Override
    public void onDestroy() {
        if (connected == this) connected = null;
        super.onDestroy();
    }

    void perform(String target, String action, String text, int x, int y) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || !target.equals(String.valueOf(root.getPackageName()))) {
            notice("Abra o aplicativo solicitado e tente novamente.");
            return;
        }
        if ("type".equals(action)) {
            AccessibilityNodeInfo field = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
            if (field == null || field.isPassword() || !field.isEditable() ||
                !target.equals(String.valueOf(field.getPackageName()))) {
                notice("Toque em um campo de texto desse aplicativo primeiro.");
                return;
            }
            Bundle args = new Bundle();
            args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
            if (!field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)) notice("O aplicativo recusou a digitação.");
            return;
        }
        Rect bounds = new Rect();
        root.getBoundsInScreen(bounds);
        if (bounds.isEmpty()) {
            notice("A área do aplicativo está indisponível.");
            return;
        }
        int width = bounds.width();
        int height = bounds.height();
        Path path = new Path();
        boolean tap = "tap".equals(action);
        if (tap) {
            path.moveTo(bounds.left + (width - 1) * x / 100f, bounds.top + (height - 1) * y / 100f);
        } else {
            boolean down = "down".equals(action);
            path.moveTo(bounds.left + width * .5f, bounds.top + height * (down ? .74f : .3f));
            path.lineTo(bounds.left + width * .5f, bounds.top + height * (down ? .3f : .74f));
        }
        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(new GestureDescription.StrokeDescription(path, 0, tap ? 65 : 380)).build();
        if (!dispatchGesture(gesture, null, null)) notice("O Android recusou o gesto.");
    }

    private void notice(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }
}
