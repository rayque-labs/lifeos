package com.rayquelabs.lifeos;

final class ScreenActionRules {
    static boolean supported(String app) {
        return java.util.Arrays.asList("com.android.chrome", "com.instagram.android", "com.facebook.katana", "com.facebook.lite", "com.whatsapp", "com.whatsapp.w4b", "com.spotify.music", "com.google.android.keep", "com.google.android.calendar", "com.google.android.calculator").contains(app);
    }
    static void checkFresh(long created, long now) {
        if (now < created || now - created > 120000) throw new IllegalStateException("Prévia expirada. Observe novamente.");
    }
    static void checkAction(String action, String text, boolean click, boolean edit, boolean scroll) {
        if ("click".equals(action) && click) return;
        if (("scroll-up".equals(action) || "scroll-down".equals(action)) && scroll) return;
        if ("type".equals(action) && edit && text != null && text.length() <= 1000) return;
        throw new IllegalStateException("Ação incompatível com o elemento observado.");
    }
}
