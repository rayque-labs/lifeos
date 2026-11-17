package com.rayquelabs.lifeos;
public class ScreenActionRulesTest {
    private static int checks;
    private static void ok(boolean value) { checks++; if (!value) throw new AssertionError(); }
    private static void rejects(Runnable action) { checks++; try { action.run(); } catch (IllegalStateException expected) { return; } throw new AssertionError("accepted unsafe action"); }
    public static void main(String[] args) {
        ok(ScreenActionRules.supported("com.android.chrome"));
        ok(ScreenActionRules.supported("com.spotify.music"));
        ok(!ScreenActionRules.supported("com.android.settings"));
        ok(!ScreenActionRules.supported("com.bank.app"));
        ScreenActionRules.checkFresh(100, 120100);
        rejects(() -> ScreenActionRules.checkFresh(100, 120101));
        rejects(() -> ScreenActionRules.checkFresh(100, 99));
        rejects(() -> ScreenActionRules.checkAction("type", "secret", true, false, false));
        rejects(() -> ScreenActionRules.checkAction("scroll-down", "", true, true, false));
        rejects(() -> ScreenActionRules.checkAction("shell", "command", true, true, true));
        rejects(() -> ScreenActionRules.checkAction("type", "x".repeat(1001), true, true, false));
        ScreenActionRules.checkAction("type", "", true, true, false);
        ScreenActionRules.checkAction("scroll-down", "", false, false, true);
        System.out.println("ScreenActionRules: " + checks + " checks passed");
    }
}
