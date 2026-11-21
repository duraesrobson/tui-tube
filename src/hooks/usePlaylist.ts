import { useCallback, useEffect, useRef, useState } from 'react'
import { platform } from '../lib/platform'
import { humanizeError } from '../lib/downloadErrors'
import type { PlaylistItem } from '../types'

export const PLAYLIST_PAGE_SIZE = 10

interface UsePlaylistReturn {
  items: PlaylistItem[]
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  loadMore: () => void
  loadAll: (maxItems?: number) => Promise<PlaylistItem[]>
  reset: () => void
}

/**
 * Carrega a playlist em páginas de 10 itens, acumulando as páginas já vistas.
 */
export const usePlaylist = (url: string | null, enabled: boolean): UsePlaylistReturn => {
  const [items, setItems] = useState<PlaylistItem[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRef = useRef(0)

  const load = useCallback(
    async (start: number, append: boolean) => {
      if (!url) return

      const requestId = ++requestRef.current
      append ? setIsLoadingMore(true) : setIsLoading(true)
      setError(null)

      try {
        const result = await platform.getPlaylistInfo(url, {
          start,
          pageSize: PLAYLIST_PAGE_SIZE
        })

        if (requestId !== requestRef.current) return

        if (!result.success) {
          setError(humanizeError(result.error))
          return
        }

        const page = result.items ?? []

        setItems((prev) => (append ? [...prev, ...page] : page))
        setHasMore(Boolean(result.hasMore))

        if (page.length === 0) {
          setError(result.error || 'Nenhum item encontrado')
        }
      } catch {
        if (requestId === requestRef.current) {
          setError('Não foi possível listar a playlist')
        }
      } finally {
        if (requestId === requestRef.current) {
          setIsLoading(false)
          setIsLoadingMore(false)
        }
      }
    },
    [url]
  )

  useEffect(() => {
    requestRef.current += 1
    setItems([])
    setHasMore(false)
    setError(null)

    if (enabled && url) {
      void load(1, false)
    }
  }, [url, enabled, load])

  const loadMore = useCallback(() => {
    if (isLoading || isLoadingMore || !hasMore) return

    void load(items.length + 1, true)
  }, [hasMore, isLoading, isLoadingMore, items.length, load])

  /** Busca as páginas restantes e devolve a lista completa (com teto). */
  const loadAll = useCallback(
    async (maxItems = 200): Promise<PlaylistItem[]> => {
      if (!url) return []

      let result = [...items]
      let more = hasMore

      while (more && result.length < maxItems) {
        const page = await platform.getPlaylistInfo(url, {
          start: result.length + 1,
          pageSize: 50
        })

        if (!page.success) break

        const pageItems = page.items ?? []
        if (pageItems.length === 0) break

        result = [...result, ...pageItems]
        more = Boolean(page.hasMore)
      }

      return result.slice(0, maxItems)
    },
    [url, items, hasMore]
  )

  const reset = useCallback(() => {
    requestRef.current += 1
    setItems([])
    setHasMore(false)
    setError(null)
  }, [])

  return { items, hasMore, isLoading, isLoadingMore, error, loadMore, loadAll, reset }
}
