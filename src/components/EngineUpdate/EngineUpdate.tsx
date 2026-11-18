import { useState } from 'react'
import { platform } from '../../lib/platform'
import './EngineUpdate.scss'

type Status = 'idle' | 'loading' | 'success' | 'error'

export const EngineUpdate = () => {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  const handleUpdate = async () => {
    if (!platform.updateEngine || status === 'loading') return

    setStatus('loading')
    setMessage('')

    try {
      const result = await platform.updateEngine()

      if (result.success) {
        setStatus('success')
        setMessage(result.version ? `yt-dlp ${result.version}` : 'Engine atualizado')
      } else {
        setStatus('error')
        setMessage(result.error || 'Falha ao atualizar')
      }
    } catch {
      setStatus('error')
      setMessage('Falha ao atualizar')
    }
  }

  return (
    <div className="engine-update">
      <span className={`engine-status ${status}`}>
        {status === 'loading' && 'Atualizando motor...'}
        {status === 'success' && message}
        {status === 'error' && message}
        {status === 'idle' && 'Motor local (yt-dlp)'}
      </span>

      <button onClick={handleUpdate} disabled={status === 'loading'}>
        {status === 'loading' ? '...' : 'Atualizar'}
      </button>
    </div>
  )
}
