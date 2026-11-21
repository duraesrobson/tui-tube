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
  VideoInfo,
  VideoInfoResult
} from './platform'

export interface DownloadItem {
  id: string
  url: string
  title: string
  format: 'mp3' | 'mp4'
  status: 'queued' | 'downloading' | 'converting' | 'completed' | 'cancelled' | 'error'
  progress: number
  error?: string
  files?: DownloadFile[]
}

export interface QualityOption {
  value: string
  label: string
}

export interface QualityMap {
  mp3: QualityOption[]
  mp4: QualityOption[]
}
