package com.rayquelabs.lifeos;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;

/** Non-exported trampoline for the Android-controlled trash confirmation. */
public class PhotoTrashActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if(state!=null)return;
        PendingIntent request=getIntent().getParcelableExtra("request");
        if(request==null){setResult(RESULT_CANCELED);finish();return;}
        try {startIntentSenderForResult(request.getIntentSender(),71,null,0,0,0);}
        catch(Exception e){setResult(RESULT_CANCELED);finish();}
    }
    @Override protected void onActivityResult(int code,int result,Intent data){
        super.onActivityResult(code,result,data);
        if(code==71){setResult(result);finish();}
    }
}
