import type { DownloadItem, DownloadProgressEvent } from '../types'

const PERCENT_PATTERN = /(\d{1,3}(?:\.\d+)?)%/

/** Extrai a porcentagem de uma linha do yt-dlp, se houver. */
export const parsePercent = (output?: string): number | null => {
  if (!output) return null

  const match = output.match(PERCENT_PATTERN)
  if (!match) return null

  return Math.min(100, parseFloat(match[1]))
}

/**
 * Aplica um evento de progresso ao item correspondente.
 * Sem `status` explícito (desktop), o item continua em andamento: a conclusão
 * vem da promise do download, porque no MP3 o yt-dlp ainda converte o arquivo
 * depois de chegar a 100%.
 */
export const applyProgress = (item: DownloadItem, event: DownloadProgressEvent): DownloadItem => {
  if (item.id !== event.id) return item

  const progress = typeof event.progress === 'number' ? event.progress : parsePercent(event.output)

  if (event.status === 'completed') {
    return { ...item, progress: 100, status: 'completed', error: undefined }
  }

  if (event.status === 'error') {
    return { ...item, status: 'error', error: event.error || 'Falha no download' }
  }

  if (progress === null) return item

  return { ...item, progress }
}

/** Atualiza todos os downloads que casarem com o evento. */
export const applyProgressToAll = (
  items: DownloadItem[],
  event: DownloadProgressEvent
): DownloadItem[] => items.map((item) => applyProgress(item, event))
