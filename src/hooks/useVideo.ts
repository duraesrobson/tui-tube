import { useState, useEffect, useCallback } from 'react'
import { platform } from '../lib/platform'
import { parseLink } from '../lib/youtubeUrl'
import { humanizeError } from '../lib/downloadErrors'
import type { VideoInfo } from '../types'

interface UseVideoReturn {
  videoInfo: VideoInfo | null
  isLoading: boolean
  error: string | null
  fetchVideoInfo: (url: string) => Promise<void>
  reset: () => void
}

export const useVideo = (url: string): UseVideoReturn => {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchVideoInfo = useCallback(async (urlToFetch: string) => {
    if (!urlToFetch.trim()) return

    const parsed = parseLink(urlToFetch)
    if (!parsed) {
      setVideoInfo(null)
      setError('Cole um link válido (youtube.com, youtu.be ou playlist).')
      return
    }

    if (parsed.kind === 'mix') {
      setVideoInfo(null)
      setError(
        'Mix/rádio do YouTube não pode ser baixado como playlist. Abra um vídeo do mix e use o link dele.'
      )
      return
    }

    setIsLoading(true)
    setError(null)
    setVideoInfo(null)

    try {
      const result = await platform.getVideoInfo(parsed.url)
      if (result.success && result.info) {
        setVideoInfo(result.info)
      } else {
        setError(humanizeError(result.error || 'Falha ao obter informações'))
      }
    } catch {
      setError('Erro ao conectar com o serviço')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setVideoInfo(null)
    setError(null)
  }, [])

  useEffect(() => {
    if (!url.trim()) return

    const timer = setTimeout(() => {
      fetchVideoInfo(url)
    }, 500)

    return () => clearTimeout(timer)
  }, [url, fetchVideoInfo])

  useEffect(() => {
    reset()
  }, [url, reset])

  return { videoInfo, isLoading, error, fetchVideoInfo, reset }
}
