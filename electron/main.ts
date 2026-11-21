import { app, BrowserWindow, clipboard, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { spawn, type ChildProcess } from 'child_process'
import log from 'electron-log'
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs'
import { basename } from 'path'

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

/** Jobs em andamento, indexados pelo id gerado na UI (permite cancelar). */
const jobs = new Map<string, ChildProcess>()
const cancelledJobs = new Set<string>()
/** Arquivos .part de cada job, usados na limpeza ao cancelar. */
const jobPartials = new Map<string, Set<string>>()
/** Caminhos finais anunciados pelo yt-dlp (--print after_move). */
const jobFiles = new Map<string, Set<string>>()

const FILE_PREFIX = 'tuitube-file:'

type OutputFile = { uri: string; name: string; mime: string; size: number }

const mimeFor = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''

  switch (ext) {
    case 'mp3': return 'audio/mpeg'
    case 'm4a':
    case 'aac': return 'audio/mp4'
    case 'opus':
    case 'ogg': return 'audio/ogg'
    case 'wav': return 'audio/wav'
    case 'flac': return 'audio/flac'
    case 'mp4': return 'video/mp4'
    case 'webm': return 'video/webm'
    case 'mkv': return 'video/x-matroska'
    default: return 'application/octet-stream'
  }
}

const collectFilePaths = (id: string, chunk: string) => {
  const paths = jobFiles.get(id) ?? new Set<string>()

  for (const line of chunk.split(/\r?\n/)) {
    const index = line.indexOf(FILE_PREFIX)
    if (index < 0) continue

    const path = line.slice(index + FILE_PREFIX.length).trim()
    if (path) paths.add(path)
  }

  jobFiles.set(id, paths)
}

const buildFiles = (id: string): OutputFile[] => {
  const paths = jobFiles.get(id)
  if (!paths) return []

  return [...paths].flatMap((path) => {
    try {
      const stats = statSync(path)
      return [{ uri: path, name: basename(path), mime: mimeFor(path), size: stats.size }]
    } catch {
      return []
    }
  })
}

const killProcess = (child: ChildProcess) => {
  if (!child.pid) return

  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
    return
  }

  child.kill('SIGTERM')
}

const trackDestination = (id: string, chunk: string) => {
  const matches = chunk.matchAll(/\[download\] Destination: ([^\r\n]+)/g)

  for (const match of matches) {
    const destination = match[1].trim()
    const partials = jobPartials.get(id) ?? new Set<string>()
    partials.add(`${destination}.part`)
    partials.add(destination)
    jobPartials.set(id, partials)
  }
}

const cleanupPartials = (id: string) => {
  const paths = jobPartials.get(id)
  if (!paths) return

  for (const path of paths) {
    if (!path.endsWith('.part')) continue
    try {
      if (existsSync(path)) unlinkSync(path)
    } catch (error) {
      log.warn('Falha ao remover parcial:', path, error)
    }
  }

  jobPartials.delete(id)
}

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
    '--newline',
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

    const targetFolder = join(outputFolder, format === 'mp3' ? 'Audio' : 'Video')
    if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true })

    const args = [
      url,
      '-o', join(targetFolder, '%(title)s.%(ext)s'),
      '--no-playlist'
    ]

    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', quality)
    } else {
      const formatArg = quality || 'bestvideo+bestaudio/best'
      args.push('-f', `${formatArg}/best`)
    }

    args.push('--progress', '--print', `after_move:${FILE_PREFIX}%(filepath)s`)

    const ytdlp = createYtDlpSpawn(args, targetFolder)
    jobs.set(id, ytdlp)

    let progressData = ''

    ytdlp.stdout.on('data', (data) => {
      const chunk = data.toString()
      progressData += chunk
      trackDestination(id, chunk)
      collectFilePaths(id, chunk)
      mainWindow?.webContents.send('download-progress', {
        id,
        url,
        output: chunk
      })
    })

    ytdlp.stderr.on('data', (data) => {
      log.info('yt-dlp stderr:', data.toString())
    })

    ytdlp.on('close', (code) => {
      log.info('yt-dlp close:', code)
      jobs.delete(id)

      const cancelled = cancelledJobs.delete(id)
      if (cancelled) cleanupPartials(id)

      const files = code === 0 && !cancelled ? buildFiles(id) : []
      jobFiles.delete(id)

      resolve({ success: code === 0 && !cancelled, url, id, cancelled, files })
    })

    ytdlp.on('error', (err) => {
      log.error('yt-dlp error:', err)
      jobs.delete(id)
      cancelledJobs.delete(id)
      jobFiles.delete(id)
      resolve({ success: false, url, id, error: err.message })
    })
  })
})

ipcMain.handle('download-playlist', async (_event, url: string, options: {
  id: string
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
  playlistItems?: string
}) => {
  return new Promise((resolve) => {
    const { id, format, quality, outputFolder, playlistItems } = options

    const targetFolder = join(outputFolder, format === 'mp3' ? 'Audio' : 'Video')
    if (!existsSync(targetFolder)) mkdirSync(targetFolder, { recursive: true })

    const args = [
      url,
      '-o', join(targetFolder, '%(playlist_index)s - %(title)s.%(ext)s'),
      '--yes-playlist'
    ]

    if (format === 'mp3') {
      args.push('-x', '--audio-format', 'mp3', '--audio-quality', quality)
    } else {
      const formatArg = quality || 'bestvideo+bestaudio/best'
      args.push('-f', `${formatArg}/best`)
    }

    args.push('--progress', '--print', `after_move:${FILE_PREFIX}%(filepath)s`)

    if (playlistItems?.trim()) {
      args.push('--playlist-items', playlistItems.trim())
    }

    const ytdlp = createYtDlpSpawn(args, targetFolder)
    jobs.set(id, ytdlp)

    ytdlp.stdout.on('data', (data) => {
      const chunk = data.toString()
      trackDestination(id, chunk)
      collectFilePaths(id, chunk)
      mainWindow?.webContents.send('download-progress', {
        id,
        url,
        output: chunk,
        isPlaylist: true
      })
    })

    ytdlp.on('close', (code) => {
      jobs.delete(id)

      const cancelled = cancelledJobs.delete(id)
      if (cancelled) cleanupPartials(id)

      const files = code === 0 && !cancelled ? buildFiles(id) : []
      jobFiles.delete(id)

      resolve({ success: code === 0 && !cancelled, url, id, cancelled, files })
    })

    ytdlp.on('error', (err) => {
      jobs.delete(id)
      cancelledJobs.delete(id)
      jobFiles.delete(id)
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

ipcMain.handle('cancel-download', (_event, id: string) => {
  const child = jobs.get(id)
  if (!child) return false

  cancelledJobs.add(id)
  killProcess(child)
  return true
})

ipcMain.handle('read-clipboard', () => clipboard.readText())

ipcMain.handle('open-file', async (_event, path: string) => {
  const error = await shell.openPath(path)
  if (error) throw new Error(error)
})

ipcMain.handle('delete-file', async (_event, path: string) => {
  // Idempotente: arquivo já removido por fora não vira erro na UI.
  if (!existsSync(path)) return

  unlinkSync(path)
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
