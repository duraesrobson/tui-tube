export type DownloadFormat = 'mp3' | 'mp4'
export type PlatformName = 'electron' | 'android' | 'web'

export interface DownloadOptions {
  /** Identificador único do job, gerado na UI e usado em todos os eventos. */
  id: string
  format: DownloadFormat
  quality: string
  outputFolder: string
}

export interface VideoInfo {
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
}

export interface VideoInfoResult {
  success: boolean
  info?: VideoInfo
  error?: string
}

export interface DownloadResult {
  success: boolean
  url: string
  id?: string
  error?: string
  /** true quando o job foi interrompido pelo usuário. */
  cancelled?: boolean
  /**
   * true quando o download foi apenas iniciado (Android: serviço em background).
   * A conclusão chega depois pelo evento de progresso.
   */
  started?: boolean
}

export interface DownloadProgressEvent {
  id: string
  url: string
  /** Linha crua do yt-dlp (usada para extrair progresso no desktop). */
  output?: string
  /** Progresso já calculado pela plataforma, em porcentagem (0-100). */
  progress?: number
  isPlaylist?: boolean
  /** Estado final reportado pelo backend Android. */
  status?: 'downloading' | 'converting' | 'completed' | 'cancelled' | 'error'
  error?: string
}

export interface EngineUpdateResult {
  success: boolean
  version?: string
  error?: string
}

/**
 * Contrato único consumido pela UI. Cada plataforma (Electron, Android, web)
 * fornece uma implementação, mantendo os componentes agnósticos.
 */
export interface PlatformAPI {
  readonly name: PlatformName
  readonly canSelectFolder: boolean
  readonly supportsEngineUpdate: boolean
  getDefaultDownloadPath(): Promise<string>
  selectFolder(): Promise<string | null>
  getVideoInfo(url: string): Promise<VideoInfoResult>
  downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult>
  downloadPlaylist(url: string, options: DownloadOptions): Promise<DownloadResult>
  cancelDownload(id: string): Promise<void>
  openFolder(path: string): Promise<void>
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): () => void
  updateEngine?(): Promise<EngineUpdateResult>
  /** Link recebido pelo "Compartilhar" do Android antes da UI montar. */
  consumeSharedLink?(): Promise<string | null>
  /** Link recebido enquanto o app já está aberto. */
  onSharedLink?(callback: (url: string) => void): () => void
  windowMinimize(): Promise<void>
  windowMaximize(): Promise<void>
  windowClose(): Promise<void>
}

/** API exposta pelo preload do Electron em `window.electronAPI`. */
export interface ElectronBridge {
  selectFolder(): Promise<string | null>
  getDefaultDownloadPath(): Promise<string>
  downloadVideo(url: string, options: DownloadOptions): Promise<DownloadResult>
  downloadPlaylist(url: string, options: DownloadOptions): Promise<DownloadResult>
  cancelDownload(id: string): Promise<void>
  getVideoInfo(url: string): Promise<VideoInfoResult>
  openFolder(path: string): Promise<void>
  onDownloadProgress(callback: (event: DownloadProgressEvent) => void): () => void
  windowMinimize(): Promise<void>
  windowMaximize(): Promise<void>
  windowClose(): Promise<void>
}
