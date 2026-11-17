package com.rayquelabs.lifeos;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONObject;

/** Voice owns its lifetime in the foreground service, never in the panel Activity. */
final class TophVoiceSession {
    interface Host { void status(String text); void end(); }
    private final Context context;
    private final Host host;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView worker;
    private TextToSpeech tts;
    private SpeechRecognizer recognizer;
    private boolean disposed, workerReady, ttsReady, suspended = true, paused, busy, listening, speaking, greeted;
    private boolean pauseAfterSpeech;
    private int misses;
    private String lastStatus = "Preparando voz";
    private final Runnable listenLater = this::listen;
    private final Runnable watchdog = () -> { if (busy) { cancelTurn(); pause("Resposta demorou. Retome a voz pela notificação."); } };

    TophVoiceSession(Context context, Host host) {
        this.context = context; this.host = host;
        worker = new WebView(context);
        WebSettings settings = worker.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        worker.addJavascriptInterface(new VoiceBridge(), "TophVoice");
        worker.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                android.net.Uri uri = request.getUrl();
                if (!"localhost".equals(uri.getHost())) return null;
                String path = uri.getPath();
                try {
                    if (!"https".equals(uri.getScheme()) || path == null || path.contains("..") || !(path.equals("/voice-session.html") || path.startsWith("/assets/"))) throw new Exception();
                    String mime = path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "application/javascript" : "text/css";
                    return new WebResourceResponse(mime, "UTF-8", context.getAssets().open("public" + path));
                } catch (Exception error) {
                    return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
                }
            }
        });
        worker.loadUrl("https://localhost/voice-session.html");
        handler.postDelayed(() -> { if (!disposed && !workerReady) pause("Não consegui iniciar a sessão. Encerre e reative a Toph."); }, 20000);
        tts = new TextToSpeech(context, result -> handler.post(() -> {
            if (disposed) return;
            ttsReady = result == TextToSpeech.SUCCESS && tts.setLanguage(new Locale("pt", "BR")) >= 0;
            if (!ttsReady) { pause("Voz pt-BR indisponível. Configure a síntese de voz do Android."); return; }
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String id) { }
                @Override public void onDone(String id) { handler.post(() -> { speaking = false; if (pauseAfterSpeech) pause("Voz pausada. Retome pela notificação."); else schedule(); }); }
                @Override public void onError(String id) { handler.post(() -> { speaking = false; pause("Falha na voz. Retome pela notificação."); }); }
            });
            schedule();
        }));
    }
    String status() { return lastStatus; }
    private void status(String text) { lastStatus = text; host.status(text); }
    private boolean unlocked() {
        return ((PowerManager) context.getSystemService(Context.POWER_SERVICE)).isInteractive()
            && !((KeyguardManager) context.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked();
    }
    void suspend(boolean value) {
        if (disposed) return;
        suspended = value;
        if (value) {
            handler.removeCallbacks(listenLater); stopListening();
            if (tts != null) tts.stop(); speaking = false;
            cancelTurn(); // Panel takes ownership; worker records interruption rather than overlapping turns.
            status("Voz no painel · microfone do bonequinho suspenso");
        } else schedule();
    }
    void togglePause() {
        if (paused) { paused = false; misses = 0; schedule(); }
        else { cancelTurn(); pause("Microfone pausado"); }
    }
    void pause(String reason) {
        paused = true; handler.removeCallbacks(listenLater); stopListening();
        if (tts != null) tts.stop(); speaking = false;
        status(reason);
    }
    private void schedule() {
        handler.removeCallbacks(listenLater);
        if (disposed || suspended || paused || busy || listening || speaking || !workerReady || !ttsReady) return;
        if (!unlocked()) { pause("Tela bloqueada · voz pausada"); return; }
        if (!greeted) { greeted = true; say("Olá! Sou a Toph. Pode falar comigo sem abrir a janela.", false); }
        else handler.postDelayed(listenLater, 500);
    }
    private void say(String text, boolean pauseAfter) {
        if (disposed || suspended || paused || !ttsReady) return;
        stopListening(); speaking = true; pauseAfterSpeech = pauseAfter;
        status("Toph falando · segure o bonequinho para pausar");
        String spoken = text.length() > 3000 ? text.substring(0, 3000) + ". A resposta completa está no chat." : text;
        if (tts.speak(spoken, TextToSpeech.QUEUE_FLUSH, null, "toph-service-" + System.nanoTime()) == TextToSpeech.ERROR) {
            speaking = false; pause("Não consegui falar. Abra o painel.");
        }
    }
    private void listen() {
        if (disposed || suspended || paused || busy || listening || speaking) return;
        if (!unlocked()) { pause("Tela bloqueada · voz pausada"); return; }
        if (!SpeechRecognizer.isRecognitionAvailable(context)) { pause("Reconhecimento de voz indisponível no Android."); return; }
        try {
            stopListening();
            recognizer = SpeechRecognizer.createSpeechRecognizer(context);
            final SpeechRecognizer activeRecognizer = recognizer;
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { status("Ouvindo · segure a Toph para pausar"); }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float rms) { }
                @Override public void onBufferReceived(byte[] buffer) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onPartialResults(Bundle results) { }
                @Override public void onEvent(int type, Bundle params) { }
                @Override public void onError(int error) {
                    if (recognizer != activeRecognizer) return;
                    stopListening();
                    if (disposed || suspended || paused) return;
                    if ((error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && ++misses < 3) schedule();
                    else pause("Microfone pausado. Segure a Toph para retomar.");
                }
                @Override public void onResults(Bundle results) {
                    if (recognizer != activeRecognizer) return;
                    stopListening();
                    if (disposed || suspended || paused) return;
                    ArrayList<String> values = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    String text = values == null || values.isEmpty() ? "" : values.get(0).trim();
                    if (text.isEmpty()) { schedule(); return; }
                    misses = 0;
                    if (text.matches("(?i)^(encerrar|fechar|desligar)( a)? (toph|conversa|assistente)[.!]?$")) { host.end(); return; }
                    if (text.matches("(?i)^(pausar|parar)( o| de)? (microfone|ouvir)[.!]?$")) { pause("Microfone pausado por voz"); return; }
                    busy = true; status("Toph pensando");
                    worker.evaluateJavascript("window.tophVoiceTurn(" + JSONObject.quote(text) + ")", null);
                    handler.postDelayed(watchdog, 100000);
                }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            listening = true; recognizer.startListening(intent);
        } catch (RuntimeException error) { stopListening(); pause("Android bloqueou o microfone. Confira a permissão no LifeOS."); }
    }
    private void stopListening() {
        listening = false;
        if (recognizer != null) { SpeechRecognizer old = recognizer; recognizer = null; old.cancel(); old.destroy(); }
    }
    private void cancelTurn() {
        handler.removeCallbacks(watchdog);
        if (worker != null && busy) worker.evaluateJavascript("window.tophVoiceCancel?.()", null);
        // Do not release busy until the worker's reply; prevents overlapping turns.
    }
    void destroy() {
        disposed = true; handler.removeCallbacksAndMessages(null); stopListening();
        if (tts != null) { tts.stop(); tts.shutdown(); }
        if (worker != null) { worker.removeJavascriptInterface("TophVoice"); worker.stopLoading(); worker.destroy(); worker = null; }
    }
    public final class VoiceBridge {
        @JavascriptInterface public void ready() { handler.post(() -> { if (!disposed) { workerReady = true; schedule(); } }); }
        @JavascriptInterface public void reply(String text, boolean failed) {
            handler.post(() -> {
                if (disposed) return;
                handler.removeCallbacks(watchdog); busy = false;
                if (!suspended && !paused) say(text, failed);
            });
        }
    }
}
