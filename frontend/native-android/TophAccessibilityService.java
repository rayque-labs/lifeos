package com.rayquelabs.lifeos;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.GestureDescription;
import android.graphics.Path;
import android.graphics.Rect;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import java.util.ArrayDeque;
import java.util.LinkedHashSet;
import java.util.Locale;
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

    private String supportedApp(CharSequence packageName) {
        String name = String.valueOf(packageName);
        if ("com.android.chrome".equals(name)) return "Chrome";
        if ("com.instagram.android".equals(name)) return "Instagram";
        if ("com.whatsapp".equals(name) || "com.whatsapp.w4b".equals(name)) return "WhatsApp";
        if ("com.google.android.calendar".equals(name)) return "Agenda";
        if ("com.google.android.calculator".equals(name)) return "Calculadora";
        if ("com.google.android.keep".equals(name)) return "Keep";
        return null;
    }

    String describeScreen() {
        AccessibilityNodeInfo root = null;
        for (AccessibilityWindowInfo window : getWindows()) {
            if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
            AccessibilityNodeInfo candidate = window.getRoot();
            if (candidate == null) break;
            if (getPackageName().contentEquals(String.valueOf(candidate.getPackageName()))) continue;
            root = candidate;
            break;
        }
        if (root == null) {
            AccessibilityNodeInfo active = getRootInActiveWindow();
            if (active != null && !getPackageName().contentEquals(String.valueOf(active.getPackageName()))) root = active;
        }
        if (root == null) return null;
        String app = supportedApp(root.getPackageName());
        if (app == null) throw new IllegalStateException("A leitura da tela não está habilitada para esse aplicativo.");
        LinkedHashSet<String> texts = new LinkedHashSet<>();
        LinkedHashSet<String> controls = new LinkedHashSet<>();
        int visited = 0;
        ArrayDeque<AccessibilityNodeInfo> nodes = new ArrayDeque<>();
        nodes.add(root);
        while (!nodes.isEmpty() && visited++ < 450 && (texts.size() < 12 || controls.size() < 8)) {
            AccessibilityNodeInfo node = nodes.removeFirst();
            if (!node.isVisibleToUser() || node.isPassword() || node.isEditable() ||
                !String.valueOf(root.getPackageName()).contentEquals(String.valueOf(node.getPackageName()))) continue;
            String label = nodeLabel(node);
            if (!label.isEmpty()) {
                if (node.isClickable() && controls.size() < 8) controls.add(label);
                else if (!node.isClickable() && texts.size() < 12) texts.add(label);
            }
            for (int i = 0; i < node.getChildCount() && nodes.size() < 450; i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) nodes.addLast(child);
            }
        }
        texts.removeAll(controls);
        String result = "Tela do " + app;
        if (!texts.isEmpty()) result += "\n\nTextos visíveis\n• " + TextUtils.join("\n• ", texts);
        if (!controls.isEmpty()) result += "\n\nElementos acionáveis\n• " + TextUtils.join("\n• ", controls);
        if (texts.isEmpty() && controls.isEmpty()) result += "\n\nO app não disponibilizou texto legível para esta tela.";
        return result;
    }

    private String nodeLabel(AccessibilityNodeInfo node) {
        CharSequence raw = node.getText();
        if (raw == null || raw.length() == 0) raw = node.getContentDescription();
        if (raw == null) return "";
        String value = raw.subSequence(0, Math.min(raw.length(), 160)).toString().replaceAll("\\s+", " ").trim();
        return value;
    }

    boolean targetFocused(String target) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        return root != null && target.contentEquals(String.valueOf(root.getPackageName()));
    }

    private void clickLabel(AccessibilityNodeInfo root, String text) {
        String label = text.trim().toLowerCase(Locale.ROOT);
        LinkedHashSet<AccessibilityNodeInfo> matches = new LinkedHashSet<>();
        ArrayDeque<AccessibilityNodeInfo> nodes = new ArrayDeque<>();
        nodes.add(root);
        int visited = 0;
        while (!nodes.isEmpty() && visited++ < 500) {
            AccessibilityNodeInfo node = nodes.removeFirst();
            if (!node.isVisibleToUser() || node.isPassword() || node.isEditable() ||
                !String.valueOf(root.getPackageName()).contentEquals(String.valueOf(node.getPackageName()))) continue;
            if (nodeLabel(node).toLowerCase(Locale.ROOT).equals(label)) {
                AccessibilityNodeInfo button = node;
                for (int step = 0; button != null && step < 5; step++, button = button.getParent()) {
                    if (!String.valueOf(root.getPackageName()).contentEquals(String.valueOf(button.getPackageName()))) break;
                    if (button.isClickable() && button.isEnabled() && button.isVisibleToUser() && !button.isEditable()) {
                        matches.add(button);
                        break;
                    }
                }
                if (matches.size() > 1) break;
            }
            for (int i = 0; i < node.getChildCount() && nodes.size() < 500; i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) nodes.addLast(child);
            }
        }
        if (matches.size() != 1) {
            notice(matches.isEmpty() ? "Não encontrei esse botão na tela." : "Há mais de um botão com esse nome.");
        } else if (matches.iterator().next().performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
            notice("Elemento acionado.");
        } else {
            notice("O aplicativo recusou o toque.");
        }
    }

    void perform(String target, String action, String text, int x, int y) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null || !target.equals(String.valueOf(root.getPackageName()))) {
            notice("Abra o aplicativo solicitado e tente novamente.");
            return;
        }
        if ("click".equals(action)) {
            clickLabel(root, text);
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
            notice(field.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args) ? "Texto inserido." : "O aplicativo recusou a digitação.");
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
        GestureResultCallback callback = new GestureResultCallback() {
            @Override public void onCompleted(GestureDescription value) { notice("Gesto concluído."); }
            @Override public void onCancelled(GestureDescription value) { notice("O gesto foi interrompido."); }
        };
        if (!dispatchGesture(gesture, callback, null)) notice("O Android recusou o gesto.");
    }

    void notice(String text) { Toast.makeText(this, text, Toast.LENGTH_SHORT).show(); }
}
