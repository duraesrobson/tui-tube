/**
 * Converte o stderr do yt-dlp em uma frase curta em português.
 * O objetivo é o usuário entender o que fazer, não ler stacktrace.
 */
const RULES: Array<[RegExp, string]> = [
  [/private video|video is private/i, 'Vídeo privado: não é possível baixar.'],
  [
    /sign in to confirm your age|age.?restricted|inappropriate for some users/i,
    'Vídeo com restrição de idade.'
  ],
  [/not available in your country|geo.?restrict|blocked it in your country/i, 'Vídeo bloqueado na sua região.'],
  [
    /video unavailable|this video is unavailable|has been removed|account associated with this video has been terminated/i,
    'Vídeo indisponível ou removido.'
  ],
  [/members.?only|join this channel/i, 'Conteúdo exclusivo para membros do canal.'],
  [/playlist does not exist|does not exist|http error 404/i, 'Playlist ou vídeo não encontrado.'],
  [/requested format is not available|no video formats found/i, 'Formato não disponível para este vídeo.'],
  [/no space left|enospc/i, 'Sem espaço no dispositivo.'],
  [
    /timed out|timeout|connection reset|temporary failure|getaddrinfo|network is unreachable|unable to download webpage/i,
    'Falha de rede. Verifique a conexão e tente de novo.'
  ],
  [/ffmpeg|ffprobe/i, 'Falha na conversão do arquivo (ffmpeg).'],
  [
    /http error 403|forbidden/i,
    'O YouTube recusou o download (403). Atualize o motor e tente de novo.'
  ],
  [/unsupported url|is not a valid url/i, 'Link não suportado.']
]

const firstUsefulLine = (raw: string): string => {
  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const errorLine = lines.find((line) => /\berror\b/i.test(line))

  return (errorLine ?? lines[0] ?? '').slice(0, 160)
}

export const humanizeError = (raw?: string): string => {
  if (!raw || !raw.trim()) return 'Falha no download. Tente novamente.'

  for (const [pattern, message] of RULES) {
    if (pattern.test(raw)) return message
  }

  return firstUsefulLine(raw) || 'Falha no download. Tente novamente.'
}
