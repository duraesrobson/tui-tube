import type { DownloadItem } from '../../types'
import './DownloadProgress.scss'

interface DownloadProgressProps {
  download: DownloadItem
}

export const DownloadProgress = ({ download }: DownloadProgressProps) => {
  return (
    <section className="download-progress">
      <div className="progress-header">
        <span className="status">
          {download.status === 'converting' ? 'Convertendo' : 'Baixando'}: {download.title}
        </span>
        {download.status !== 'converting' && (
          <span className="percentage">{download.progress.toFixed(1)}%</span>
        )}
      </div>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${download.progress}%` }}
        />
      </div>
    </section>
  )
}