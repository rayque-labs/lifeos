package com.rayquelabs.lifeos;

import android.Manifest;
import android.app.Activity;
import android.content.ContentUris;
import android.content.Intent;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Size;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="TophPhotos",permissions={
 @Permission(alias="photos",strings={Manifest.permission.READ_MEDIA_IMAGES}),
 @Permission(alias="selected",strings={Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED}),
 @Permission(alias="legacy",strings={Manifest.permission.READ_EXTERNAL_STORAGE}),
 @Permission(alias="originals",strings={Manifest.permission.ACCESS_MEDIA_LOCATION})
})
public class TophPhotos extends Plugin {
 private final ExecutorService worker=Executors.newSingleThreadExecutor();
 private final AtomicBoolean cancelled=new AtomicBoolean();
 private final AtomicBoolean busy=new AtomicBoolean();
 private volatile boolean destroyed;
 private volatile Snapshot snapshot;
 private List<Item> trashSelection;
 private static final long MAX_FILE=32L*1024*1024, MAX_BYTES=300L*1024*1024;
 private static final int MAX_ITEMS=500;
 private static final Uri COLLECTION=MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
 private static class Item {String id,name,path,digest;long size,modified; Uri uri(){return ContentUris.withAppendedId(COLLECTION,Long.parseLong(id));}}
 private static class Snapshot {String token=UUID.randomUUID().toString();long expires=System.currentTimeMillis()+600000;List<List<Item>> groups=new ArrayList<>();}
 private final String[] columns={"_id","_display_name","_size","date_modified","relative_path"};
 private Item item(Cursor c){Item i=new Item();i.id=c.getString(0);i.name=c.getString(1);i.size=c.getLong(2);i.modified=c.getLong(3);i.path=c.getString(4);return i;}
 private boolean canRead(){return Build.VERSION.SDK_INT>=33 ? getPermissionState("photos")==PermissionState.GRANTED || (Build.VERSION.SDK_INT>=34 && getPermissionState("selected")==PermissionState.GRANTED) : getPermissionState("legacy")==PermissionState.GRANTED;}
 @PluginMethod public void scan(PluginCall call){
  if(Build.VERSION.SDK_INT<30){call.reject("A limpeza de fotos requer Android 11 ou superior.");return;}
  if(!busy.compareAndSet(false,true)){call.reject("Já há uma operação de fotos em andamento.");return;}
  snapshot=null;cancelled.set(false);
  getActivity().runOnUiThread(()->{
   if(!canRead() || (Build.VERSION.SDK_INT>=34 && Boolean.TRUE.equals(call.getBoolean("reselect"))))requestPermissionForAliases(Build.VERSION.SDK_INT>=34?new String[]{"photos","selected"}:Build.VERSION.SDK_INT>=33?new String[]{"photos"}:new String[]{"legacy"},call,"photosPermission");
   else originalsPermission(call);
  });
 }
 @PermissionCallback private void photosPermission(PluginCall call){
  if(!canRead()){busy.set(false);call.reject("Autorize as fotos que deseja analisar e tente novamente.");return;}originalsPermission(call);
 }
 private void originalsPermission(PluginCall call){
  if(getPermissionState("originals")!=PermissionState.GRANTED)requestPermissionForAlias("originals",call,"originalPermission");else startScan(call);
 }
 @PermissionCallback private void originalPermission(PluginCall call){
  if(getPermissionState("originals")!=PermissionState.GRANTED){busy.set(false);call.reject("A comparação exata precisa ler os arquivos originais, incluindo os metadados. Nenhuma foto foi alterada.");return;}startScan(call);
 }
 private String digest(Item i) throws Exception {
  try(InputStream in=getContext().getContentResolver().openInputStream(MediaStore.setRequireOriginal(i.uri()))){
   return PhotoRules.digest(in,i.size,MAX_FILE,cancelled::get);
  }
 }
 private Item current(Item i) throws Exception {
  try(Cursor c=getContext().getContentResolver().query(i.uri(),columns,"is_trashed=0 AND is_pending=0",null,null)){
   if(c==null || !c.moveToFirst())throw new IOException("Imagem ausente ou sem acesso: "+i.name);return item(c);
  }
 }
 private void verify(Item i) throws Exception {
  Item now=current(i);
  if(now.size!=i.size || now.modified!=i.modified || !digest(now).equals(i.digest))throw new IOException("A imagem mudou desde a análise. Faça uma nova análise.");
 }
 private String thumbnail(Item i){
  try {Bitmap b=getContext().getContentResolver().loadThumbnail(i.uri(),new Size(128,128),null);ByteArrayOutputStream out=new ByteArrayOutputStream();b.compress(Bitmap.CompressFormat.JPEG,65,out);b.recycle();return "data:image/jpeg;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP);}
  catch(Exception e){return "";}
 }
 private void startScan(PluginCall call){if(destroyed){busy.set(false);return;}worker.execute(()->{
  try {
   Map<Long,List<Item>> sizes=new LinkedHashMap<>();int examined=0,skipped=0,hashed=0;boolean limited=false;long bytes=0;
   try(Cursor c=getContext().getContentResolver().query(COLLECTION,columns,"is_trashed=0 AND is_pending=0",null,"date_added DESC, _id DESC")){
    if(c==null)throw new IOException("A galeria não respondeu.");
    while(c.moveToNext()){
     if(cancelled.get())throw new InterruptedIOException("Análise cancelada.");
     if(examined>=MAX_ITEMS){limited=true;break;}examined++;Item i=item(c);
     if(i.size<=0 || i.size>MAX_FILE){skipped++;continue;}sizes.computeIfAbsent(i.size,k->new ArrayList<>()).add(i);
    }
   }
   Snapshot found=new Snapshot();
   for(List<Item> batch:sizes.values()){
    if(batch.size()<2)continue;Map<String,List<Item>> hashes=new LinkedHashMap<>();
    for(Item i:batch){
     if(cancelled.get())throw new InterruptedIOException("Análise cancelada.");
     if(bytes+i.size>MAX_BYTES){limited=true;skipped++;continue;}bytes+=i.size;
     try {i.digest=digest(i);hashes.computeIfAbsent(i.digest,k->new ArrayList<>()).add(i);hashed++;}
     catch(InterruptedIOException e){throw e;}catch(Exception e){skipped++;}
     notifyListeners("progress",new JSObject().put("hashed",hashed).put("examined",examined));
    }
    for(List<Item> group:hashes.values())if(group.size()>1){group.sort(Comparator.comparingLong(i->Long.parseLong(i.id)));found.groups.add(group);}
   }
   if(cancelled.get())throw new InterruptedIOException("Análise cancelada.");
   JSArray groups=new JSArray();long duplicateBytes=0;
   for(List<Item> group:found.groups){if(cancelled.get())throw new InterruptedIOException("Análise cancelada.");JSArray items=new JSArray();for(int n=0;n<group.size();n++){Item i=group.get(n);items.put(new JSObject().put("id",i.id).put("name",i.name).put("path",i.path).put("size",i.size).put("keep",n==0));if(n>0)duplicateBytes+=i.size;}
    groups.put(new JSObject().put("items",items).put("thumbnail",thumbnail(group.get(0))));}
   if(cancelled.get())throw new InterruptedIOException("Análise cancelada.");
   snapshot=found;
   call.resolve(new JSObject().put("token",found.token).put("groups",groups).put("examined",examined).put("hashed",hashed).put("skipped",skipped).put("limited",limited).put("partial",Build.VERSION.SDK_INT>=34 && getPermissionState("photos")!=PermissionState.GRANTED).put("duplicateBytes",duplicateBytes));
  }catch(Exception e){snapshot=null;call.reject(e.getMessage()==null?"Falha ao analisar as fotos.":e.getMessage());}finally{busy.set(false);}
 });}
 @PluginMethod public void cancel(PluginCall call){cancelled.set(true);call.resolve();}
 @PluginMethod public void discard(PluginCall call){if(!busy.get())snapshot=null;call.resolve();}
 @PluginMethod public void trash(PluginCall call){
  if(Build.VERSION.SDK_INT<30){call.reject("Requer Android 11.");return;}
  if(!busy.compareAndSet(false,true)){call.reject("Aguarde a operação atual.");return;}
  cancelled.set(false);worker.execute(()->{
   try {
    Snapshot found=snapshot;
    if(found==null || !found.token.equals(call.getString("token")) || System.currentTimeMillis()>found.expires)throw new IOException("A análise expirou. Analise novamente.");
    List<List<String>> groups=new ArrayList<>();Map<String,Item> byId=new HashMap<>();
    for(List<Item> group:found.groups){List<String> ids=new ArrayList<>();for(Item i:group){ids.add(i.id);byId.put(i.id,i);}groups.add(ids);}
    JSArray raw=call.getArray("ids");if(raw==null)throw new IOException("Selecione as cópias na prévia.");List<String> requested=new ArrayList<>();for(int n=0;n<raw.length();n++)requested.add(raw.getString(n));
    List<String> selected=PhotoRules.validateSelection(groups,requested);Set<String> unique=new HashSet<>(selected);
    for(List<Item> group:found.groups)if(group.stream().anyMatch(i->unique.contains(i.id))){verify(group.get(0));for(Item i:group)if(unique.contains(i.id))verify(i);}
    if(cancelled.get())throw new InterruptedIOException("Envio para a lixeira cancelado antes da confirmação.");
    ArrayList<Uri> uris=new ArrayList<>();trashSelection=new ArrayList<>();for(String id:selected){Item i=byId.get(id);uris.add(i.uri());trashSelection.add(i);}
    android.app.PendingIntent confirmation=MediaStore.createTrashRequest(getContext().getContentResolver(),uris,true);
    snapshot=null;
    getActivity().runOnUiThread(()->{
     if(destroyed || cancelled.get()){busy.set(false);call.reject("Operação cancelada antes da confirmação.");return;}
     try {startActivityForResult(call,new Intent(getActivity(),PhotoTrashActivity.class).putExtra("request",confirmation),"trashResult");}
     catch(Exception e){trashSelection=null;busy.set(false);call.reject("Não consegui abrir a confirmação do Android.");}
    });
   }catch(Exception e){busy.set(false);call.reject(e.getMessage()==null?"Não foi possível preparar a lixeira.":e.getMessage());}
  });
 }
 @ActivityCallback private void trashResult(PluginCall call,ActivityResult result){
  if(call==null || destroyed){busy.set(false);trashSelection=null;return;}
  List<Item> selected=trashSelection;trashSelection=null;
  if(result.getResultCode()!=Activity.RESULT_OK){busy.set(false);call.resolve(new JSObject().put("cancelled",true).put("verified",0).put("unknown",0));return;}
  worker.execute(()->{
   int verified=0,unknown=0;
   try {
    for(Item i:selected==null?Collections.<Item>emptyList():selected){
     Bundle args=new Bundle();args.putInt(MediaStore.QUERY_ARG_MATCH_TRASHED,MediaStore.MATCH_INCLUDE);
     try(Cursor c=getContext().getContentResolver().query(i.uri(),new String[]{"is_trashed"},args,null)){if(c!=null && c.moveToFirst() && c.getInt(0)==1)verified++;else unknown++;}catch(Exception e){unknown++;}
    }
    call.resolve(new JSObject().put("cancelled",false).put("verified",verified).put("unknown",unknown));
   }finally{busy.set(false);}
  });
 }
 @Override protected void handleOnDestroy(){destroyed=true;cancelled.set(true);snapshot=null;worker.shutdown();}
}
