import { platform } from '../../lib/platform'
import './TitleBar.scss'

export const TitleBar = () => {
  const handleMinimize = () => {
    void platform.windowMinimize()
  }

  const handleMaximize = () => {
    void platform.windowMaximize()
  }

  const handleClose = () => {
    void platform.windowClose()
  }

  return (
    <div className="title-bar">
      <div className="drag-region" />
      <div className="window-controls">
        <button className="control-btn minimize" onClick={handleMinimize}>
          <svg viewBox="0 0 12 12">
            <rect x="2" y="5.5" width="8" height="1" fill="currentColor" />
          </svg>
        </button>
        <button className="control-btn maximize" onClick={handleMaximize}>
          <svg viewBox="0 0 12 12">
            <rect x="2" y="2" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button className="control-btn close" onClick={handleClose}>
          <svg viewBox="0 0 12 12">
            <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
