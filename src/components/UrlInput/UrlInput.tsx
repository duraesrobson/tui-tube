import './UrlInput.scss'

interface UrlInputProps {
  value: string
  onChange: (value: string) => void
  onFetchInfo: () => void
  onPaste: () => void
  isLoading: boolean
  disabled?: boolean
}

export const UrlInput = ({ value, onChange, onFetchInfo, onPaste, isLoading, disabled }: UrlInputProps) => {
  return (
    <div className="url-input-wrapper">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cole a URL do YouTube aqui..."
        onKeyDown={(e) => e.key === 'Enter' && onFetchInfo()}
      />
      <button type="button" className="paste-btn" onClick={onPaste} disabled={isLoading}>
        Colar
      </button>
      <button onClick={onFetchInfo} disabled={disabled || isLoading}>
        {isLoading ? '...' : 'Info'}
      </button>
    </div>
  )
}
