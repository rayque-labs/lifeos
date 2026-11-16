package com.rayquelabs.lifeos;

import android.app.Activity;
import android.app.role.RoleManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
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
    public void consumeLaunch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean active = intent != null && Intent.ACTION_ASSIST.equals(intent.getAction());
        if (active) intent.setAction(null);
        call.resolve(new JSObject().put("active", active));
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (Intent.ACTION_ASSIST.equals(intent.getAction())) {
            notifyListeners("assistantInvoked", new JSObject());
        }
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
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
