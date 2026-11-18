import type { PlatformAPI } from '../types/platform'

const unsupported = {
  success: false,
  url: '',
  error: 'Download disponível apenas no app desktop ou Android.'
}

/**
 * Fallback para quando a UI roda no navegador (npm run dev sem Electron).
 * Mantém os componentes funcionais sem quebrar em tempo de execução.
 */
export const createWebPlatform = (): PlatformAPI => ({
  name: 'web',
  canSelectFolder: false,
  supportsEngineUpdate: false,
  getDefaultDownloadPath: async () => 'downloads',
  selectFolder: async () => null,
  getVideoInfo: async () => ({
    success: false,
    error: 'Abra o app desktop ou Android para buscar vídeos.'
  }),
  downloadVideo: async (url) => ({ ...unsupported, url }),
  downloadPlaylist: async (url) => ({ ...unsupported, url }),
  openFolder: async () => {},
  onDownloadProgress: () => () => {},
  windowMinimize: async () => {},
  windowMaximize: async () => {},
  windowClose: async () => {}
})
