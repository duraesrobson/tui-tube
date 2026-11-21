import type { PlaylistItem } from '../../types'
import './PlaylistPicker.scss'

interface PlaylistPickerProps {
  items: PlaylistItem[]
  selected: Set<number>
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  onToggle: (index: number) => void
  onLoadMore: () => void
}

export const PlaylistPicker = ({
  items,
  selected,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  onToggle,
  onLoadMore
}: PlaylistPickerProps) => {
  return (
    <section className="playlist-picker">
      <div className="picker-header">
        <span className="picker-title">Itens da playlist</span>
        <span className="picker-hint">Nenhum marcado = playlist inteira</span>
      </div>

      {isLoading && <div className="picker-loading">Carregando itens...</div>}

      {error && !isLoading && <div className="picker-error">{error}</div>}

      {!isLoading && !error && items.length === 0 && (
        <div className="picker-empty">Nenhum item encontrado</div>
      )}

      {items.length > 0 && (
        <ul className="picker-list">
          {items.map((item) => {
            const checked = selected.has(item.index)

            return (
              <li key={`${item.index}-${item.videoId ?? item.title}`}>
                <label className={`picker-item ${checked ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(item.index)}
                  />
                  {item.thumbnail ? (
                    <img
                      className="picker-thumb"
                      src={item.thumbnail}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="picker-thumb placeholder">♪</span>
                  )}
                  <span className="picker-item-title">{item.title}</span>
                </label>
              </li>
            )
          })}
        </ul>
      )}

      {hasMore && (
        <button type="button" className="picker-more" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </section>
  )
}
