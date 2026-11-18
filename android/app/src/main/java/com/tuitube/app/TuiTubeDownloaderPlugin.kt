package com.tuitube.app

import android.Manifest
import android.content.Intent
import android.os.Build
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@CapacitorPlugin(
    name = "TuiTubeDownloader",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        )
    ]
)
class TuiTubeDownloaderPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    @PluginMethod
    fun getVideoInfo(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("URL obrigatória")
            return
        }

        scope.launch {
            try {
                val info = withContext(Dispatchers.IO) {
                    DownloadEngine.getInfo(context, url)
                }

                val result = JSObject().apply {
                    put("success", true)
                    put("info", JSObject().apply {
                        put("title", info.title ?: "")
                        put("uploader", info.uploader ?: "")
                        put("duration", info.duration)
                        put("thumbnail", info.thumbnail ?: "")
                    })
                }

                call.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "getVideoInfo falhou", e)
                call.resolve(
                    JSObject().apply {
                        put("success", false)
                        put("error", friendlyError(e))
                    }
                )
            }
        }
    }

    @PluginMethod
    fun download(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            getPermissionState("notifications") != PermissionState.GRANTED
        ) {
            requestPermissionForAlias("notifications", call, "notificationsCallback")
            return
        }

        startDownload(call)
    }

    @PermissionCallback
    private fun notificationsCallback(call: PluginCall) {
        // A notificação é opcional: o download segue mesmo se o usuário negar.
        startDownload(call)
    }

    private fun startDownload(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("URL obrigatória")
            return
        }

        val format = call.getString("format") ?: "mp3"
        val quality = call.getString("quality") ?: "0"
        val playlist = call.getBoolean("playlist") ?: false
        val appContext = context.applicationContext

        DownloadEngine.startDownload(
            context = appContext,
            url = url,
            format = format,
            quality = quality,
            playlist = playlist
        ) { event ->
            notifyProgress(event)
        }

        call.resolve(
            JSObject().apply {
                put("success", true)
                put("url", url)
                put("started", true)
            }
        )
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        DownloadEngine.cancel(call.getString("url"))

        call.resolve(JSObject().apply { put("success", true) })
    }

    @PluginMethod
    fun updateEngine(call: PluginCall) {
        scope.launch {
            try {
                val version = withContext(Dispatchers.IO) {
                    DownloadEngine.updateEngine(context)
                }

                call.resolve(
                    JSObject().apply {
                        put("success", true)
                        put("version", version)
                    }
                )
            } catch (e: Exception) {
                Log.e(TAG, "updateEngine falhou", e)
                call.resolve(
                    JSObject().apply {
                        put("success", false)
                        put("error", friendlyError(e))
                    }
                )
            }
        }
    }

    @PluginMethod
    fun openDownloads(call: PluginCall) {
        try {
            val intent = Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Não foi possível abrir o gerenciador de downloads")
        }
    }

    /** Link recebido pelo "Compartilhar" antes da UI carregar (consumido uma vez). */
    @PluginMethod
    fun getSharedLink(call: PluginCall) {
        val url = ShareIntake.consume()

        call.resolve(
            JSObject().apply {
                put("url", url ?: "")
            }
        )
    }

    override fun load() {
        instance = this
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
        super.handleOnDestroy()
    }

    private fun notifyShared(url: String) {
        val payload = JSObject().apply { put("url", url) }

        val send = {
            try {
                notifyListeners("shareReceived", payload)
            } catch (e: Exception) {
                Log.w(TAG, "Falha ao notificar compartilhamento", e)
            }
        }

        val host = activity
        if (host != null) {
            host.runOnUiThread { send() }
        } else {
            send()
        }
    }

    private fun notifyProgress(event: DownloadEvent) {
        val payload = JSObject().apply {
            put("url", event.url)
            event.percent?.let { put("progress", it) }
            event.status?.let { put("status", it) }
            event.error?.let { put("error", it) }
        }

        val send = {
            try {
                notifyListeners("downloadProgress", payload)
            } catch (e: Exception) {
                // WebView pode ter sido destruída (app fechado): o download termina mesmo assim.
                Log.w(TAG, "Falha ao notificar progresso", e)
            }
        }

        val host = activity
        if (host != null) {
            host.runOnUiThread { send() }
        } else {
            send()
        }
    }

    private fun friendlyError(error: Throwable): String {
        val message = error.message?.takeIf { it.isNotBlank() } ?: "Falha ao executar o yt-dlp"
        return if (message.length > 500) message.take(500) else message
    }

    companion object {
        private const val TAG = "TuiTube"

        @Volatile
        private var instance: TuiTubeDownloaderPlugin? = null

        /** Chamado pelo MainActivity quando o app já está aberto (singleTask). */
        @JvmStatic
        fun emitSharedUrl(url: String) {
            instance?.notifyShared(url)
        }
    }
}
