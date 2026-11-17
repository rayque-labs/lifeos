package com.rayquelabs.lifeos;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Works only inside the persisted tree explicitly chosen in Android's picker. */
@CapacitorPlugin(name = "TophFiles")
public class TophFiles extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean busy = new AtomicBoolean();
    private final AtomicBoolean cancelled = new AtomicBoolean();
    private Plan pending;
    private boolean choosing;
    private static final int LIMIT = 200;
    private SharedPreferences prefs() { return getContext().getSharedPreferences("toph-files", 0); }
    private Uri root() throws Exception {
        String saved = prefs().getString("tree", null);
        if (saved == null) throw new Exception("Escolha uma pasta pelo botão Arquivos primeiro.");
        Uri tree = Uri.parse(saved);
        return DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
    }
    private static class Entry {
        String id, name, mime; long size, modified; int flags;
        boolean directory() { return Document.MIME_TYPE_DIR.equals(mime); }
        String stamp() { return id + "|" + name + "|" + size + "|" + modified; }
    }
    private static class Step {
        String operation, name, content, destination; Entry source;
    }
    private static class Plan {
        String token = UUID.randomUUID().toString(); Uri root; long expires = System.currentTimeMillis() + 300000;
        List<Step> steps = new ArrayList<>();
    }
    private Entry read(Cursor c) {
        Entry e = new Entry(); e.id=c.getString(0); e.name=c.getString(1); e.mime=c.getString(2);
        e.size=c.isNull(3)?-1:c.getLong(3); e.modified=c.isNull(4)?0:c.getLong(4); e.flags=c.getInt(5); return e;
    }
    private static final String[] COLUMNS = {Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE, Document.COLUMN_LAST_MODIFIED, Document.COLUMN_FLAGS};
    private List<Entry> children(Uri parent) throws Exception {
        Uri query=DocumentsContract.buildChildDocumentsUriUsingTree(parent, DocumentsContract.getDocumentId(parent));
        List<Entry> result=new ArrayList<>();
        try(Cursor c=getContext().getContentResolver().query(query,COLUMNS,null,null,null)) {
            if(c==null) throw new Exception("A pasta não respondeu. Confira o acesso e tente novamente.");
            while(c.moveToNext()) { if(result.size()>=LIMIT) throw new Exception("Esta pasta tem mais de 200 itens. Escolha uma subpasta menor."); result.add(read(c)); }
        }
        result.sort(Comparator.comparing(e->e.name)); return result;
    }
    private Entry metadata(Uri uri) throws Exception {
        try(Cursor c=getContext().getContentResolver().query(uri,COLUMNS,null,null,null)) {
            if(c==null || !c.moveToFirst()) throw new Exception("Não consegui verificar o arquivo no destino.");
            return read(c);
        }
    }
    private Uri uri(Uri parent, Entry e) { return DocumentsContract.buildDocumentUriUsingTree(parent,e.id); }
    private Entry named(List<Entry> entries,String name) throws Exception {
        Entry found=null;
        for(Entry e:entries) if(e.name.equals(name)) { if(found!=null) throw new Exception("Há nomes repetidos nesta pasta. Escolha outro nome."); found=e; }
        return found;
    }
    private String validName(String name) throws Exception {
        if(name==null || name.isBlank() || name.length()>100 || name.equals(".") || name.equals("..") || name.matches(".*[\\\\/\\p{Cntrl}].*"))
            throw new Exception("Use um nome de 1 a 100 caracteres, sem barras.");
        return name;
    }
    private void run(PluginCall call, Work task) {
        if(!busy.compareAndSet(false,true)) { call.reject("Já existe uma operação de arquivos em andamento."); return; }
        cancelled.set(false);
        worker.execute(()->{try { call.resolve(task.execute()); } catch(Exception e){ call.reject(e instanceof SecurityException ? "A permissão da pasta foi revogada. Escolha a pasta novamente." : (e.getMessage()==null?"Falha ao acessar os arquivos.":e.getMessage())); } finally {busy.set(false);} });
    }
    private interface Work { JSObject execute() throws Exception; }
    @PluginMethod public void chooseFolder(PluginCall call) {
        getActivity().runOnUiThread(()->{
            if(busy.get() || choosing) {call.reject("Aguarde a operação atual."); return;}
            choosing=true;
            try { startActivityForResult(call,new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION),"folderSelected"); }
            catch(RuntimeException e){choosing=false;call.reject("O seletor de pastas não está disponível.");}
        });
    }
    @ActivityCallback private void folderSelected(PluginCall call,ActivityResult result) {
        choosing=false; if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK || result.getData()==null || result.getData().getData()==null){call.reject("Escolha de pasta cancelada.");return;}
        run(call,()->{
            Uri selected=result.getData().getData();
            int flags=result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if((flags&3)!=3) throw new Exception("Escolha uma pasta com acesso de leitura e escrita.");
            getContext().getContentResolver().takePersistableUriPermission(selected,flags);
            String previous=prefs().getString("tree",null);
            prefs().edit().putString("tree",selected.toString()).apply(); pending=null;
            if(previous!=null && !previous.equals(selected.toString())) try {getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(previous),3);}catch(RuntimeException ignored){}
            return new JSObject().put("summary","Pasta autorizada: "+metadata(root()).name+". Agora posso listar, criar e organizar seus arquivos nesta pasta.");
        });
    }
    @PluginMethod public void forgetFolder(PluginCall call) {run(call,()->{
        String old=prefs().getString("tree",null); prefs().edit().remove("tree").apply();pending=null;
        if(old!=null)try {getContext().getContentResolver().releasePersistableUriPermission(Uri.parse(old),3);}catch(RuntimeException ignored){}
        return new JSObject().put("summary","Acesso à pasta removido.");
    });}
    @PluginMethod public void listFiles(PluginCall call) {run(call,()->{
        Uri folder=root(); List<Entry> entries=children(folder); JSArray items=new JSArray();
        String query=call.getString("query","").toLowerCase(Locale.ROOT);
        for(Entry e:entries) if(e.name.toLowerCase(Locale.ROOT).contains(query)) items.put(new JSObject().put("name",e.name).put("directory",e.directory()).put("size",e.size));
        return new JSObject().put("folder",metadata(folder).name).put("items",items);
    });}
    @PluginMethod public void prepare(PluginCall call) {run(call,()->{
        pending=null; Plan plan=new Plan();plan.root=root(); List<Entry> entries=children(plan.root);
        String operation=call.getString("operation",""); JSArray preview=new JSArray();
        if(operation.equals("organize")) {
            for(Entry e:entries) if(!e.directory()) {
                if((e.flags & Document.FLAG_SUPPORTS_MOVE)==0) throw new Exception("Este provedor não permite mover "+e.name+". Nenhum arquivo foi alterado.");
                Step step=new Step();step.operation="move";step.source=e;step.destination=FileRules.category(e.name,e.mime);
                Entry folder=named(entries,step.destination);
                if(folder!=null){if(!folder.directory())throw new Exception("Já existe um arquivo chamado "+step.destination);if(named(children(uri(plan.root,folder)),e.name)!=null)throw new Exception("Já existe "+e.name+" em "+step.destination+". Resolva o conflito antes de organizar.");}
                plan.steps.add(step);preview.put(e.name+" → "+step.destination+"/");
            }
        } else if(operation.equals("mkdir") || operation.equals("write")) {
            Step step=new Step();step.operation=operation;step.name=validName(call.getString("name"));
            if(named(entries,step.name)!=null)throw new Exception("Já existe um item com esse nome. Não vou sobrescrever.");
            step.content=call.getString("content","");
            if(step.content.length()>20000)throw new Exception("O texto deve ter até 20 mil caracteres.");
            if(operation.equals("write") && !step.name.toLowerCase(Locale.ROOT).matches(".+\\.(txt|md|csv|json)$"))throw new Exception("Crie arquivos de texto .txt, .md, .csv ou .json.");
            plan.steps.add(step);preview.put(operation.equals("mkdir")?"Criar pasta: "+step.name:"Criar arquivo: "+step.name+"\nConteúdo:\n"+step.content);
        } else if(operation.equals("rename")) {
            Step step=new Step();step.operation="rename";step.name=validName(call.getString("name"));
            step.source=named(entries,call.getString("source",""));
            if(step.source==null)throw new Exception("Arquivo de origem não encontrado nesta pasta.");
            if((step.source.flags&Document.FLAG_SUPPORTS_RENAME)==0)throw new Exception("Este provedor não permite renomear o item.");
            if(named(entries,step.name)!=null)throw new Exception("O nome de destino já existe.");
            plan.steps.add(step);preview.put("Renomear "+step.source.name+" → "+step.name);
        } else throw new Exception("Operação de arquivos não disponível.");
        if(plan.steps.isEmpty())throw new Exception("Não há arquivos soltos para organizar nesta pasta.");
        pending=plan;
        return new JSObject().put("token",plan.token).put("folder",metadata(plan.root).name).put("steps",preview);
    });}
    @PluginMethod public void discard(PluginCall call) {run(call,()->{pending=null;return new JSObject();});}
    @PluginMethod public void cancel(PluginCall call) {cancelled.set(true);call.resolve();}
    @PluginMethod public void execute(PluginCall call) {run(call,()->{
        Plan plan=pending;pending=null;
        if(plan==null || !plan.token.equals(call.getString("token")) || System.currentTimeMillis()>plan.expires || !plan.root.equals(root()))throw new Exception("O plano expirou ou a pasta mudou. Faça o pedido novamente.");
        JSArray done=new JSArray(); String failure=null;
        for(Step step:plan.steps){
            if(cancelled.get())break;
            notifyListeners("progress",new JSObject().put("completed",done.length()).put("total",plan.steps.size()).put("current",step.source==null?step.name:step.source.name));
            try {
                List<Entry> current=children(plan.root);
                if(step.source!=null){Entry now=named(current,step.source.name);if(now==null || !now.stamp().equals(step.source.stamp()))throw new Exception("O item mudou após a prévia. Gere um novo plano.");}
                if(step.operation.equals("move")){
                    Entry folder=named(current,step.destination); Uri destination;
                    if(folder==null)destination=DocumentsContract.createDocument(getContext().getContentResolver(),plan.root,Document.MIME_TYPE_DIR,step.destination);
                    else {if(!folder.directory())throw new Exception("Destino deixou de ser uma pasta.");destination=uri(plan.root,folder);}
                    if(destination==null)throw new Exception("Não consegui criar a pasta de destino.");
                    if(!metadata(destination).name.equals(step.destination))throw new Exception("O provedor alterou o nome da pasta. Confira antes de repetir.");
                    if(named(children(destination),step.source.name)!=null)throw new Exception("Conflito no destino. Nenhum arquivo será sobrescrito.");
                    Uri moved=DocumentsContract.moveDocument(getContext().getContentResolver(),uri(plan.root,step.source),plan.root,destination);
                    if(moved==null)throw new Exception("O provedor não confirmou a movimentação.");
                    Entry verified=named(children(destination),step.source.name);
                    if(verified==null || (step.source.size>=0 && verified.size!=step.source.size) || named(children(plan.root),step.source.name)!=null)throw new Exception("A movimentação foi solicitada, mas não foi possível verificar o resultado. Confira as pastas antes de repetir.");
                    done.put(step.source.name+" → "+step.destination+"/ (verificado)");
                }else if(step.operation.equals("rename")){
                    if(named(current,step.name)!=null)throw new Exception("O nome de destino já existe.");
                    Uri renamed=DocumentsContract.renameDocument(getContext().getContentResolver(),uri(plan.root,step.source),step.name);
                    if(renamed==null || !metadata(renamed).name.equals(step.name))throw new Exception("Não consegui verificar o novo nome. Confira a pasta antes de repetir.");
                    done.put(step.source.name+" → "+step.name+" (verificado)");
                }else{
                    if(named(current,step.name)!=null)throw new Exception("O nome de destino já existe.");
                    Uri created=DocumentsContract.createDocument(getContext().getContentResolver(),plan.root,step.operation.equals("mkdir")?Document.MIME_TYPE_DIR:FileRules.mime(step.name),step.name);
                    if(created==null)throw new Exception("O provedor não confirmou a criação.");
                    if(!metadata(created).name.equals(step.name))throw new Exception("O provedor criou um item com outro nome. Confira a pasta antes de repetir.");
                    if(step.operation.equals("write")){
                        byte[] data=step.content.getBytes(StandardCharsets.UTF_8);
                        try(OutputStream out=getContext().getContentResolver().openOutputStream(created,"wt")){if(out==null)throw new IOException("Arquivo criado, mas não foi possível gravar o texto.");out.write(data);}
                        try(InputStream in=getContext().getContentResolver().openInputStream(created)){
                            if(in==null)throw new IOException("Texto gravado, mas não consegui verificar.");
                            for(byte b:data)if(in.read()!=(b&255))throw new IOException("O conteúdo gravado difere do pedido. Confira o arquivo.");
                            if(in.read()!=-1)throw new IOException("O arquivo contém dados inesperados.");
                        }
                    }
                    Entry verified=metadata(created);
                    done.put("Criado: "+verified.name+" (verificado)");
                }
            }catch(Exception e){failure="Interrompido em "+(step.source==null?step.name:step.source.name)+": "+e.getMessage()+" As etapas concluídas foram mantidas; confira o item interrompido antes de repetir.";break;}
        }
        return new JSObject().put("completed",done).put("total",plan.steps.size()).put("cancelled",cancelled.get()).put("error",failure);
    });}
    @Override protected void handleOnDestroy(){cancelled.set(true);worker.shutdown();}
}
