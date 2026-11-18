import type { QualityMap } from '../../types'
import './OptionsGrid.scss'

interface OptionsGridProps {
  format: 'mp3' | 'mp4'
  quality: string
  outputFolder: string
  qualities: QualityMap
  canSelectFolder: boolean
  onFormatChange: (format: 'mp3' | 'mp4') => void
  onQualityChange: (quality: string) => void
  onSelectFolder: () => void
  onOpenFolder: () => void
}

export const OptionsGrid = ({
  format,
  quality,
  outputFolder,
  qualities,
  canSelectFolder,
  onFormatChange,
  onQualityChange,
  onSelectFolder,
  onOpenFolder
}: OptionsGridProps) => {
  return (
    <div className="options-grid">
      <div className="option-group">
        <label>Formato</label>
        <div className="format-selector">
          <button
            className={`format-btn ${format === 'mp3' ? 'active' : ''}`}
            onClick={() => onFormatChange('mp3')}
          >
            MP3
          </button>
          <button
            className={`format-btn ${format === 'mp4' ? 'active' : ''}`}
            onClick={() => onFormatChange('mp4')}
          >
            MP4
          </button>
        </div>
      </div>

      <div className="option-group">
        <label>Qualidade</label>
        <select
          value={quality}
          onChange={(e) => onQualityChange(e.target.value)}
        >
          {qualities[format].map(q => (
            <option key={q.value} value={q.value}>{q.label}</option>
          ))}
        </select>
      </div>

      <div className="option-group full-width">
        <label>{canSelectFolder ? 'Pasta de Download' : 'Salvar em'}</label>
        <div className="folder-select">
          <input
            type="text"
            value={outputFolder}
            readOnly
            style={{ flex: 1 }}
          />
          {canSelectFolder && <button onClick={onSelectFolder}>Selecionar</button>}
          <button onClick={onOpenFolder}>Abrir</button>
        </div>
      </div>
    </div>
  )
}