package com.tuitube.app;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Captura antes do bridge subir: o link já fica disponível para a UI.
        ShareIntake.INSTANCE.capture(getIntent());
        registerPlugin(TuiTubeDownloaderPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        String sharedUrl = ShareIntake.INSTANCE.capture(intent);
        if (sharedUrl != null) {
            // App já aberto: avisa a WebView na hora.
            TuiTubeDownloaderPlugin.emitSharedUrl(sharedUrl);
        }
    }
}
