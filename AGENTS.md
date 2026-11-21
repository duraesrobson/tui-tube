# tui-tube

YouTube to MP3/MP4 converter with terminal-style UI (Electron + React no desktop, Capacitor no Android).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for current platform |
| `npm run build:linux` | Build Linux AppImage |
| `npm run build:win` | Build Windows executable |
| `npm run preview` | Preview production build |
| `npm run android:sync` | Build web + copiar assets para o projeto Android |
| `npm run android:build` | Gerar APK release assinado |
| `npm run android:install` | Gerar APK e instalar via `adb install -r` |

## Project Structure

```
src/
  App.tsx              # Main React UI
  lib/history.ts       # Histórico persistido de downloads concluídos
  lib/platform.ts      # Seleciona a implementação por ambiente (electron/android/web)
  lib/platform.*.ts    # Implementações do contrato PlatformAPI
  styles/main.scss     # Estilos globais + safe areas
electron/
  main.ts              # Electron main process, IPC handlers, yt-dlp spawn
  preload.ts           # Context bridge API exposed to renderer
android/               # Projeto Capacitor (não editar arquivos gerados pelo cap)
  app/src/main/java/com/tuitube/app/
    TuiTubeDownloaderPlugin.kt  # Ponte JS <-> nativo
    DownloadEngine.kt           # yt-dlp/ffmpeg, fila, cancelamento, update
    DownloadService.kt          # Foreground service
    MediaStorage.kt             # Copia para Download/tui-tube via MediaStore
bin/
  yt-dlp               # Binary usado apenas no desktop
```

## Key Behaviors

- **Video info**: Uses `--no-playlist` flag to fetch single video metadata
- **Download video**: Uses `--no-playlist` (single video)
- **Download playlist**: Uses `--yes-playlist` (full playlist)
- **User control**: `downloadPlaylist` boolean in App.tsx controls which API is called

## Tech Stack

- Electron 28 + React 18 + TypeScript (desktop)
- Capacitor 8 + WebView (Android)
- Vite 8 + vite-plugin-electron
- yt-dlp: binário no desktop; `youtubedl-boom` (Python + ffmpeg embarcados) no Android
- SCSS (no CSS-in-JS)
- electron-log for logging (desktop)

## Gotchas

- No lint or typecheck script (build does `tsc && vite build`)
- No test framework configured
- yt-dlp binary location: `bin/yt-dlp` in dev, `resources/yt-dlp` in production
- `--no-check-certificates` and custom user-agent added to yt-dlp spawn for reliability
- `npm install` precisa de `--legacy-peer-deps` (vite 8 vs @vitejs/plugin-react 4)
- Electron e Android compartilham a mesma UI via `src/lib/platform.ts`: nunca acessar
  `window.electronAPI` diretamente nos componentes

## Android

- APK somente `arm64-v8a` (`ndk.abiFilters`) — o motor embarca Python + ffmpeg (~50 MB).
- Motor: `youtubedl-boom-lite` (ffmpeg reduzido) — o APK fica em ~31 MB. A API é
  idêntica à `youtubedl-boom`; só o re-encode de vídeo é limitado a mpeg4.
- `useLegacyPackaging = true` + `android:extractNativeLibs="true"` são obrigatórios:
  Android 10+ só permite executar binários de `nativeLibraryDir`.
- Downloads vão para `Download/tui-tube/Audio` ou `/Video` via MediaStore; o yt-dlp
  escreve em `cacheDir` e o `MediaStorage` publica (retornando uri/nome/mime/tamanho).
- `DownloadService` (foreground/dataSync) mantém o download vivo em segundo plano.
- Cada job tem um `id` gerado na UI; eventos, cancelamento e ações usam esse id.
- Abrir/remover no Android usam a content URI do MediaStore (`ACTION_VIEW` e
  `ContentResolver.delete`). Cancelar mantém o processo do ffmpeg no mesmo kill.
- Histórico de itens encerrados fica em `localStorage` (`tui-tube.history.v1`).
- Fila no renderer (`useDownloads`): no máximo 2 downloads simultâneos; o resto
  fica em `queued` e é iniciado por um efeito quando abre vaga.
- Playlist: `usePlaylist` busca páginas de 10 (`getPlaylistInfo` com start/pageSize,
  `--playlist-start/--playlist-end`); `hasMore` controla o botão "Carregar mais".
  Nenhum item marcado = playlist inteira (`--playlist-items` vazio).
- Notificação do Android: progresso com throttle de 800ms, ação "Cancelar"
  (`DownloadActionReceiver`) e notificação de conclusão em canal separado.
- Cancelar precisa cancelar a corrotina externa (`jobHandles`), senão o
  `finally` não roda e o foreground service fica preso.
- Assinatura: `android/keystore/release.keystore` + `android/keystore.properties`
  (ambos ignorados pelo git).
- Build local exige JDK 21 (Capacitor 8) e Android SDK 36. `android/gradle.properties`
  aponta `org.gradle.java.home` para o Temurin 21 local e `android/local.properties`
  aponta o SDK (ambos específicos da máquina).
