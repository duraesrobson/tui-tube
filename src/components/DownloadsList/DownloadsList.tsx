import type { DownloadItem } from '../../types'
import './DownloadsList.scss'

interface DownloadsListProps {
  downloads: DownloadItem[]
  onCancel: (id: string) => void
  onOpen: (item: DownloadItem) => void
  onRemove: (item: DownloadItem) => void
}

const isActive = (status: DownloadItem['status']) =>
  status === 'queued' || status === 'downloading' || status === 'converting'

const canOpen = (item: DownloadItem) =>
  item.status === 'completed' && (item.files?.length ?? 0) > 0

export const DownloadsList = ({
  downloads,
  onCancel,
  onOpen,
  onRemove
}: DownloadsListProps) => {
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
      {downloads.slice().reverse().map(item => {
        const openable = canOpen(item)

        return (
          <div
            key={item.id}
            className={`download-item ${openable ? 'clickable' : ''}`}
            role={openable ? 'button' : undefined}
            tabIndex={openable ? 0 : undefined}
            title={openable ? 'Abrir arquivo' : undefined}
            onClick={openable ? () => onOpen(item) : undefined}
            onKeyDown={
              openable
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onOpen(item)
                    }
                  }
                : undefined
            }
          >
            <div className="icon">
              {item.format === 'mp3' ? '♫' : '▶'}
            </div>
            <div className="info">
              <div className="title">{item.title}</div>
              <div className="meta">{item.error ?? item.format.toUpperCase()}</div>
            </div>
            <span className={`status ${item.status}`}>
              {item.status === 'queued' && 'Aguardando'}
              {item.status === 'downloading' && 'Baixando'}
              {item.status === 'converting' && 'Convertendo'}
              {item.status === 'completed' && 'Concluído'}
              {item.status === 'cancelled' && 'Cancelado'}
              {item.status === 'error' && 'Erro'}
            </span>
            {isActive(item.status) && (
              <button
                type="button"
                className="item-action cancel"
                onClick={(event) => {
                  event.stopPropagation()
                  onCancel(item.id)
                }}
              >
                Cancelar
              </button>
            )}
            {!isActive(item.status) && (
              <button
                type="button"
                className="item-action remove"
                onClick={(event) => {
                  event.stopPropagation()
                  onRemove(item)
                }}
              >
                Remover
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
