export type ParsedLinkKind = 'video' | 'playlist' | 'mix'

export interface ParsedLink {
  url: string
  kind: ParsedLinkKind
  videoId?: string
  playlistId?: string
}

/** Mix/rádio automático (list=RD...): o yt-dlp não consegue abrir. */
const isMix = (listId?: string): boolean => Boolean(listId && /^RD/i.test(listId))

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'youtu.be'
])

/** Pega a primeira URL de um texto (o Compartilhar manda "Título\nhttps://..."). */
const extractUrl = (input: string): string | null => {
  const match = input.match(/https?:\/\/[^\s]+/i)
  if (!match) return null

  return match[0].replace(/[.,;)\]"']+$/, '')
}

/**
 * Normaliza links do YouTube (youtu.be, shorts, live, music, playlist) para
 * uma URL canônica e descarta parâmetros de rastreio.
 */
export const parseLink = (input: string): ParsedLink | null => {
  const extracted = extractUrl(input.trim())
  if (!extracted) return null

  let url: URL
  try {
    url = new URL(extracted)
  } catch {
    return null
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const isYoutube = YOUTUBE_HOSTS.has(host)

  // Site fora do YouTube: deixa o yt-dlp decidir (ele suporta vários).
  if (!isYoutube) {
    return { url: url.toString(), kind: 'video' }
  }

  const list = url.searchParams.get('list') ?? undefined

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0]
    return id
      ? { url: `https://www.youtube.com/watch?v=${id}`, kind: 'video', videoId: id }
      : null
  }

  const path = url.pathname.replace(/\/+$/, '')
  const shorts = path.match(/^\/(?:shorts|live|embed)\/([\w-]{6,})/)
  if (shorts) {
    return {
      url: `https://www.youtube.com/watch?v=${shorts[1]}`,
      kind: 'video',
      videoId: shorts[1]
    }
  }

  const videoId = url.searchParams.get('v') ?? undefined
  if (videoId) {
    const canonical = new URL('https://www.youtube.com/watch')
    canonical.searchParams.set('v', videoId)

    // Mix não é baixável como playlist; mantém só o vídeo.
    if (list && !isMix(list)) canonical.searchParams.set('list', list)

    return {
      url: canonical.toString(),
      kind: 'video',
      videoId,
      playlistId: list && !isMix(list) ? list : undefined
    }
  }

  if (list) {
    if (isMix(list)) {
      return {
        url: `https://www.youtube.com/playlist?list=${list}`,
        kind: 'mix',
        playlistId: list
      }
    }

    return {
      url: `https://www.youtube.com/playlist?list=${list}`,
      kind: 'playlist',
      playlistId: list
    }
  }

  return null
}

/** Atalho para quem só precisa da URL canônica. */
export const normalizeLink = (input: string): string | null => parseLink(input)?.url ?? null
