package com.rayquelabs.lifeos;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Build;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.view.Window;
import android.view.WindowManager;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name = "LifeOSAssistant")
public class LifeOSAssistant extends Plugin {
    private TextToSpeech tts;
    private PluginCall pendingSpeech;
    private boolean ready;
    private boolean destroyed;

    @PluginMethod
    public void getPanelMode(PluginCall call) {
        call.resolve(new JSObject().put("external", getActivity() instanceof AssistantConversationActivity));
    }

    @PluginMethod
    public void getOverlayStatus(PluginCall call) {
        call.resolve(new JSObject()
            .put("defaultAssistant", AssistantOverlayService.isDefaultAssistant(getContext()))
            .put("allowed", Settings.canDrawOverlays(getContext()))
            .put("running", AssistantOverlayService.isRunning()));
    }

    @PluginMethod
    public void toggleOverlay(PluginCall call) {
        Activity activity = getActivity();
        activity.runOnUiThread(() -> {
            Intent service = new Intent(activity, AssistantOverlayService.class);
            if (AssistantOverlayService.isRunning()) {
                activity.stopService(service);
                call.resolve(new JSObject().put("state", "stopped"));
                return;
            }
            if (!AssistantOverlayService.isDefaultAssistant(activity)) {
                call.reject("Selecione o LifeOS como assistente padrão primeiro.");
                return;
            }
            try {
                if (!Settings.canDrawOverlays(activity)) {
                    startActivityForResult(call, AssistantOverlayService.permissionIntent(activity), "overlayPermission");
                } else {
                    startOverlay(activity, call);
                }
            } catch (RuntimeException error) {
                call.reject("O Android não conseguiu abrir a configuração da Toph.");
            }
        });
    }

    @ActivityCallback
    private void overlayPermission(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (!Settings.canDrawOverlays(getContext())) {
            call.resolve(new JSObject().put("state", "permission"));
            return;
        }
        startOverlay(getActivity(), call);
    }

    private void startOverlay(Activity activity, PluginCall call) {
        try {
            AssistantOverlayService.startFrom(activity);
            call.resolve(new JSObject().put("state", "started"));
        } catch (RuntimeException error) {
            call.reject("Abra o LifeOS e tente ativar a Toph novamente.");
        }
    }

    @PluginMethod
    public void closePanel(PluginCall call) {
        Activity activity = getActivity();
        if (!(activity instanceof AssistantConversationActivity)) {
            call.reject("O painel externo não está aberto.");
            return;
        }
        activity.runOnUiThread(() -> {
            if (Boolean.TRUE.equals(call.getBoolean("end"))) {
                activity.stopService(new Intent(activity, AssistantOverlayService.class));
            }
            call.resolve();
            activity.finish();
        });
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS));
                call.resolve();
            } catch (ActivityNotFoundException error) {
                call.reject("Abra Acessibilidade nas Configurações do Android.");
            }
        });
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            call.reject("URL HTTPS inválida.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                call.resolve();
            } catch (ActivityNotFoundException error) {
                call.reject("O Android não encontrou um app para abrir o link.");
            }
        });
    }

    private String targetPackage(String name) {
        if ("whatsapp".equals(name)) {
            return getContext().getPackageManager().getLaunchIntentForPackage("com.whatsapp") != null
                ? "com.whatsapp" : "com.whatsapp.w4b";
        }
        if ("instagram".equals(name)) return "com.instagram.android";
        if ("facebook".equals(name)) {
            return getContext().getPackageManager().getLaunchIntentForPackage("com.facebook.katana") != null
                ? "com.facebook.katana" : "com.facebook.lite";
        }
        if ("chrome".equals(name)) return "com.android.chrome";
        if ("agenda".equals(name)) return "com.google.android.calendar";
        if ("calculadora".equals(name)) return "com.google.android.calculator";
        if ("keep".equals(name)) return "com.google.android.keep";
        return null;
    }

    @PluginMethod
    public void inspectScreen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            TophAccessibilityService service = TophAccessibilityService.connected;
            if (service == null) {
                call.reject("Ative Toph — controle do Android em Acessibilidade.");
            } else if (!(getActivity() instanceof AssistantConversationActivity)) {
                call.reject("Abra a Toph flutuante sobre a tela que quer analisar.");
            } else if (getActivity().getSystemService(android.app.KeyguardManager.class).isDeviceLocked()) {
                call.reject("Desbloqueie o Android para analisar a tela.");
            } else {
                try {
                    String summary = service.describeScreen();
                    if (summary != null) call.resolve(new JSObject().put("summary", summary));
                    else inspectBehindPanel(call, service);
                } catch (IllegalStateException error) {
                    call.reject(error.getMessage());
                }
            }
        });
    }

    private boolean screenReadPending;

    private void inspectBehindPanel(PluginCall call, TophAccessibilityService service) {
        if (screenReadPending) {
            call.reject("Uma leitura de tela já está em andamento.");
            return;
        }
        screenReadPending = true;
        Window window = getActivity().getWindow();
        WindowManager.LayoutParams previous = new WindowManager.LayoutParams();
        previous.copyFrom(window.getAttributes());
        WindowManager.LayoutParams temporary = new WindowManager.LayoutParams();
        temporary.copyFrom(previous);
        temporary.flags |= WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        temporary.alpha = 0f;
        window.setAttributes(temporary);
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (destroyed || TophAccessibilityService.connected != service ||
                    getActivity().getSystemService(android.app.KeyguardManager.class).isDeviceLocked()) {
                    call.reject("A leitura da tela foi interrompida.");
                    return;
                }
                String summary = service.describeScreen();
                if (summary == null) call.reject("Não consegui identificar o app atrás da Toph.");
                else call.resolve(new JSObject().put("summary", summary));
            } catch (IllegalStateException error) {
                call.reject(error.getMessage());
            } finally {
                if (!destroyed) window.setAttributes(previous);
                screenReadPending = false;
            }
        }, 240);
    }

    private void runWhenFocused(TophAccessibilityService service, String target, String action,
                                String text, int x, int y, int remaining) {
        if (TophAccessibilityService.connected != service) return;
        if (service.targetFocused(target)) {
            service.perform(target, action, text, x, y);
        } else if (remaining > 0) {
            new Handler(Looper.getMainLooper()).postDelayed(
                () -> runWhenFocused(service, target, action, text, x, y, remaining - 1), 120);
        } else {
            service.notice("O aplicativo solicitado não voltou ao primeiro plano.");
        }
    }

    @PluginMethod
    public void controlDevice(PluginCall call) {
        String action = call.getString("action", "");
        getActivity().runOnUiThread(() -> {
            String target = targetPackage(call.getString("app", ""));
            Intent launcher = target == null ? null : getContext().getPackageManager().getLaunchIntentForPackage(target);
            if (launcher == null) { call.reject("O Android não encontrou esse aplicativo."); return; }
            if ("open".equals(action) || "search".equals(action) || "profile".equals(action)) {
                String value = call.getString("text", "").trim();
                Intent destination = launcher;
                if ("search".equals(action)) {
                    if (!"com.android.chrome".equals(target) || value.isEmpty() || value.length() > 500) {
                        call.reject("Informe um termo de pesquisa válido.");
                        return;
                    }
                    Uri query = Uri.parse("https://www.google.com/search").buildUpon()
                        .appendQueryParameter("q", value).build();
                    destination = new Intent(Intent.ACTION_VIEW, query).setPackage(target);
                } else if ("profile".equals(action)) {
                    if (!"com.instagram.android".equals(target) || !value.matches("[A-Za-z0-9_][A-Za-z0-9_.]{0,29}")) {
                        call.reject("Informe um usuário válido do Instagram.");
                        return;
                    }
                    Uri profile = Uri.parse("https://www.instagram.com").buildUpon().appendPath(value).build();
                    destination = new Intent(Intent.ACTION_VIEW, profile).setPackage(target);
                }
                try {
                    getActivity().startActivity(destination);
                    if (getActivity() instanceof AssistantConversationActivity) getActivity().finish();
                    call.resolve();
                } catch (ActivityNotFoundException error) {
                    call.reject("O aplicativo não conseguiu abrir esse destino.");
                }
                return;
            }
            if (target.startsWith("com.facebook.") || !("up".equals(action) || "down".equals(action) ||
                "type".equals(action) || "tap".equals(action) || "click".equals(action))) {
                call.reject("Esse controle não está disponível para este aplicativo.");
                return;
            }
            TophAccessibilityService service = TophAccessibilityService.connected;
            if (service == null || Build.VERSION.SDK_INT < 24) {
                call.reject("Ative Toph — controle do Android em Acessibilidade.");
                return;
            }
            if (!(getActivity() instanceof AssistantConversationActivity)) {
                call.reject("Abra a Toph flutuante por cima do aplicativo que deseja controlar.");
                return;
            }
            String text = call.getString("text", "");
            int x = call.getInt("x", -1);
            int y = call.getInt("y", -1);
            if (("tap".equals(action) && (x < 0 || x > 100 || y < 0 || y > 100)) ||
                (("type".equals(action) || "click".equals(action)) && (text.trim().isEmpty() || text.length() > 500))) {
                call.reject("Gesto ou texto inválido.");
                return;
            }
            call.resolve();
            getActivity().finish();
            new Handler(Looper.getMainLooper()).postDelayed(
                () -> runWhenFocused(service, target, action, text, x, y, 14), 150);
        });
    }

    @PluginMethod
    public void markOverlayDataChanged(PluginCall call) {
        if (getActivity() instanceof AssistantConversationActivity) MainActivity.overlayDataChanged = true;
        call.resolve();
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> showAssistantSettings(call));
    }

    private void showAssistantSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                RoleManager roles = getActivity().getSystemService(RoleManager.class);
                if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_ASSISTANT) &&
                    !roles.isRoleHeld(RoleManager.ROLE_ASSISTANT)) {
                    startActivityForResult(call, roles.createRequestRoleIntent(RoleManager.ROLE_ASSISTANT), "roleResult");
                    return;
                }
            }
            getActivity().startActivity(new Intent(Settings.ACTION_VOICE_INPUT_SETTINGS));
            call.resolve();
        } catch (ActivityNotFoundException error) {
            try {
                getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS));
                call.resolve();
            } catch (ActivityNotFoundException unavailable) {
                call.reject("Abra Apps padrão nas Configurações do Android.");
            }
        }
    }

    @ActivityCallback
    private void roleResult(PluginCall call, ActivityResult result) {
        if (call != null) call.resolve();
    }

    @PluginMethod
    public void dictate(PluginCall call) {
        getActivity().runOnUiThread(() -> launchDictation(call));
    }

    private void launchDictation(PluginCall call) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR");
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        try {
            startActivityForResult(call, intent, "dictationResult");
        } catch (ActivityNotFoundException error) {
            call.reject("O Android não encontrou um serviço de reconhecimento de fala.");
        }
    }

    @ActivityCallback
    private void dictationResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        ArrayList<String> words = result.getResultCode() == Activity.RESULT_OK && data != null
            ? data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS) : null;
        call.resolve(new JSObject().put("text", words == null || words.isEmpty() ? "" : words.get(0)));
    }

    @PluginMethod
    public void speak(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (destroyed) {
                call.reject("A tela do LifeOS foi fechada.");
                return;
            }
            if (pendingSpeech != null) pendingSpeech.resolve();
            pendingSpeech = call;
            if (tts != null && ready) {
                playPending();
            } else if (tts == null) {
                tts = new TextToSpeech(getContext(), status -> new Handler(Looper.getMainLooper()).post(() -> {
                    if (destroyed) return;
                    ready = status == TextToSpeech.SUCCESS;
                    if (ready) playPending();
                    else {
                        if (pendingSpeech != null) pendingSpeech.reject("A voz do Android está indisponível.");
                        pendingSpeech = null;
                        if (tts != null) tts.shutdown();
                        tts = null;
                    }
                }));
            }
        });
    }

    private void playPending() {
        PluginCall call = pendingSpeech;
        pendingSpeech = null;
        if (call == null) return;
        boolean retro = Boolean.TRUE.equals(call.getBoolean("retro"));
        tts.setPitch(retro ? 1.18f : 1.0f);
        tts.setSpeechRate(retro ? 1.04f : 1.0f);
        if (tts.setLanguage(Locale.forLanguageTag("pt-BR")) < TextToSpeech.LANG_AVAILABLE ||
            tts.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, null, "lifeos") == TextToSpeech.ERROR) {
            call.reject("A voz em português não está disponível no Android.");
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pendingSpeech != null) pendingSpeech.resolve();
            pendingSpeech = null;
            if (tts != null) tts.stop();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        if (pendingSpeech != null) pendingSpeech.resolve();
        pendingSpeech = null;
        if (tts != null) tts.shutdown();
        tts = null;
        ready = false;
    }
}
