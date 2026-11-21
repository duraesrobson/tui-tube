import type { DownloadFile } from './platform'

export type {
  DownloadFile,
  DownloadFormat,
  DownloadOptions,
  DownloadProgressEvent,
  DownloadResult,
  EngineUpdateResult,
  PlatformAPI,
  PlatformName,
  VideoFormat,
  VideoInfo,
  VideoInfoResult
} from './platform'

export interface DownloadRequest {
  url: string
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
  playlist: boolean
}

export interface DownloadItem {
  id: string
  url: string
  title: string
  format: 'mp3' | 'mp4'
  status: 'queued' | 'downloading' | 'converting' | 'completed' | 'cancelled' | 'error'
  progress: number
  error?: string
  files?: DownloadFile[]
  /** Parâmetros originais, usados pelo "tentar de novo". */
  request?: DownloadRequest
}

export interface QualityOption {
  value: string
  label: string
}

export interface QualityMap {
  mp3: QualityOption[]
  mp4: QualityOption[]
}
