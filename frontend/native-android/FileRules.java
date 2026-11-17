package com.rayquelabs.lifeos;
import java.util.Locale;
public final class FileRules {
    private FileRules() {}
    public static String mime(String name) {
        String n=name.toLowerCase(Locale.ROOT);
        if(n.endsWith(".json"))return "application/json";
        if(n.endsWith(".csv"))return "text/csv";
        if(n.endsWith(".md"))return "text/markdown";
        return "text/plain";
    }
    public static String category(String name,String mime) {
        String n=name.toLowerCase(Locale.ROOT), m=mime==null?"":mime;
        if(m.startsWith("image/"))return "Imagens";
        if(m.startsWith("video/"))return "Vídeos";
        if(m.startsWith("audio/"))return "Áudios";
        if(n.matches(".*\\.(xls|xlsx|ods|csv)$"))return "Planilhas";
        if(n.matches(".*\\.(pdf|doc|docx|odt|txt|md|rtf)$"))return "Documentos";
        if(n.matches(".*\\.(zip|rar|7z|tar|gz)$"))return "Compactados";
        return "Outros";
    }
}
