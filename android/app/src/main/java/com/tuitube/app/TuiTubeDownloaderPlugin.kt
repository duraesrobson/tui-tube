package com.tuitube.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import com.getcapacitor.JSArray
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
import java.util.UUID

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

        val id = call.getString("id") ?: UUID.randomUUID().toString()
        val format = call.getString("format") ?: "mp3"
        val quality = call.getString("quality") ?: "0"
        val playlist = call.getBoolean("playlist") ?: false
        val appContext = context.applicationContext

        DownloadEngine.startDownload(
            context = appContext,
            id = id,
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
                put("id", id)
                put("started", true)
            }
        )
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        DownloadEngine.cancel(call.getString("id"))

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

    /** Abre o arquivo no app padrão do usuário (player, visualizador...). */
    @PluginMethod
    fun openFile(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri.isNullOrBlank()) {
            call.reject("Arquivo inválido")
            return
        }

        val mime = call.getString("mime") ?: "*/*"

        try {
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(Uri.parse(uri), mime)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            val chooser = Intent.createChooser(intent, "Abrir com").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(chooser)
            call.resolve()
        } catch (e: ActivityNotFoundException) {
            call.reject("Nenhum app instalado consegue abrir este arquivo")
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao abrir arquivo", e)
            call.reject(e.message ?: "Não foi possível abrir o arquivo")
        }
    }

    /** Apaga o arquivo publicado (idempotente: sumiu = sucesso). */
    @PluginMethod
    fun deleteFile(call: PluginCall) {
        val uri = call.getString("uri")
        if (uri.isNullOrBlank()) {
            call.reject("Arquivo inválido")
            return
        }

        try {
            context.contentResolver.delete(Uri.parse(uri), null, null)
            call.resolve()
        } catch (e: SecurityException) {
            Log.w(TAG, "Sem permissão para apagar $uri", e)
            call.reject("O Android precisa confirmar a remoção deste arquivo")
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao remover arquivo", e)
            call.reject(e.message ?: "Não foi possível remover o arquivo")
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
            put("id", event.id)
            put("url", event.url)
            event.percent?.let { put("progress", it) }
            event.status?.let { put("status", it) }
            event.error?.let { put("error", it) }
            event.files?.let { put("files", filesToJson(it)) }
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

    private fun filesToJson(files: List<SavedFile>): JSArray {
        val array = JSArray()

        files.forEach { file ->
            array.put(
                JSObject().apply {
                    put("uri", file.uri)
                    put("name", file.name)
                    put("mime", file.mime)
                    put("size", file.size)
                }
            )
        }

        return array
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
