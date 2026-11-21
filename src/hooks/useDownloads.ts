import { useCallback, useEffect, useRef, useState } from 'react'
import { platform } from '../lib/platform'
import { applyProgressToAll } from '../lib/downloadProgress'
import { loadHistory, saveHistory } from '../lib/history'
import { humanizeError } from '../lib/downloadErrors'
import type { DownloadItem, DownloadOptions, DownloadRequest } from '../types'

export interface StartDownloadInput extends DownloadRequest {
  title: string
  playlistItems?: string
}

interface UseDownloadsReturn {
  downloads: DownloadItem[]
  activeDownloads: DownloadItem[]
  finishedDownloads: DownloadItem[]
  currentDownload: DownloadItem | undefined
  isDownloading: boolean
  atCapacity: boolean
  startDownload: (input: StartDownloadInput) => Promise<void>
  retryDownload: (item: DownloadItem) => Promise<void>
  cancelDownload: (id: string) => Promise<void>
  openDownload: (item: DownloadItem) => Promise<void>
  removeDownload: (item: DownloadItem) => Promise<void>
}

const ACTIVE_STATUSES: DownloadItem['status'][] = ['queued', 'downloading', 'converting']
const RUNNING_STATUSES: DownloadItem['status'][] = ['downloading', 'converting']

/** Quantos downloads podem rodar ao mesmo tempo. */
const MAX_CONCURRENT = 2

const isActive = (item: DownloadItem) => ACTIVE_STATUSES.includes(item.status)

export const useDownloads = (): UseDownloadsReturn => {
  const [downloads, setDownloads] = useState<DownloadItem[]>(() => loadHistory())
  const startingRef = useRef<Set<string>>(new Set())

  const patch = useCallback((id: string, changes: Partial<DownloadItem>) => {
    setDownloads((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }, [])

  // Assinatura curta: evita gravar localStorage a cada evento de progresso.
  const historySignature = downloads
    .filter((item) => !isActive(item))
    .map((item) => `${item.id}:${item.status}`)
    .join('|')

  useEffect(() => {
    saveHistory(downloads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySignature])

  useEffect(() => {
    const unsubscribe = platform.onDownloadProgress((event) => {
      setDownloads((prev) => applyProgressToAll(prev, event))
    })

    return unsubscribe
  }, [])

  const runDownload = useCallback(
    async (id: string, input: DownloadRequest) => {
      patch(id, { status: 'downloading', progress: 0, error: undefined, files: undefined })

      const options: DownloadOptions = {
        id,
        format: input.format,
        quality: input.quality,
        outputFolder: input.outputFolder,
        playlistItems: input.playlistItems
      }

      try {
        const downloadFn = input.playlist ? platform.downloadPlaylist : platform.downloadVideo
        const result = await downloadFn(input.url, options)

        // Android inicia o job em background: a conclusão chega pelo evento.
        if (result.started) return

        patch(id, {
          status: result.cancelled ? 'cancelled' : result.success ? 'completed' : 'error',
          progress: result.success ? 100 : undefined,
          error: result.error ? humanizeError(result.error) : undefined,
          files: result.files
        })
      } catch {
        patch(id, { status: 'error', error: 'Erro ao iniciar o download' })
      }
    },
    [patch]
  )

  const startDownload = useCallback(
    async (input: StartDownloadInput) => {
      const id = crypto.randomUUID()

      const request: DownloadRequest = {
        url: input.url,
        format: input.format,
        quality: input.quality,
        outputFolder: input.outputFolder,
        playlist: input.playlist,
        playlistItems: input.playlistItems
      }

      setDownloads((prev) => [
        ...prev,
        {
          id,
          url: input.url,
          title: input.title || 'Video',
          format: input.format,
          status: 'queued',
          progress: 0,
          request
        }
      ])

      // O efeito da fila inicia quando houver vaga.
    },
    []
  )

  const retryDownload = useCallback(
    async (item: DownloadItem) => {
      if (!item.request) return

      patch(item.id, { status: 'queued', progress: 0, error: undefined, files: undefined })
    },
    [patch]
  )

  const cancelDownload = useCallback(
    async (id: string) => {
      patch(id, { status: 'cancelled', error: undefined })

      try {
        await platform.cancelDownload(id)
      } catch {
        // Item já marcado; a UI segue consistente.
      }
    },
    [patch]
  )

  const openDownload = useCallback(
    async (item: DownloadItem) => {
      const file = item.files?.[0]
      if (!file) return

      try {
        await platform.openFile(file)
      } catch {
        patch(item.id, { error: 'Não foi possível abrir o arquivo' })
      }
    },
    [patch]
  )

  const removeDownload = useCallback(
    async (item: DownloadItem) => {
      const files = item.files ?? []

      if (files.length > 0) {
        const confirmed = window.confirm(`Remover "${item.title}" do dispositivo?`)
        if (!confirmed) return

        try {
          for (const file of files) {
            await platform.deleteFile(file)
          }
        } catch {
          patch(item.id, { error: 'Não foi possível remover o arquivo' })
          return
        }
      }

      setDownloads((prev) => prev.filter((current) => current.id !== item.id))
    },
    [patch]
  )

  const runningCount = downloads.filter((item) => RUNNING_STATUSES.includes(item.status)).length
  const atCapacity = runningCount >= MAX_CONCURRENT

  // Inicia o próximo da fila respeitando o limite de concorrência.
  useEffect(() => {
    if (runningCount >= MAX_CONCURRENT) return

    const next = downloads.find(
      (item) => item.status === 'queued' && item.request && !startingRef.current.has(item.id)
    )

    if (!next?.request) return

    startingRef.current.add(next.id)

    void runDownload(next.id, next.request).finally(() => {
      startingRef.current.delete(next.id)
    })
  }, [downloads, runningCount, runDownload])

  const activeDownloads = downloads.filter(isActive)
  const finishedDownloads = downloads.filter((item) => !isActive(item))
  const currentDownload = activeDownloads[0]
  const isDownloading = activeDownloads.length > 0

  return {
    downloads,
    activeDownloads,
    finishedDownloads,
    currentDownload,
    isDownloading,
    atCapacity,
    startDownload,
    retryDownload,
    cancelDownload,
    openDownload,
    removeDownload
  }
}
