import type { DownloadItem, DownloadProgressEvent } from '../types'
import { humanizeError } from './downloadErrors'

const PERCENT_PATTERN = /(\d{1,3}(?:\.\d+)?)%/

/** Tags do yt-dlp que indicam pós-processamento (ffmpeg), não download. */
const CONVERTING_MARKERS = [
  '[ExtractAudio]',
  '[Merger]',
  '[ffmpeg]',
  '[VideoConvertor]',
  '[FixupM3u8]',
  '[EmbedThumbnail]',
  '[Metadata]',
  '[MoveFiles]'
]

/** Extrai a porcentagem de uma linha do yt-dlp, se houver. */
export const parsePercent = (output?: string): number | null => {
  if (!output) return null

  const match = output.match(PERCENT_PATTERN)
  if (!match) return null

  return Math.min(100, parseFloat(match[1]))
}

/**
 * Descobre em que fase o yt-dlp está a partir da linha de saída.
 * Usado no desktop; no Android o plugin manda o status explícito.
 */
export const detectPhase = (
  output?: string
): 'downloading' | 'converting' | null => {
  if (!output) return null

  const line = output.trim()

  if (CONVERTING_MARKERS.some((marker) => line.startsWith(marker) || line.includes(marker))) {
    return 'converting'
  }

  if (line.startsWith('[download]') && PERCENT_PATTERN.test(line)) {
    return 'downloading'
  }

  return null
}

/**
 * Aplica um evento de progresso ao item correspondente.
 * A conclusão vem do evento `completed` (Android) ou da promise do download
 * (desktop), porque no MP3 o yt-dlp ainda converte depois de chegar a 100%.
 */
export const applyProgress = (item: DownloadItem, event: DownloadProgressEvent): DownloadItem => {
  if (item.id !== event.id) return item

  if (event.status === 'completed') {
    return {
      ...item,
      progress: 100,
      status: 'completed',
      error: undefined,
      files: event.files?.length ? event.files : item.files
    }
  }

  if (event.status === 'cancelled') {
    return { ...item, status: 'cancelled', error: undefined }
  }

  if (event.status === 'error') {
    return { ...item, status: 'error', error: humanizeError(event.error) }
  }

  if (event.status === 'converting') {
    return { ...item, status: 'converting' }
  }

  // Fase detectada na própria linha (desktop) tem prioridade sobre o percentual.
  if (detectPhase(event.output) === 'converting') {
    return { ...item, status: 'converting' }
  }

  const progress = typeof event.progress === 'number' ? event.progress : parsePercent(event.output)

  if (progress === null) return item

  return {
    ...item,
    progress,
    // Não volta de "convertendo" para "baixando" por causa de uma linha tardia.
    status: item.status === 'converting' ? 'converting' : 'downloading'
  }
}

/** Atualiza todos os downloads que casarem com o evento. */
export const applyProgressToAll = (
  items: DownloadItem[],
  event: DownloadProgressEvent
): DownloadItem[] => items.map((item) => applyProgress(item, event))
