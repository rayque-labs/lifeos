package com.rayquelabs.lifeos;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.Locale;
import java.util.Random;

/** Offline personality fallback: safe, varied announcements with persisted snooze history. */
public final class AlarmPersonality {
  private static final String PREFS = "lifeos_alarm_personality";
  private AlarmPersonality() {}

  public static int snoozes(Context context, int id) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("snooze_" + id, 0);
  }

  public static void markSnoozed(Context context, int id) {
    SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    p.edit().putInt("snooze_" + id, Math.min(99, snoozes(context, id) + 1)).apply();
  }

  public static void reset(Context context, int id) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("snooze_" + id).apply();
  }

  public static String announce(Context context, int id, String title, String category) {
    String safeTitle = title == null || title.trim().isEmpty() ? "seu compromisso" : title.trim();
    String key = (safeTitle + " " + (category == null ? "" : category)).toLowerCase(Locale.ROOT);
    int snoozes = snoozes(context, id);
    // Medical and sensitive tasks must never be mocked, even after postponement.
    if (key.matches(".*(remédio|remedio|medicamento|médic|medic|consulta|hospital|terapia|emergência|emergencia|luto|funeral).*")) {
      return "Atenção. Está na hora de " + safeTitle + ". Cuide disso com calma e atenção.";
    }
    if (snoozes >= 3) {
      return "Olha só... já adiamos " + snoozes + " vezes. " + safeTitle + " ainda está esperando. Que tal resolver agora?";
    }
    if (snoozes > 0) {
      String[] again = {
        "Ah, você voltou! " + safeTitle + " também. Vamos tentar dessa vez?",
        "Eu respeitei seus cinco minutinhos. Agora é hora de " + safeTitle + ". Bora?",
        "Segunda chamada! " + safeTitle + " não desapareceu, viu?"
      };
      return choose(again, id, snoozes);
    }
    if (key.matches(".*(trein|academia|exercício|exercicio|corrida|caminhada|musculação).*")) {
      return choose(new String[]{
        "Ah, olha só... " + safeTitle + ". Vai levantar ou deixar a promessa para o ano que vem?",
        "Opa! Hora de " + safeTitle + ". Seu tênis já deve estar sentindo saudade.",
        "Adivinha quem apareceu? " + safeTitle + ". Eu sei, uma surpresa absolutamente inesperada!"
      }, id, 0);
    }
    if (key.matches(".*(conta|boleto|pagamento|pagar|fatura|imposto).*")) {
      return choose(new String[]{
        "Ih... chegou a hora de " + safeTitle + ". Melhor resolver antes que esse boleto crie raízes.",
        "Notícia financeira! " + safeTitle + ". Prometo não olhar seu saldo.",
        "Passando para lembrar: " + safeTitle + ". Eu avisei com carinho, tá?"
      }, id, 0);
    }
    if (key.matches(".*(prova|estud|aula|reunião|reuniao|entrevista|trabalho|prazo|entrega).*")) {
      return choose(new String[]{
        "Atenção, temos " + safeTitle + ". Vale a pena chegar preparado.",
        "Seu próximo compromisso é " + safeTitle + ". Vamos organizar isso direitinho?",
        "Hora de focar: " + safeTitle + ". Estou torcendo por você."
      }, id, 0);
    }
    return choose(new String[]{
      "Opa, temos um compromisso: " + safeTitle + ". Eu lembrei. Agora é sua vez!",
      "Passando para avisar que chegou a hora de " + safeTitle + ". Vamos nessa?",
      "Ei! " + safeTitle + " está na agenda. Que tal tirar isso do caminho?"
    }, id, 0);
  }

  private static String choose(String[] lines, int id, int snoozes) {
    long slot = System.currentTimeMillis() / (24L * 60L * 60L * 1000L);
    return lines[new Random(id * 104729L + slot * 7919L + snoozes).nextInt(lines.length)];
  }
}
