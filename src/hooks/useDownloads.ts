import { useState, useEffect, useCallback } from 'react'
import { platform } from '../lib/platform'
import { applyProgressToAll } from '../lib/downloadProgress'
import type { DownloadItem, DownloadOptions } from '../types'

interface UseDownloadsReturn {
  downloads: DownloadItem[]
  currentDownload: DownloadItem | undefined
  isDownloading: boolean
  addDownload: (url: string, title: string, format: 'mp3' | 'mp4', downloadPlaylist?: boolean) => Promise<void>
  clearCompleted: () => void
}

export const useDownloads = (): UseDownloadsReturn => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  useEffect(() => {
    const unsubscribe = platform.onDownloadProgress((event) => {
      setDownloads((prev) => applyProgressToAll(prev, event))
    })

    return unsubscribe
  }, [])

  const addDownload = useCallback(async (
    url: string,
    title: string,
    format: 'mp3' | 'mp4',
    downloadPlaylist = false
  ) => {
    const id = crypto.randomUUID()
    const newItem: DownloadItem = {
      id,
      url,
      title: title || 'Video',
      format,
      status: 'queued',
      progress: 0
    }

    setDownloads((prev) => [...prev, newItem])

    try {
      setDownloads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'downloading' } : item))
      )

      const options: DownloadOptions = {
        id,
        format,
        quality: '0',
        outputFolder: ''
      }

      const downloadFn = downloadPlaylist ? platform.downloadPlaylist : platform.downloadVideo
      const result = await downloadFn(url, options)

      if (result.started) return

      setDownloads((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: result.success ? 'completed' : 'error',
                error: result.error
              }
            : item
        )
      )
    } catch {
      setDownloads((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: 'error',
                error: 'Erro ao baixar'
              }
            : item
        )
      )
    }
  }, [])

  const clearCompleted = useCallback(() => {
    setDownloads((prev) => prev.filter((item) => item.status !== 'completed'))
  }, [])

  const currentDownload = downloads.find((d) => d.status === 'downloading')
  const isDownloading = downloads.some(
    (item) => item.status === 'downloading' || item.status === 'queued'
  )

  return {
    downloads,
    currentDownload,
    isDownloading,
    addDownload,
    clearCompleted
  }
}
