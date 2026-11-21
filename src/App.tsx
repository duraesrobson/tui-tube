import { useEffect, useMemo, useState } from 'react'
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
  EngineUpdate,
  PlaylistPicker
} from './components'
import { useVideo } from './hooks/useVideo'
import { useDownloads } from './hooks/useDownloads'
import { usePlaylist } from './hooks/usePlaylist'
import { platform } from './lib/platform'
import { normalizeLink, parseLink } from './lib/youtubeUrl'
import type { QualityMap } from './types'

const MP3_QUALITIES: QualityMap['mp3'] = [
  { value: '0', label: 'Melhor' },
  { value: '320', label: '320 kbps' },
  { value: '256', label: '256 kbps' },
  { value: '192', label: '192 kbps' },
  { value: '128', label: '128 kbps' },
  { value: '96', label: '96 kbps' }
]

/** Usado quando o yt-dlp não devolve a lista de formatos. */
const MP4_FALLBACK: QualityMap['mp4'] = [
  { value: 'bestvideo+bestaudio/best', label: 'Melhor' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: '360p', label: '360p' }
]

function App() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3')
  const [quality, setQuality] = useState('0')
  const [outputFolder, setOutputFolder] = useState('')
  const [downloadPlaylist, setDownloadPlaylist] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())

  const { videoInfo, isLoading, error, fetchVideoInfo } = useVideo(url)

  const link = useMemo(() => parseLink(url), [url])
  const playlistUrl = link && (link.kind === 'playlist' || link.playlistId) ? link.url : null
  const playlist = usePlaylist(playlistUrl, downloadPlaylist)

  useEffect(() => {
    setSelectedItems(new Set())
  }, [playlistUrl])

  const qualities = useMemo<QualityMap>(() => {
    const formats = videoInfo?.formats ?? []

    return {
      mp3: MP3_QUALITIES,
      mp4:
        formats.length > 0
          ? [
              { value: 'bestvideo+bestaudio/best', label: 'Melhor' },
              ...formats.map((format) => ({ value: format.selector, label: format.label }))
            ]
          : MP4_FALLBACK
    }
  }, [videoInfo])

  const {
    downloads,
    atCapacity,
    currentDownload,
    startDownload,
    retryDownload,
    cancelDownload,
    openDownload,
    removeDownload
  } = useDownloads()

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

  // Mantém a qualidade selecionada válida quando os formatos chegam.
  useEffect(() => {
    const options = qualities[format]

    if (!options.some((option) => option.value === quality)) {
      setQuality(options[0]?.value ?? '')
    }
  }, [qualities, format, quality])

  const handleFormatChange = (nextFormat: 'mp3' | 'mp4') => {
    setFormat(nextFormat)
    setQuality((nextFormat === 'mp3' ? qualities.mp3 : qualities.mp4)[0]?.value ?? '')
  }

  const handlePaste = async () => {
    const text = await platform.readClipboard()
    if (!text.trim()) return

    setUrl(parseLink(text)?.url ?? text.trim())
  }

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

  const canDownload = Boolean(url.trim()) &&
    (Boolean(videoInfo) || (downloadPlaylist && playlist.items.length > 0))

  const selectedParam = useMemo(
    () => [...selectedItems].sort((a, b) => a - b).join(','),
    [selectedItems]
  )

  const toggleItem = (index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev)
      next.has(index) ? next.delete(index) : next.add(index)
      return next
    })
  }

  const handleStartDownload = () => {
    if (!canDownload) return

    void startDownload({
      url: normalizeLink(url) ?? url,
      title: videoInfo?.title || (downloadPlaylist ? 'Playlist' : 'Video'),
      format,
      quality,
      outputFolder,
      playlist: downloadPlaylist,
      playlistItems: downloadPlaylist ? selectedParam : undefined
    })
  }

  return (
    <div className="container">
      {platform.name === 'electron' && <TitleBar />}
      <Header />

      <section className="input-section">
        <UrlInput
          value={url}
          onChange={setUrl}
          onFetchInfo={() => fetchVideoInfo(url)}
          onPaste={handlePaste}
          isLoading={isLoading}
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

        {downloadPlaylist && playlistUrl && (
          <PlaylistPicker
            items={playlist.items}
            selected={selectedItems}
            hasMore={playlist.hasMore}
            isLoading={playlist.isLoading}
            isLoadingMore={playlist.isLoadingMore}
            error={playlist.error}
            onToggle={toggleItem}
            onLoadMore={playlist.loadMore}
          />
        )}

        {error && <ErrorMessage message={error} />}

        <OptionsGrid
          format={format}
          quality={quality}
          outputFolder={outputFolder}
          qualities={qualities}
          canSelectFolder={platform.canSelectFolder}
          onFormatChange={handleFormatChange}
          onQualityChange={setQuality}
          onSelectFolder={handleSelectFolder}
          onOpenFolder={handleOpenFolder}
        />

        <DownloadButton
          format={format}
          isLoading={false}
          disabled={!canDownload || atCapacity}
          onClick={handleStartDownload}
        />
      </section>

      {currentDownload && (
        <DownloadProgress download={currentDownload} />
      )}

      <DownloadsList
        downloads={downloads}
        onCancel={cancelDownload}
        onRetry={retryDownload}
        onOpen={openDownload}
        onRemove={removeDownload}
      />

      {platform.supportsEngineUpdate && <EngineUpdate />}
    </div>
  )
}

export default App
