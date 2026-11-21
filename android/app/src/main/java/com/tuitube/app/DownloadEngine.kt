package com.tuitube.app

import android.content.Context
import android.util.Log
import com.farimarwat.commons.UpdateChannel
import com.farimarwat.commons.VideoInfo
import com.farimarwat.commons.YoutubeDLRequest
import com.farimarwat.library.YoutubeDL
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

data class DownloadEvent(
    val id: String,
    val url: String,
    val percent: Double? = null,
    val status: String? = null,
    val error: String? = null,
    val files: List<SavedFile>? = null
)

/**
 * Dono do yt-dlp no dispositivo. Vive fora da Activity para sobreviver a
 * mudanças de configuração enquanto o DownloadService mantém o app em foco.
 */
object DownloadEngine {
    private const val TAG = "TuiTube"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val initMutex = Mutex()
    private val initialized = AtomicBoolean(false)
    private val activeJobs = AtomicInteger(0)
    private val processIds = ConcurrentHashMap<String, String>()
    private val cancelledJobs = ConcurrentHashMap.newKeySet<String>()
    private val jobs = ConcurrentHashMap<String, Job>()

    /** Tags do yt-dlp que indicam pós-processamento (ffmpeg), não download. */
    private val convertingMarkers = listOf(
        "[ExtractAudio]",
        "[Merger]",
        "[ffmpeg]",
        "[VideoConvertor]",
        "[FixupM3u8]",
        "[EmbedThumbnail]",
        "[Metadata]",
        "[MoveFiles]"
    )

    private fun detectPhase(line: String): String? {
        val trimmed = line.trim()

        if (convertingMarkers.any { trimmed.startsWith(it) || trimmed.contains(it) }) {
            return "converting"
        }

        if (trimmed.startsWith("[download]") && trimmed.contains("%")) {
            return "downloading"
        }

        return null
    }

    fun hasActiveJobs(): Boolean = activeJobs.get() > 0

    private suspend fun ensureInitialized(context: Context) {
        if (initialized.get()) return

        initMutex.withLock {
            if (initialized.get()) return

            suspendCancellableCoroutine<Unit> { cont ->
                YoutubeDL.init(
                    appContext = context.applicationContext,
                    withFfmpeg = true,
                    withAria2c = false,
                    onSuccess = {
                        initialized.set(true)
                        if (cont.isActive) cont.resume(Unit)
                    },
                    onError = { error ->
                        if (cont.isActive) cont.resumeWithException(error)
                    }
                )
            }
        }
    }

    suspend fun getInfo(context: Context, url: String): VideoInfo = withContext(Dispatchers.IO) {
        ensureInitialized(context.applicationContext)

        suspendCancellableCoroutine { cont ->
            YoutubeDL.getInfo(
                request = YoutubeDLRequest(url).addOption("--no-playlist"),
                onSuccess = { info -> if (cont.isActive) cont.resume(info) },
                onError = { error -> if (cont.isActive) cont.resumeWithException(error) }
            )
        }
    }

    fun startDownload(
        context: Context,
        id: String,
        url: String,
        format: String,
        quality: String,
        playlist: Boolean,
        emit: (DownloadEvent) -> Unit
    ) {
        val appContext = context.applicationContext
        activeJobs.incrementAndGet()
        DownloadService.start(appContext)

        scope.launch {
            val workDir = File(appContext.cacheDir, "tui-tube/$id")

            try {
                ensureInitialized(appContext)

                workDir.mkdirs()

                val request = buildRequest(url, format, quality, playlist, workDir)
                val processId = UUID.randomUUID().toString()
                processIds[id] = processId
                val lastPhase = AtomicReference<String?>(null)

                suspendCancellableCoroutine<Unit> { cont ->
                    val job = YoutubeDL.download(
                        request = request,
                        pId = processId,
                        progressCallBack = { percent, _, line ->
                            val phase = detectPhase(line)

                            if (phase != null && phase != lastPhase.get()) {
                                lastPhase.set(phase)
                                emit(DownloadEvent(id = id, url = url, status = phase))
                            }

                            if (percent >= 0f) {
                                emit(DownloadEvent(id = id, url = url, percent = percent.toDouble()))
                            }
                        },
                        onStartProcess = { /* processo já rastreado pelo yt-dlp */ },
                        onEndProcess = { response ->
                            scope.launch {
                                try {
                                    if (response.exitCode == 0) {
                                        handleSuccess(appContext, workDir, id, url, format, emit)
                                    } else {
                                        val stderr = response.err
                                        emit(
                                            DownloadEvent(
                                                id = id,
                                                url = url,
                                                status = "error",
                                                error = stderr
                                                    .take(500)
                                                    .ifBlank { "yt-dlp falhou (código ${response.exitCode})" }
                                            )
                                        )
                                    }
                                } catch (e: Exception) {
                                    Log.e(TAG, "Falha ao finalizar download", e)
                                    emit(
                                        DownloadEvent(
                                            id = id,
                                            url = url,
                                            status = "error",
                                            error = e.message ?: "Falha ao finalizar o download"
                                        )
                                    )
                                } finally {
                                    if (cont.isActive) cont.resume(Unit)
                                }
                            }
                        },
                        onError = { error ->
                            val wasCancelled = cancelledJobs.remove(id)

                            emit(
                                DownloadEvent(
                                    id = id,
                                    url = url,
                                    status = if (wasCancelled) "cancelled" else "error",
                                    error = if (wasCancelled) null else (error.message ?: "Falha no download")
                                )
                            )
                            if (cont.isActive) cont.resume(Unit)
                        }
                    )

                    jobs[id] = job
                }
            } catch (e: CancellationException) {
                emit(DownloadEvent(id = id, url = url, status = "error", error = "Download cancelado"))
            } catch (e: Exception) {
                Log.e(TAG, "Falha no download", e)
                emit(
                    DownloadEvent(
                        id = id,
                        url = url,
                        status = "error",
                        error = e.message ?: "Falha ao iniciar o download"
                    )
                )
            } finally {
                if (workDir.exists()) workDir.deleteRecursively()
                cancelledJobs.remove(id)
                processIds.remove(id)
                jobs.remove(id)
                if (activeJobs.decrementAndGet() <= 0) {
                    DownloadService.stop(appContext)
                }
            }
        }
    }

    private suspend fun handleSuccess(
        context: Context,
        workDir: File,
        id: String,
        url: String,
        format: String,
        emit: (DownloadEvent) -> Unit
    ) {
        val folder = if (format == "mp3") "Audio" else "Video"

        val saved = try {
            withContext(Dispatchers.IO) { MediaStorage.saveAll(context, workDir, folder) }
        } catch (e: Exception) {
            Log.e(TAG, "Falha ao salvar arquivos", e)
            emit(DownloadEvent(id = id, url = url, status = "error", error = e.message ?: "Falha ao salvar o arquivo"))
            return
        }

        if (saved.isNotEmpty()) {
            emit(DownloadEvent(id = id, url = url, status = "completed", files = saved))
        } else {
            emit(DownloadEvent(id = id, url = url, status = "error", error = "Nenhum arquivo foi gerado"))
        }
    }

    fun cancel(id: String? = null) {
        val targets = if (id != null) listOf(id) else processIds.keys.toList()

        for (key in targets) {
            cancelledJobs.add(key)
            processIds[key]?.let { pid -> runCatching { YoutubeDL.destroyProcessById(pid) } }
            jobs[key]?.cancel()
        }
    }

    suspend fun updateEngine(context: Context): String = withContext(Dispatchers.IO) {
        val appContext = context.applicationContext
        ensureInitialized(appContext)

        YoutubeDL.updateYoutubeDL(
            appContext = appContext,
            updateChannel = UpdateChannel.STABLE,
            onSuccess = { },
            onError = { }
        )

        YoutubeDL.version(appContext).orEmpty()
    }

    fun version(context: Context): String = runCatching {
        YoutubeDL.version(context.applicationContext).orEmpty()
    }.getOrDefault("")

    private fun buildRequest(
        url: String,
        format: String,
        quality: String,
        playlist: Boolean,
        workDir: File
    ): YoutubeDLRequest {
        val template = if (playlist) {
            "%(playlist_index)02d - %(title).80B.%(ext)s"
        } else {
            "%(title).80B.%(ext)s"
        }

        val request = YoutubeDLRequest(url)
            .addOption("-o", File(workDir, template).absolutePath)
            .addOption("--no-mtime")
            .addOption("--no-warnings")
            .addOption("--newline")
            .addOption("--retries", 3)
            .addOption("--fragment-retries", 3)
            .addOption(if (playlist) "--yes-playlist" else "--no-playlist")

        if (format == "mp3") {
            request
                .addOption("-x")
                .addOption("--audio-format", "mp3")
                .addOption("--audio-quality", if (quality.isBlank()) "0" else quality)
        } else {
            request
                .addOption("-f", videoSelector(quality))
                .addOption("--merge-output-format", "mp4")
        }

        return request
    }

    private fun videoSelector(quality: String): String = when (quality) {
        "1080p" -> "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
        "720p" -> "bestvideo[height<=720]+bestaudio/best[height<=720]/best"
        "480p" -> "bestvideo[height<=480]+bestaudio/best[height<=480]/best"
        "360p" -> "bestvideo[height<=360]+bestaudio/best[height<=360]/best"
        else -> "bestvideo+bestaudio/best"
    }
}
