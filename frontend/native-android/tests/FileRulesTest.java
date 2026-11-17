package com.rayquelabs.lifeos;
public class FileRulesTest {
    private static void eq(String expected,String actual){if(!expected.equals(actual))throw new AssertionError(expected+" != "+actual);}
    public static void main(String[] args){
        eq("Imagens",FileRules.category("foto.HEIC","image/heic"));
        eq("Vídeos",FileRules.category("filme.mp4","video/mp4"));
        eq("Documentos",FileRules.category("Contrato.PDF","application/pdf"));
        eq("Planilhas",FileRules.category("custos.CSV","text/csv"));
        eq("Outros",FileRules.category("unknown",null));
        eq("application/json",FileRules.mime("dados.JSON"));
        eq("text/markdown",FileRules.mime("notas.md"));
        System.out.println("FileRules: 7 checks passed");
    }
}
