import { contextBridge, ipcRenderer } from 'electron'

export interface DownloadOptions {
  id: string
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
  playlistItems?: string
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
  cancelDownload: (id: string) => ipcRenderer.invoke('cancel-download', id),
  openFile: (file: { uri: string }) => ipcRenderer.invoke('open-file', file.uri),
  deleteFile: (file: { uri: string }) => ipcRenderer.invoke('delete-file', file.uri),
  getVideoInfo: (url: string) => ipcRenderer.invoke('get-video-info', url),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  getPlaylistInfo: (url: string, options?: { start?: number; pageSize?: number }) =>
    ipcRenderer.invoke('get-playlist-info', url, options),
  openFolder: (path: string) => ipcRenderer.invoke('open-folder', path),
  onDownloadProgress: (callback: (data: { id: string; url: string; output: string; isPlaylist?: boolean }) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { id: string; url: string; output: string; isPlaylist?: boolean }
    ) => callback(data)

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
