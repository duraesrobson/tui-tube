package com.tuitube.app

import android.content.Intent

/**
 * Guarda o link recebido pelo "Compartilhar" do Android até a UI consumi-lo.
 * O app é singleTask: um novo share chega em onNewIntent, não em onCreate.
 */
object ShareIntake {
    private val YOUTUBE_URL = Regex(
        "https?://(?:www\\.|m\\.)?(?:youtube\\.com|youtu\\.be|music\\.youtube\\.com)/\\S+",
        RegexOption.IGNORE_CASE
    )
    private val ANY_URL = Regex("https?://\\S+", RegexOption.IGNORE_CASE)

    @Volatile
    private var pending: String? = null

    /** Lê o texto compartilhado, guarda e devolve a URL encontrada (ou null). */
    fun capture(intent: Intent?): String? {
        if (intent == null || intent.action != Intent.ACTION_SEND) return null
        if (intent.type?.startsWith("text/") != true) return null

        val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim().orEmpty()
        val url = extractUrl(text) ?: return null

        pending = url
        return url
    }

    /** URL pendente + limpeza, para o JS buscar no boot. */
    fun consume(): String? {
        val url = pending
        pending = null
        return url
    }

    private fun extractUrl(text: String): String? {
        if (text.isEmpty()) return null

        val match = YOUTUBE_URL.find(text) ?: ANY_URL.find(text)
        return match?.value?.trimEnd('.', ',', ';', ')', ']', '"', '\'')
    }
}
