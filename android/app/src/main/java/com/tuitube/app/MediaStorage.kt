package com.tuitube.app

import android.content.ContentValues
import android.content.Context
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

data class SavedFile(
    val uri: String,
    val name: String,
    val mime: String,
    val size: Long
)

/**
 * Copia os arquivos gerados pelo yt-dlp (cache privado do app) para
 * Download/tui-tube, que é acessível ao usuário sem permissões perigosas.
 */
object MediaStorage {
    private const val FOLDER = "tui-tube"

    fun saveAll(context: Context, sourceDir: File, folder: String): List<SavedFile> {
        val files = sourceDir.listFiles()?.filter { it.isFile && it.length() > 0 } ?: return emptyList()

        return files.mapNotNull { save(context, it, folder) }
    }

    private fun save(context: Context, file: File, folder: String): SavedFile? {
        val mime = mimeFor(file.name)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveWithMediaStore(context, file, mime, folder)
        } else {
            saveLegacy(context, file, mime, folder)
        }
    }

    private fun saveWithMediaStore(context: Context, file: File, mime: String, folder: String): SavedFile? {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, file.name)
            put(MediaStore.MediaColumns.MIME_TYPE, mime)
            put(
                MediaStore.MediaColumns.RELATIVE_PATH,
                "${Environment.DIRECTORY_DOWNLOADS}/$FOLDER/$folder"
            )
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
        val uri: Uri = resolver.insert(collection, values) ?: return null

        return try {
            resolver.openOutputStream(uri)?.use { output ->
                file.inputStream().use { input -> input.copyTo(output) }
            } ?: throw IllegalStateException("Não foi possível abrir o destino")

            values.clear()
            values.put(MediaStore.MediaColumns.IS_PENDING, 0)
            resolver.update(uri, values, null, null)

            SavedFile(uri = uri.toString(), name = file.name, mime = mime, size = file.length())
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun saveLegacy(context: Context, file: File, mime: String, folder: String): SavedFile? {
        val target = File(
            File(
                File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), FOLDER),
                folder
            ),
            file.name
        )

        return try {
            target.parentFile?.mkdirs()
            file.copyTo(target, overwrite = true)
            MediaScannerConnection.scanFile(context, arrayOf(target.absolutePath), arrayOf(mime), null)

            SavedFile(
                uri = Uri.fromFile(target).toString(),
                name = target.name,
                mime = mime,
                size = target.length()
            )
        } catch (e: Exception) {
            null
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
