package com.rayquelabs.lifeos;

import android.accessibilityservice.AccessibilityService;
import android.app.KeyguardManager;
import android.graphics.Rect;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.accessibility.AccessibilityWindowInfo;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Only explicit observations and one-shot, confirmed semantic actions. No background collection. */
public class TophAccessibilityService extends AccessibilityService {
    static volatile TophAccessibilityService connected;
    private Snapshot last;
    private boolean acting;
    private static final int MAX_NODES = 350;
    private static final int MAX_ELEMENTS = 70;
    private static final class Element {
        String id, label, path, resource;
        boolean click, edit, scroll;
        Rect bounds;
        JSObject json() { return new JSObject().put("id", id).put("label", label).put("click", click).put("edit", edit).put("scroll", scroll); }
    }
    private static final class Snapshot {
        String token, app, fingerprint;
        long created;
        boolean truncated;
        List<Element> elements = new ArrayList<>();
        JSObject json() {
            JSArray items = new JSArray();
            for (Element e : elements) items.put(e.json());
            return new JSObject().put("token", token).put("app", app).put("fingerprint", fingerprint).put("elements", items).put("truncated", truncated);
        }
    }
    @Override protected void onServiceConnected() { connected = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent event) { }
    @Override public void onInterrupt() { last = null; }
    @Override public void onDestroy() { last = null; if (connected == this) connected = null; super.onDestroy(); }
    private boolean supported(String name) { return ScreenActionRules.supported(name); }
    private AccessibilityNodeInfo externalRoot() {
        if (getSystemService(KeyguardManager.class).isKeyguardLocked()) throw new IllegalStateException("Desbloqueie a tela primeiro.");
        List<AccessibilityWindowInfo> windows = new ArrayList<>(getWindows());
        windows.sort((a, b) -> Integer.compare(b.getLayer(), a.getLayer()));
        for (AccessibilityWindowInfo window : windows) {
            if (window.getType() == AccessibilityWindowInfo.TYPE_SYSTEM && window.isFocused()) throw new IllegalStateException("Feche a janela do sistema antes de continuar.");
            if (window.getType() != AccessibilityWindowInfo.TYPE_APPLICATION) continue;
            AccessibilityNodeInfo root = window.getRoot();
            if (root == null) continue;
            String name = String.valueOf(root.getPackageName());
            if (getPackageName().equals(name)) { root.recycle(); continue; }
            if (!supported(name)) { root.recycle(); throw new IllegalStateException("Este aplicativo não está habilitado no executor. Abra Chrome, Instagram, Facebook, WhatsApp, Spotify, Keep, Agenda ou Calculadora."); }
            return root;
        }
        throw new IllegalStateException("Abra o aplicativo desejado e depois toque na Toph flutuante para observar a tela.");
    }
    private String label(AccessibilityNodeInfo node) {
        if (node.isEditable()) {
            CharSequence hint = android.os.Build.VERSION.SDK_INT >= 26 ? node.getHintText() : null;
            return hint == null ? "Campo de texto (conteúdo oculto)" : hint.toString().substring(0, Math.min(120, hint.length()));
        }
        CharSequence value = node.getText();
        if (value == null || value.length() == 0) value = node.getContentDescription();
        return value == null ? "" : value.toString().replaceAll("\\s+", " ").trim().substring(0, Math.min(120, value.toString().replaceAll("\\s+", " ").trim().length()));
    }
    private void walk(AccessibilityNodeInfo node, String path, Snapshot snapshot, StringBuilder signature, int[] visited) {
        if (++visited[0] > MAX_NODES) { snapshot.truncated = true; return; }
        if (!node.isVisibleToUser()) return;
        if (node.isPassword()) throw new IllegalStateException("Tela com senha: preencha manualmente e saia desta tela antes de usar o executor.");
        if (!snapshot.app.equals(String.valueOf(node.getPackageName()))) return;
        Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
        String title = label(node);
        String resource = String.valueOf(node.getViewIdResourceName());
        CharSequence content = node.getText();
        String boundedContent = content == null ? "" : content.subSequence(0, Math.min(2000, content.length())).toString();
        // Hash values locally to invalidate stale editable nodes; never include them in the returned snapshot.
        signature.append(path).append('|').append(resource).append('|').append(title).append('|').append(bounds.toShortString())
            .append('|').append(node.isEnabled()).append('|').append(node.isChecked()).append('|').append(boundedContent).append('\n');
        boolean click = node.isEnabled() && node.isClickable();
        boolean edit = node.isEnabled() && node.isEditable();
        boolean scroll = node.isEnabled() && node.isScrollable();
        if ((!title.isEmpty() || click || edit || scroll) && snapshot.elements.size() < MAX_ELEMENTS) {
            Element e = new Element(); e.id = "e" + snapshot.elements.size(); e.label = title.isEmpty() ? "Controle sem rótulo" : title;
            e.path = path; e.resource = resource; e.bounds = bounds; e.click = click; e.edit = edit; e.scroll = scroll;
            snapshot.elements.add(e);
        } else if (snapshot.elements.size() >= MAX_ELEMENTS) snapshot.truncated = true;
        for (int i = 0; i < node.getChildCount() && visited[0] <= MAX_NODES; i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child == null) continue;
            try { walk(child, path + "/" + i, snapshot, signature, visited); } finally { child.recycle(); }
        }
    }
    private Snapshot snapshot() {
        AccessibilityNodeInfo root = externalRoot();
        try {
            Snapshot snapshot = new Snapshot(); snapshot.app = String.valueOf(root.getPackageName());
            snapshot.token = UUID.randomUUID().toString(); snapshot.created = SystemClock.elapsedRealtime();
            StringBuilder signature = new StringBuilder(snapshot.app).append(root.getWindowId());
            walk(root, "", snapshot, signature, new int[]{0});
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(signature.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(); for (byte b : hash) hex.append(String.format("%02x", b));
            snapshot.fingerprint = hex.toString(); return snapshot;
        } catch (RuntimeException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Não consegui conferir a tela."); }
        finally { root.recycle(); }
    }
    JSObject observe() {
        if (acting) throw new IllegalStateException("Aguarde a ação em andamento.");
        last = null;
        last = snapshot();
        return last.json();
    }
    void discard() { last = null; }
    JSObject act(String token, String id, String action, String text) {
        if (acting) throw new IllegalStateException("Já há uma ação em andamento.");
        Snapshot original = last; last = null; // Consume even failed attempts; never replay a tap.
        if (original == null || !original.token.equals(token)) throw new IllegalStateException("Prévia expirada. Observe a tela novamente.");
        ScreenActionRules.checkFresh(original.created, SystemClock.elapsedRealtime());
        Element target = null;
        for (Element e : original.elements) if (e.id.equals(id)) target = e;
        if (target == null) throw new IllegalStateException("Elemento não observado.");
        ScreenActionRules.checkAction(action, text, target.click, target.edit, target.scroll);
        Snapshot fresh = snapshot();
        if (!original.app.equals(fresh.app) || !original.fingerprint.equals(fresh.fingerprint)) throw new IllegalStateException("A tela mudou desde a proposta. Observe novamente para evitar tocar no lugar errado.");
        AccessibilityNodeInfo root = externalRoot();
        AccessibilityNodeInfo node = root;
        acting = true;
        try {
            for (String part : target.path.split("/")) {
                if (part.isEmpty()) continue;
                AccessibilityNodeInfo child = node.getChild(Integer.parseInt(part));
                if (node != root) node.recycle();
                node = child;
                if (node == null) throw new IllegalStateException("O elemento desapareceu.");
            }
            Rect actual = new Rect(); node.getBoundsInScreen(actual);
            if (!node.isVisibleToUser() || !node.isEnabled() || node.isPassword() || !original.app.equals(String.valueOf(node.getPackageName())) || !actual.equals(target.bounds)
                || !String.valueOf(node.getViewIdResourceName()).equals(target.resource) || !(label(node).isEmpty() ? "Controle sem rótulo" : label(node)).equals(target.label)) throw new IllegalStateException("O elemento mudou. Observe novamente.");
            ScreenActionRules.checkAction(action, text, node.isClickable(), node.isEditable(), node.isScrollable());
            boolean accepted;
            if ("type".equals(action)) {
                Bundle args = new Bundle(); args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
                accepted = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
            } else accepted = node.performAction("click".equals(action) ? AccessibilityNodeInfo.ACTION_CLICK : "scroll-down".equals(action) ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD);
            if (!accepted) throw new IllegalStateException("O aplicativo recusou a ação. Nenhuma repetição automática foi feita.");
            JSObject receipt = new JSObject().put("accepted", true).put("app", original.app).put("before", original.fingerprint);
            if ("type".equals(action)) receipt.put("valueVerified", node.refresh() && text.contentEquals(node.getText() == null ? "" : node.getText()));
            return receipt;
        } finally { if (node != null && node != root) node.recycle(); root.recycle(); acting = false; }
    }
}
