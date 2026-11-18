import type { PlatformAPI } from '../types/platform'
import { createElectronPlatform } from './platform.electron'
import { androidPlatform, isAndroidNative } from './platform.android'
import { createWebPlatform } from './platform.web'

const resolvePlatform = (): PlatformAPI => {
  // Electron roda com contextIsolation: o bridge só existe se o preload rodou.
  if (typeof window !== 'undefined' && window.electronAPI) {
    return createElectronPlatform(window.electronAPI)
  }

  if (isAndroidNative()) {
    return androidPlatform
  }

  return createWebPlatform()
}

/** Instância única resolvida no boot do renderer. */
export const platform: PlatformAPI = resolvePlatform()

export const isElectron = platform.name === 'electron'
export const isAndroid = platform.name === 'android'
