import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import log from 'electron-log'
import { existsSync, mkdirSync } from 'fs'

log.initialize()
log.info('tui-tube starting...')

process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error)
  app.exit(1)
})

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason)
})

let mainWindow: BrowserWindow | null = null

const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged

const getYtDlpPath = () => {
  const localPath = isDev
    ? join(__dirname, '../bin/yt-dlp')
    : join(process.resourcesPath, 'yt-dlp')

  if (existsSync(localPath)) {
    return localPath
  }

  log.warn('yt-dlp not found at', localPath, '- using system yt-dlp')
  return 'yt-dlp'
}

const createYtDlpSpawn = (args: string[], cwd: string) => {
  const ytDlpPath = getYtDlpPath()
  log.info('Spawning yt-dlp at:', ytDlpPath, 'with args:', args)

  const extraArgs = [
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--no-check-certificates',
    '--extractor-retries', '5',
    '--fragment-retries', '5',
    '--no-warnings',
    '--extractor-args', 'youtube:player_client=android'
  ]

  return spawn(ytDlpPath, [...extraArgs, ...args], {
    shell: process.platform === 'win32',
    cwd
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0d0d0d',
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    log.info('Window ready to show')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  const userDataPath = app.getPath('userData')
  const downloadsPath = join(userDataPath, 'downloads')
  if (!existsSync(downloadsPath)) {
    mkdirSync(downloadsPath, { recursive: true })
  }
  log.info('Downloads path:', downloadsPath)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  })
  return result.filePaths[0] || null
})

ipcMain.handle('get-default-download-path', () => {
  return join(app.getPath('userData'), 'downloads')
})

ipcMain.handle('download-video', async (_event, url: string, options: {
  id: string
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
}) => {
  return new Promise((resolve) => {
    const { id, format, quality, outputFolder } = options

    const args = [
      url,
      '-o', join(outputFolder, '%(title)s.%(ext)s'),
      '--no-playlist'
    ]

    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', quality)
    } else {
      const formatArg = quality || 'bestvideo+bestaudio/best'
      args.push('-f', `${formatArg}/best`)
    }

    args.push('--progress')

    const ytdlp = createYtDlpSpawn(args, outputFolder)

    let progressData = ''

    ytdlp.stdout.on('data', (data) => {
      progressData += data.toString()
      mainWindow?.webContents.send('download-progress', {
        id,
        url,
        output: data.toString()
      })
    })

    ytdlp.stderr.on('data', (data) => {
      log.info('yt-dlp stderr:', data.toString())
    })

    ytdlp.on('close', (code) => {
      log.info('yt-dlp close:', code)
      resolve({ success: code === 0, url, id })
    })

    ytdlp.on('error', (err) => {
      log.error('yt-dlp error:', err)
      resolve({ success: false, url, id, error: err.message })
    })
  })
})

ipcMain.handle('download-playlist', async (_event, url: string, options: {
  id: string
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
}) => {
  return new Promise((resolve) => {
    const { id, format, quality, outputFolder } = options

    const args = [
      url,
      '-o', join(outputFolder, '%(playlist_index)s - %(title)s.%(ext)s'),
      '--yes-playlist'
    ]

    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', quality)
    } else {
      const formatArg = quality || 'bestvideo+bestaudio/best'
      args.push('-f', `${formatArg}/best`)
    }

    args.push('--progress')

    const ytdlp = createYtDlpSpawn(args, outputFolder)

    ytdlp.stdout.on('data', (data) => {
      mainWindow?.webContents.send('download-progress', {
        id,
        url,
        output: data.toString(),
        isPlaylist: true
      })
    })

    ytdlp.on('close', (code) => {
      resolve({ success: code === 0, url, id })
    })

    ytdlp.on('error', (err) => {
      resolve({ success: false, url, id, error: err.message })
    })
  })
})

ipcMain.handle('get-video-info', async (_event, url: string) => {
  log.info('get-video-info called, url:', url)
  const ytDlpPath = getYtDlpPath()
  log.info('yt-dlp path:', ytDlpPath)
  log.info('yt-dlp exists:', existsSync(ytDlpPath))

  return new Promise((resolve) => {
    const ytdlp = createYtDlpSpawn([
      url,
      '--dump-json',
      '--no-playlist'
    ], process.cwd())

    let data = ''

    ytdlp.stdout.on('data', (chunk) => {
      data += chunk.toString()
    })

    ytdlp.stderr.on('data', (chunk) => {
      log.info('yt-dlp stderr:', chunk.toString())
    })

    ytdlp.on('close', () => {
      try {
        const info = JSON.parse(data)
        resolve({ success: true, info })
      } catch {
        resolve({ success: false, error: 'Failed to parse video info' })
      }
    })

    ytdlp.on('error', (err) => {
      resolve({ success: false, error: err.message })
    })
  })
})

ipcMain.handle('open-folder', (_event, path: string) => {
  shell.openPath(path)
})

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window-close', () => {
  mainWindow?.close()
})
