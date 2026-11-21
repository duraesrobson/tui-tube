import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import type {
  DownloadFormat,
  DownloadProgressEvent,
  DownloadResult,
  EngineUpdateResult,
  PlatformAPI,
  VideoInfoResult
} from '../types/platform'

/** Rótulo exibido na UI; o arquivo real é gravado via MediaStore. */
export const ANDROID_DESTINATION_LABEL = 'Downloads/tui-tube'

interface ShareEvent {
  url: string
}

interface TuiTubeDownloaderPlugin {
  getVideoInfo(options: { url: string }): Promise<VideoInfoResult>
  download(options: {
    id: string
    url: string
    format: DownloadFormat
    quality: string
    playlist: boolean
  }): Promise<DownloadResult>
  cancel(options?: { id?: string }): Promise<void>
  updateEngine(): Promise<EngineUpdateResult>
  openDownloads(): Promise<void>
  getSharedLink(): Promise<{ url: string }>
  addListener(
    eventName: 'downloadProgress',
    listener: (event: DownloadProgressEvent) => void
  ): Promise<PluginListenerHandle>
  addListener(
    eventName: 'shareReceived',
    listener: (event: ShareEvent) => void
  ): Promise<PluginListenerHandle>
}

const Downloader = registerPlugin<TuiTubeDownloaderPlugin>('TuiTubeDownloader')

export const isAndroidNative = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

const noop = async () => {}

/**
 * Assina um evento do plugin aceitando desmontagem imediata (StrictMode/rotas):
 * se o listener chegar depois do unsubscribe, é removido na hora.
 */
const subscribe = <T>(
  eventName: 'downloadProgress' | 'shareReceived',
  callback: (event: T) => void
): (() => void) => {
  let handle: PluginListenerHandle | null = null
  let disposed = false

  const register = Downloader.addListener as (
    event: string,
    listener: (data: unknown) => void
  ) => Promise<PluginListenerHandle>

  const registration = register(eventName, callback as (data: unknown) => void)

  void registration.then((result) => {
    if (disposed) {
      void result.remove()
      return
    }
    handle = result
  })

  return () => {
    disposed = true
    void handle?.remove()
  }
}

export const androidPlatform: PlatformAPI = {
  name: 'android',
  canSelectFolder: false,
  supportsEngineUpdate: true,
  getDefaultDownloadPath: async () => ANDROID_DESTINATION_LABEL,
  selectFolder: async () => null,
  getVideoInfo: (url) => Downloader.getVideoInfo({ url }),
  downloadVideo: (url, options) =>
    Downloader.download({
      id: options.id,
      url,
      format: options.format,
      quality: options.quality,
      playlist: false
    }),
  downloadPlaylist: (url, options) =>
    Downloader.download({
      id: options.id,
      url,
      format: options.format,
      quality: options.quality,
      playlist: true
    }),
  cancelDownload: async (id) => {
    await Downloader.cancel({ id })
  },
  openFolder: () => Downloader.openDownloads(),
  onDownloadProgress: (callback) => subscribe<DownloadProgressEvent>('downloadProgress', callback),
  updateEngine: () => Downloader.updateEngine(),
  consumeSharedLink: async () => {
    try {
      const { url } = await Downloader.getSharedLink()
      const value = url?.trim()

      return value ? value : null
    } catch {
      return null
    }
  },
  onSharedLink: (callback) => subscribe<ShareEvent>('shareReceived', (event) => callback(event.url)),
  windowMinimize: noop,
  windowMaximize: noop,
  windowClose: noop
}
