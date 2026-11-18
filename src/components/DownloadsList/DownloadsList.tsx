import type { DownloadItem } from '../../types'
import './DownloadsList.scss'

interface DownloadsListProps {
  downloads: DownloadItem[]
}

export const DownloadsList = ({ downloads }: DownloadsListProps) => {
  if (downloads.length === 0) {
    return (
      <section className="downloads-list">
        <div className="empty-state">
          <span className="icon">↓</span>
          <p>Nenhum download ainda</p>
        </div>
      </section>
    )
  }

  return (
    <section className="downloads-list">
      {downloads.slice().reverse().map(item => (
        <div key={item.id} className="download-item">
          <div className="icon">
            {item.format === 'mp3' ? '♫' : '▶'}
          </div>
          <div className="info">
            <div className="title">{item.title}</div>
            <div className="meta">{item.format.toUpperCase()}</div>
          </div>
          <span className={`status ${item.status}`}>
            {item.status === 'queued' && 'Aguardando'}
            {item.status === 'downloading' && 'Baixando'}
            {item.status === 'completed' && 'Concluído'}
            {item.status === 'error' && 'Erro'}
          </span>
        </div>
      ))}
    </section>
  )
}