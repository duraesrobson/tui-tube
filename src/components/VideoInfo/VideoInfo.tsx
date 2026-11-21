import type { VideoInfo as VideoInfoType } from '../../types'
import './VideoInfo.scss'

interface VideoInfoProps {
  videoInfo: VideoInfoType
  downloadPlaylist: boolean
  onDownloadPlaylistChange: (checked: boolean) => void
}

export const VideoInfo = ({
  videoInfo,
  downloadPlaylist,
  onDownloadPlaylistChange
}: VideoInfoProps) => {
  return (
    <>
      <div className="video-info">
        {videoInfo.thumbnail && (
          <img
            className="video-thumb"
            src={videoInfo.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        )}
        <div className="video-meta">
          <span className="uploader">{videoInfo.uploader}</span>
          <span className="title">{videoInfo.title}</span>
        </div>
      </div>

      <label className="playlist-toggle">
        <input
          type="checkbox"
          checked={downloadPlaylist}
          onChange={(e) => onDownloadPlaylistChange(e.target.checked)}
        />
        <span>Baixar playlist completa</span>
      </label>
    </>
  )
}
