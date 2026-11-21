import { useState, useEffect } from 'react'
import './styles/main.scss'
import {
  Header,
  TitleBar,
  UrlInput,
  VideoInfo,
  OptionsGrid,
  DownloadButton,
  DownloadProgress,
  DownloadsList,
  ErrorMessage,
  LoadingIndicator,
  EngineUpdate
} from './components'
import { useVideo } from './hooks/useVideo'
import { platform } from './lib/platform'
import { applyProgressToAll } from './lib/downloadProgress'
import type { DownloadItem, QualityMap } from './types'

const qualities: QualityMap = {
  mp3: [
    { value: '0', label: 'Melhor' },
    { value: '320', label: '320 kbps' },
    { value: '256', label: '256 kbps' },
    { value: '192', label: '192 kbps' },
    { value: '128', label: '128 kbps' },
    { value: '96', label: '96 kbps' },
  ],
  mp4: [
    { value: 'bestvideo+bestaudio/best', label: 'Melhor' },
    { value: '1080p', label: '1080p' },
    { value: '720p', label: '720p' },
    { value: '480p', label: '480p' },
    { value: '360p', label: '360p' },
  ]
}

function App() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3')
  const [quality, setQuality] = useState('0')
  const [outputFolder, setOutputFolder] = useState('')
  const [downloadPlaylist, setDownloadPlaylist] = useState(false)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])

  const { videoInfo, isLoading, error, fetchVideoInfo } = useVideo(url)

  useEffect(() => {
    let active = true

    platform
      .getDefaultDownloadPath()
      .then((path) => {
        if (active) setOutputFolder(path)
      })
      .catch(() => {
        // Sem destino definido: a UI mostra o campo vazio e o backend usa o padrão.
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    const applySharedLink = (sharedUrl: string | null) => {
      if (!active || !sharedUrl) return
      setUrl(sharedUrl)
    }

    platform
      .consumeSharedLink?.()
      .then(applySharedLink)
      .catch(() => {
        // Sem link compartilhado: fluxo normal.
      })

    const unsubscribe = platform.onSharedLink?.(applySharedLink)

    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const unsubscribe = platform.onDownloadProgress((event) => {
      setDownloads((prev) => applyProgressToAll(prev, event))
    })

    return unsubscribe
  }, [])

  const handleSelectFolder = async () => {
    if (!platform.canSelectFolder) return

    const folder = await platform.selectFolder()
    if (folder) {
      setOutputFolder(folder)
    }
  }

  const handleOpenFolder = () => {
    if (outputFolder) {
      void platform.openFolder(outputFolder)
    }
  }

  const isDownloading = downloads.some(
    (item) =>
      item.status === 'downloading' || item.status === 'converting' || item.status === 'queued'
  )

  const handleStartDownload = async () => {
    if (!url.trim() || !videoInfo) return

    const id = crypto.randomUUID()
    const title = videoInfo.title || 'Video'

    const newItem: DownloadItem = {
      id,
      url,
      title,
      format,
      status: 'queued',
      progress: 0
    }

    setDownloads((prev) => [...prev, newItem])

    try {
      setDownloads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'downloading' } : item))
      )

      const options = { id, format, quality, outputFolder }
      const downloadFn = downloadPlaylist ? platform.downloadPlaylist : platform.downloadVideo
      const result = await downloadFn(url, options)

      // Android inicia o job em background: a conclusão chega pelo evento de progresso.
      if (result.started) return

      setDownloads((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                status: result.success ? 'completed' : 'error',
                progress: result.success ? 100 : item.progress,
                error: result.error
              }
            : item
        )
      )
    } catch {
      setDownloads((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: 'error', error: 'Erro ao iniciar o download' }
            : item
        )
      )
    }
  }

  const currentDownload = downloads.find(
    (d) => d.status === 'downloading' || d.status === 'converting'
  )

  return (
    <div className="container">
      {platform.name === 'electron' && <TitleBar />}
      <Header />

      <section className="input-section">
        <UrlInput
          value={url}
          onChange={setUrl}
          onFetchInfo={() => fetchVideoInfo(url)}
          isLoading={isLoading || isDownloading}
          disabled={!url.trim()}
        />

        {isLoading && !videoInfo && <LoadingIndicator />}

        {videoInfo && (
          <VideoInfo
            videoInfo={videoInfo}
            downloadPlaylist={downloadPlaylist}
            onDownloadPlaylistChange={setDownloadPlaylist}
          />
        )}

        {error && <ErrorMessage message={error} />}

        <OptionsGrid
          format={format}
          quality={quality}
          outputFolder={outputFolder}
          qualities={qualities}
          canSelectFolder={platform.canSelectFolder}
          onFormatChange={setFormat}
          onQualityChange={setQuality}
          onSelectFolder={handleSelectFolder}
          onOpenFolder={handleOpenFolder}
        />

        <DownloadButton
          format={format}
          isLoading={isDownloading}
          disabled={!url.trim() || !videoInfo}
          onClick={handleStartDownload}
        />
      </section>

      {currentDownload && (
        <DownloadProgress download={currentDownload} />
      )}

      <DownloadsList downloads={downloads} />

      {platform.supportsEngineUpdate && <EngineUpdate />}
    </div>
  )
}

export default App
