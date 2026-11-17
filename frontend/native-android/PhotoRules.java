package com.rayquelabs.lifeos;
import java.util.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.function.BooleanSupplier;

/** Native allow-list: every duplicate group keeps its first verified original. */
public final class PhotoRules {
    private PhotoRules() {}
    public static String digest(InputStream in, long expected, long max, BooleanSupplier cancelled) throws Exception {
        if(in==null)throw new IOException("Imagem indisponível.");
        MessageDigest hash=MessageDigest.getInstance("SHA-256");long read=0;byte[] buffer=new byte[65536];int n;
        while((n=in.read(buffer))!=-1){
            if(cancelled.getAsBoolean())throw new InterruptedIOException("Análise cancelada.");
            read+=n;if(read>max)throw new IOException("Imagem acima do limite de leitura.");hash.update(buffer,0,n);
        }
        if(read!=expected)throw new IOException("A imagem mudou durante a leitura.");
        StringBuilder out=new StringBuilder();for(byte b:hash.digest())out.append(String.format(Locale.ROOT,"%02x",b&255));return out.toString();
    }
    public static List<String> validateSelection(List<List<String>> groups, List<String> requested) {
        if(requested.isEmpty() || requested.size()>100)throw new IllegalArgumentException("Selecione de 1 a 100 cópias.");
        Set<String> allowed=new HashSet<>();
        for(List<String> group:groups)for(int i=1;i<group.size();i++)allowed.add(group.get(i));
        LinkedHashSet<String> selected=new LinkedHashSet<>(requested);
        if(selected.size()!=requested.size() || !allowed.containsAll(selected))throw new IllegalArgumentException("Seleção inválida. Uma imagem original de cada grupo deve ser preservada.");
        return new ArrayList<>(selected);
    }
}
