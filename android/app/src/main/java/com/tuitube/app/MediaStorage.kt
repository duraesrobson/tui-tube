package com.tuitube.app

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

/**
 * Copia os arquivos gerados pelo yt-dlp (cache privado do app) para
 * Download/tui-tube, que é acessível ao usuário sem permissões perigosas.
 */
object MediaStorage {
    private const val FOLDER = "tui-tube"

    fun saveAll(context: Context, sourceDir: File): Int {
        val files = sourceDir.listFiles()?.filter { it.isFile && it.length() > 0 } ?: return 0
        var saved = 0

        for (file in files) {
            if (save(context, file)) saved++
        }

        return saved
    }

    private fun save(context: Context, file: File): Boolean {
        val mime = mimeFor(file.name)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveWithMediaStore(context, file, mime)
        } else {
            saveLegacy(context, file, mime)
        }
    }

    private fun saveWithMediaStore(context: Context, file: File, mime: String): Boolean {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                "${Environment.DIRECTORY_DOWNLOADS}/$FOLDER"
            )
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
        val uri: Uri = resolver.insert(collection, values) ?: return false

        return try {
            resolver.openOutputStream(uri)?.use { output ->
                file.inputStream().use { input -> input.copyTo(output) }
            } ?: throw IllegalStateException("Não foi possível abrir o destino")

            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            true
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            false
        }
    }

    @Suppress("DEPRECATION")
    private fun saveLegacy(context: Context, file: File, mime: String): Boolean {
        val target = File(
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER),
            file.name
        )

        return try {
            target.parentFile?.mkdirs()
            file.copyTo(target, overwrite = true)
            MediaScannerConnection.scanFile(context, arrayOf(target.absolutePath), arrayOf(mime), null)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun mimeFor(name: String): String = when (name.substringAfterLast('.', "").lowercase()) {
        "mp3" -> "audio/mpeg"
        "m4a", "aac" -> "audio/mp4"
        "opus", "ogg" -> "audio/ogg"
        "wav" -> "audio/wav"
        "flac" -> "audio/flac"
        "mp4" -> "video/mp4"
        "webm" -> "video/webm"
        "mkv" -> "video/x-matroska"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "webp" -> "image/webp"
        else -> "application/octet-stream"
    }
}
