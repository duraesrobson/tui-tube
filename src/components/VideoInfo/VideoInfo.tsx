import type { VideoInfo as VideoInfoType } from '../../types'
import './VideoInfo.scss'

interface VideoInfoProps {
  videoInfo: VideoInfoType
  downloadPlaylist: boolean
  playlistItems: string
  onDownloadPlaylistChange: (checked: boolean) => void
  onPlaylistItemsChange: (value: string) => void
}

export const VideoInfo = ({
  videoInfo,
  downloadPlaylist,
  playlistItems,
  onDownloadPlaylistChange,
  onPlaylistItemsChange
}: VideoInfoProps) => {
  return (
    <>
      <div className="video-info">
        <span className="uploader">{videoInfo.uploader}</span>
        <span className="title">{videoInfo.title}</span>
      </div>
      <label className="playlist-toggle">
        <input
          type="checkbox"
          checked={downloadPlaylist}
          onChange={(e) => onDownloadPlaylistChange(e.target.checked)}
        />
        <span>Baixar playlist completa</span>
      </label>

      {downloadPlaylist && (
        <input
          className="playlist-range"
          type="text"
          inputMode="numeric"
          placeholder="Itens (ex: 1-5, 8) — vazio baixa todos"
          value={playlistItems}
          onChange={(e) => onPlaylistItemsChange(e.target.value.replace(/[^0-9,\-:\s]/g, ''))}
        />
      )}
    </>
  )
}
