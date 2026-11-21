package com.tuitube.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service que mantém o download vivo em segundo plano e reflete o
 * progresso na notificação. O trabalho real fica no DownloadEngine.
 */
class DownloadService : Service() {
    companion object {
        private const val CHANNEL_PROGRESS = "tui_tube_downloads"
        private const val CHANNEL_DONE = "tui_tube_done"
        private const val NOTIFICATION_ID = 1001
        private const val DONE_NOTIFICATION_ID = 1002

        const val ACTION_CANCEL = "com.tuitube.app.CANCEL_DOWNLOADS"

        private const val UPDATE_INTERVAL_MS = 800L

        @Volatile
        private var lastUpdate = 0L

        @Volatile
        private var lastText = ""

        fun start(context: Context) {
            val intent = Intent(context, DownloadService::class.java)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, DownloadService::class.java))
        }

        /** Atualiza a notificação em andamento (throttle para não floodar). */
        fun update(context: Context, text: String, percent: Int? = null) {
            val now = SystemClock.elapsedRealtime()

            if (text == lastText || now - lastUpdate < UPDATE_INTERVAL_MS) return

            lastUpdate = now
            lastText = text

            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            manager.notify(NOTIFICATION_ID, buildProgressNotification(context, text, percent))
        }

        /** Notificação final, com toque para abrir o arquivo. */
        fun notifyDone(context: Context, text: String, uri: String?, mime: String?) {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            createChannel(
                context,
                CHANNEL_DONE,
                "Downloads concluídos",
                NotificationManager.IMPORTANCE_DEFAULT
            )

            manager.notify(
                DONE_NOTIFICATION_ID,
                NotificationCompat.Builder(context, CHANNEL_DONE)
                    .setContentTitle("tui-tube")
                    .setContentText(text)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setAutoCancel(true)
                    .setContentIntent(openFileIntent(context, uri, mime))
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .build()
            )
        }

        fun clearDoneNotification(context: Context) {
            context.getSystemService(NotificationManager::class.java)
                ?.cancel(DONE_NOTIFICATION_ID)
        }

        private fun openFileIntent(context: Context, uri: String?, mime: String?): PendingIntent {
            val intent = if (!uri.isNullOrBlank()) {
                Intent(Intent.ACTION_VIEW)
                    .setDataAndType(Uri.parse(uri), mime ?: "*/*")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
                Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)
            }

            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            return PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        private fun buildProgressNotification(
            context: Context,
            text: String,
            percent: Int?
        ): Notification {
            val builder = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
                .setContentTitle("tui-tube")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .addAction(
                    0,
                    "Cancelar",
                    PendingIntent.getBroadcast(
                        context,
                        1,
                        Intent(context, DownloadActionReceiver::class.java)
                            .setAction(ACTION_CANCEL),
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                )

            if (percent != null) {
                builder.setProgress(100, percent.coerceIn(0, 100), false)
            } else {
                builder.setProgress(0, 0, true)
            }

            return builder.build()
        }

        private fun createChannel(
            context: Context,
            id: String,
            name: String,
            importance: Int
        ) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            if (manager.getNotificationChannel(id) != null) return

            manager.createNotificationChannel(
                NotificationChannel(id, name, importance).apply {
                    description = "Progresso dos downloads do tui-tube"
                    setShowBadge(false)
                }
            )
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel(this, CHANNEL_PROGRESS, "Downloads", NotificationManager.IMPORTANCE_LOW)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildProgressNotification(this, "Preparando download...", null))
        lastText = "Preparando download..."
        lastUpdate = SystemClock.elapsedRealtime()

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        lastText = ""
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }

        super.onDestroy()
    }
}
