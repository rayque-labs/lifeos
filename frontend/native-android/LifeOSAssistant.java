package com.rayquelabs.lifeos;

import android.Manifest;
import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name = "LifeOSAssistant", permissions = {
    @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
})
public class LifeOSAssistant extends Plugin {
    private TextToSpeech tts;
    private PluginCall pendingSpeech;
    private PluginCall speaking;
    private String utteranceId;
    private int utteranceSequence;
    private SpeechRecognizer recognizer;
    private PluginCall listening;
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
        call.reject("A leitura de telas de outros aplicativos está indisponível nesta versão.");
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
            call.reject("Gestos em outros aplicativos estão indisponíveis nesta versão.");
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
    public void setCompactVoice(PluginCall call) {
        Activity activity = getActivity();
        if (!(activity instanceof AssistantConversationActivity)) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            ((AssistantConversationActivity) activity).setCompactVoice(Boolean.TRUE.equals(call.getBoolean("compact")));
            call.resolve();
        });
    }

    @PluginMethod
    public void listen(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                requestPermissionForAlias("microphone", call, "microphonePermission");
            } else {
                startListening(call);
            }
        });
    }

    @PermissionCallback
    private void microphonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) startListening(call);
        else call.reject("Autorize o microfone para conversar com a Toph.");
    }

    private void startListening(PluginCall call) {
        if (destroyed || getActivity().isFinishing()) {
            call.resolve(new JSObject().put("text", ""));
            return;
        }
        finishListening("", null);
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Ative um serviço de reconhecimento de fala no Android.");
            return;
        }
        listening = call;
        try {
            SpeechRecognizer current = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer = current;
            current.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) {}
                @Override public void onBeginningOfSpeech() {}
                @Override public void onRmsChanged(float rms) {}
                @Override public void onBufferReceived(byte[] buffer) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onPartialResults(Bundle partialResults) {}
                @Override public void onEvent(int eventType, Bundle params) {}
                @Override public void onError(int code) {
                    if (recognizer != current) return;
                    boolean silence = code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT;
                    finishListening("", silence ? null : "Reconhecimento de voz indisponível. Confira o microfone e a conexão.");
                }
                @Override public void onResults(Bundle results) {
                    if (recognizer != current) return;
                    ArrayList<String> words = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    finishListening(words == null || words.isEmpty() ? "" : words.get(0), null);
                }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            current.startListening(intent);
        } catch (RuntimeException error) {
            finishListening("", "O Android não conseguiu abrir o microfone.");
        }
    }

    private void finishListening(String text, String error) {
        SpeechRecognizer previous = recognizer;
        recognizer = null;
        if (previous != null) previous.destroy();
        PluginCall call = listening;
        listening = null;
        if (call == null) return;
        if (error != null) call.reject(error);
        else call.resolve(new JSObject().put("text", text));
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            finishListening("", null);
            call.resolve();
        });
    }

    @Override
    protected void handleOnStop() {
        finishListening("", null);
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
                    if (ready) {
                        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                            @Override public void onStart(String id) {}
                            @Override public void onDone(String id) { speechFinished(id, false); }
                            @Override public void onError(String id) { speechFinished(id, true); }
                            @Override public void onStop(String id, boolean interrupted) { speechFinished(id, false); }
                        });
                        playPending();
                    }
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
        completeSpeech(false);
        boolean wait = Boolean.TRUE.equals(call.getBoolean("wait"));
        String id = "lifeos-" + (++utteranceSequence);
        if (wait) {
            speaking = call;
            utteranceId = id;
        }
        if (tts.setLanguage(Locale.forLanguageTag("pt-BR")) < TextToSpeech.LANG_AVAILABLE ||
            tts.speak(call.getString("text", ""), TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) {
            if (wait) completeSpeech(true);
            else call.reject("A voz em português não está disponível no Android.");
        } else if (!wait) {
            call.resolve();
        }
    }

    private void speechFinished(String id, boolean error) {
        getActivity().runOnUiThread(() -> {
            if (id.equals(utteranceId)) completeSpeech(error);
        });
    }

    private void completeSpeech(boolean error) {
        PluginCall call = speaking;
        speaking = null;
        utteranceId = null;
        if (call == null) return;
        if (error) call.reject("O Android não conseguiu falar a resposta.");
        else call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (pendingSpeech != null) pendingSpeech.resolve();
            pendingSpeech = null;
            completeSpeech(false);
            if (tts != null) tts.stop();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        destroyed = true;
        finishListening("", null);
        completeSpeech(false);
        if (pendingSpeech != null) pendingSpeech.resolve();
        pendingSpeech = null;
        if (tts != null) tts.shutdown();
        tts = null;
        ready = false;
    }
}
