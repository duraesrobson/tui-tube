import './DownloadButton.scss'

interface DownloadButtonProps {
  format: 'mp3' | 'mp4'
  isLoading: boolean
  disabled?: boolean
  onClick: () => void
}

export const DownloadButton = ({ format, isLoading, disabled, onClick }: DownloadButtonProps) => {
  return (
    <button
      className="download-btn"
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? 'Baixando...' : `Baixar ${format.toUpperCase()}`}
    </button>
  )
}