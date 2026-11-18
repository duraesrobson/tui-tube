import { useState, useEffect, useCallback } from 'react'
import { platform } from '../lib/platform'
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

    setIsLoading(true)
    setError(null)
    setVideoInfo(null)

    try {
      const result = await platform.getVideoInfo(urlToFetch)
      if (result.success && result.info) {
        setVideoInfo(result.info)
      } else {
        setError(result.error || 'Falha ao obter informações')
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
