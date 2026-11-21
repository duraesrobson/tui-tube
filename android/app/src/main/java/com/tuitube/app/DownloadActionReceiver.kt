package com.tuitube.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Ação "Cancelar" da notificação do download. */
class DownloadActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action == DownloadService.ACTION_CANCEL) {
            DownloadEngine.cancel()
        }
    }
}
