import { contextBridge, ipcRenderer } from 'electron'

export interface DownloadOptions {
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
}

export interface VideoInfo {
  title?: string
  uploader?: string
  duration?: number
  thumbnail?: string
}

const api = {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getDefaultDownloadPath: () => ipcRenderer.invoke('get-default-download-path'),
  downloadVideo: (url: string, options: DownloadOptions) =>
    ipcRenderer.invoke('download-video', url, options),
  downloadPlaylist: (url: string, options: DownloadOptions) =>
    ipcRenderer.invoke('download-playlist', url, options),
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  onDownloadProgress: (callback: (data: { url: string; output: string; isPlaylist?: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { url: string; output: string; isPlaylist?: boolean }) =>
      callback(data)

    ipcRenderer.on('download-progress', listener)

    // Permite que a UI remova o listener (evita duplicidade no StrictMode).
    return () => ipcRenderer.removeListener('download-progress', listener)
  },
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close')
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
