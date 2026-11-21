import type { VideoFormat, VideoInfo } from '../types/platform'

/** Formato cru devolvido pelo yt-dlp (snake_case) e pelo plugin Android. */
export interface RawVideoFormat {
  format_id?: string
  format?: string
  ext?: string
  height?: number
  width?: number
  fps?: number
  filesize?: number
  filesize_approx?: number
  vcodec?: string
  acodec?: string
  format_note?: string
}

const humanSize = (bytes?: number): string | null => {
  if (!bytes || bytes <= 0) return null

  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`

  return `${Math.round(mb)} MB`
}

const buildLabel = (format: RawVideoFormat, size?: number): string => {
  const height = format.height ?? 0
  const fps = format.fps && format.fps >= 50 ? Math.round(format.fps) : null
  const parts = [`${height}p${fps ?? ''}`, format.ext ?? 'mp4']

  const sizeLabel = humanSize(size)
  if (sizeLabel) parts.push(sizeLabel)

  return parts.join(' · ')
}

/**
 * Normaliza os formatos de vídeo do yt-dlp: descarta áudio puro, deduplica
 * por resolução/container e ordena do melhor para o pior.
 */
export const normalizeFormats = (rawFormats?: RawVideoFormat[]): VideoFormat[] => {
  if (!Array.isArray(rawFormats) || rawFormats.length === 0) return []

  const best = new Map<string, VideoFormat>()

  for (const raw of rawFormats) {
    const id = raw.format_id ?? raw.format
    const vcodec = raw.vcodec ?? ''
    const height = raw.height ?? 0

    if (!id || vcodec === 'none' || height <= 0) continue

    const size = raw.filesize || raw.filesize_approx || undefined
    const hasAudio = Boolean(raw.acodec && raw.acodec !== 'none')
    const key = `${height}-${raw.ext ?? 'mp4'}`

    const candidate: VideoFormat = {
      id,
      label: buildLabel(raw, size),
      ext: raw.ext ?? 'mp4',
      height,
      fps: raw.fps,
      size,
      hasAudio,
      // Vídeo sem áudio precisa do bestaudio para o merge.
      selector: hasAudio ? id : `${id}+bestaudio/${id}`
    }

    const current = best.get(key)
    if (!current || (candidate.size ?? 0) > (current.size ?? 0)) {
      best.set(key, candidate)
    }
  }

  return [...best.values()]
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.fps ?? 0) - (a.fps ?? 0))
    .slice(0, 12)
}

/** Aplica a normalização no resultado da busca de informações. */
export const normalizeVideoInfo = (info: VideoInfo & { formats?: unknown }): VideoInfo => {
  const formats = normalizeFormats(info.formats as RawVideoFormat[] | undefined)

  return {
    title: info.title,
    uploader: info.uploader,
    duration: info.duration,
    thumbnail: info.thumbnail,
    formats
  }
}
