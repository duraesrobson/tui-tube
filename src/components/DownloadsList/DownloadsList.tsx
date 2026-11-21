import type { DownloadItem } from '../../types'
import './DownloadsList.scss'

interface DownloadsListProps {
  downloads: DownloadItem[]
  onCancel: (id: string) => void
  onOpen: (item: DownloadItem) => void
  onRemove: (item: DownloadItem) => void
  onRetry: (item: DownloadItem) => void
}

const isActive = (status: DownloadItem['status']) =>
  status === 'queued' || status === 'downloading' || status === 'converting'

const canOpen = (item: DownloadItem) =>
  item.status === 'completed' && (item.files?.length ?? 0) > 0

const STATUS_LABEL: Record<DownloadItem['status'], string> = {
  queued: 'Aguardando',
  downloading: 'Baixando',
  converting: 'Convertendo',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  error: 'Erro'
}

export const DownloadsList = ({
  downloads,
  onCancel,
  onOpen,
  onRemove,
  onRetry
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

  const active = downloads.filter((item) => isActive(item.status))
  const finished = downloads.filter((item) => !isActive(item.status))

  const renderItem = (item: DownloadItem) => {
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
        <div className="icon">{item.format === 'mp3' ? '♫' : '▶'}</div>
        <div className="info">
          <div className="title">{item.title}</div>
          <div className="meta">{item.error ?? item.format.toUpperCase()}</div>
        </div>
        <span className={`status ${item.status}`}>{STATUS_LABEL[item.status]}</span>

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

        {(item.status === 'error' || item.status === 'cancelled') && item.request && (
          <button
            type="button"
            className="item-action retry"
            onClick={(event) => {
              event.stopPropagation()
              onRetry(item)
            }}
          >
            Tentar
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
  }

  return (
    <section className="downloads-list">
      {active.length > 0 && (
        <div className="downloads-section">
          <h2 className="section-title">Em andamento</h2>
          {active.slice().reverse().map(renderItem)}
        </div>
      )}

      {finished.length > 0 && (
        <div className="downloads-section">
          <h2 className="section-title">Concluídos</h2>
          {finished.slice().reverse().map(renderItem)}
        </div>
      )}
    </section>
  )
}
