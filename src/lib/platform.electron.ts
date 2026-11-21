import type { ElectronBridge, PlatformAPI } from '../types/platform'

/**
 * Adapta a API do preload do Electron ao contrato PlatformAPI.
 * Recebe o bridge por parâmetro para nunca acessar `window.electronAPI`
 * em tempo de módulo (o bundle também roda no Android).
 */
export const createElectronPlatform = (bridge: ElectronBridge): PlatformAPI => ({
  name: 'electron',
  canSelectFolder: true,
  supportsEngineUpdate: false,
  getDefaultDownloadPath: () => bridge.getDefaultDownloadPath(),
  selectFolder: () => bridge.selectFolder(),
  getVideoInfo: (url) => bridge.getVideoInfo(url),
  downloadVideo: (url, options) => bridge.downloadVideo(url, options),
  downloadPlaylist: (url, options) => bridge.downloadPlaylist(url, options),
  cancelDownload: (id) => bridge.cancelDownload(id),
  openFolder: (path) => bridge.openFolder(path),
  onDownloadProgress: (callback) => bridge.onDownloadProgress(callback),
  windowMinimize: () => bridge.windowMinimize(),
  windowMaximize: () => bridge.windowMaximize(),
  windowClose: () => bridge.windowClose()
})
