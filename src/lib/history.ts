import type { DownloadItem } from '../types'
import { platform } from './platform'

const STORAGE_KEY = 'tui-tube.history.v1'
const MAX_ITEMS = 100

const FINISHED_STATUSES: DownloadItem['status'][] = ['completed', 'cancelled', 'error']

interface StoredHistory {
  platform: string
  items: DownloadItem[]
}

const isFinished = (item: DownloadItem) => FINISHED_STATUSES.includes(item.status)

/** Histórico só de itens encerrados; downloads em andamento não sobrevivem ao restart. */
export const loadHistory = (): DownloadItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as StoredHistory

    if (!parsed || parsed.platform !== platform.name || !Array.isArray(parsed.items)) {
      return []
    }

    return parsed.items.filter(isFinished).slice(-MAX_ITEMS)
  } catch {
    return []
  }
}

export const saveHistory = (items: DownloadItem[]): void => {
  try {
    const finished = items.filter(isFinished).slice(-MAX_ITEMS)

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ platform: platform.name, items: finished } satisfies StoredHistory)
    )
  } catch {
    // Storage indisponível (modo privado): o app continua funcionando sem histórico.
  }
}
