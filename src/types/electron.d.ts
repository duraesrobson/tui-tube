import type { ElectronBridge } from './platform'

declare global {
  interface Window {
    /** Definido apenas no Electron (preload). Ausente no navegador/Android. */
    electronAPI?: ElectronBridge
  }
}

export {}
