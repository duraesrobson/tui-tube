# tui-tube

**YouTube → MP3/MP4 com cara de terminal.** Um único código, duas plataformas: app desktop em Electron e app Android em Capacitor, com o `yt-dlp` rodando localmente em ambos.

[![License: MIT](https://img.shields.io/badge/license-MIT-00ff41?style=flat-square)](./LICENSE)
![Electron](https://img.shields.io/badge/desktop-Electron-2B2E3A?style=flat-square&logo=electron&logoColor=white)
![Capacitor](https://img.shields.io/badge/android-Capacitor%208-119EFF?style=flat-square&logo=capacitor&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![yt-dlp](https://img.shields.io/badge/engine-yt--dlp-FF6B6B?style=flat-square)
![wrappers](https://img.shields.io/badge/wrappers%20de%20yt--dlp-1.000.001-ff6b6b?style=flat-square)

> **Aviso de utilidade pública:** este é o wrapper de `yt-dlp` nº **1.000.001**. Os outros 1 milhão continuam funcionando, beleza? Esse só tem interface de terminal e roda no celular.

---

## O que ele faz

| | |
|---|---|
| 🎵 **MP3** | Extração de áudio de 96 kbps até 320 kbps (ou "Melhor") |
| 🎬 **MP4** | Qualidades reais do vídeo (até 4K/60fps quando disponível), com merge no aparelho |
| 📚 **Playlists** | Lista os itens com thumbnail, 10 por vez; cada item vira um download separado |
| 🔎 **Prévia** | Busca thumbnail, título, canal, duração e a lista real de formatos |
| 📂 **Destino** | Separado por tipo: `Audio/` e `Video/` (desktop: dentro da pasta escolhida; Android: `Download/tui-tube`) |
| 📤 **Compartilhar** | No Android, aparece no menu "Compartilhar" do YouTube e abre com o link |
| ⏱️ **Background** | No Android o download continua com a tela apagada, com progresso e cancelar na notificação |
| ⏹️ **Cancelar** | Interrompe o download em andamento e descarta o parcial |
| ▶️ **Abrir / ouvir** | Toque no item concluído e escolha o app (player, VLC, galeria) |
| 🗑️ **Remover** | Apaga o arquivo do dispositivo e o item da lista, com confirmação |
| 🧵 **Fila** | Até dois downloads simultâneos; o resto espera na fila |
| ♻️ **Tentar de novo** | Repete um download que falhou sem pedir tudo outra vez |
| 📋 **Colar** | Lê o link da área de transferência e normaliza (`youtu.be`, shorts, music) |
| 🔄 **Motor atualizável** | Botão para atualizar o `yt-dlp` sem reinstalar o app |

O progresso mostra a fase real: **baixando → convertendo → pronto**. A lista separa *Em andamento* de *Concluídos*, o histórico sobrevive a fechar o app e a fila aceita dois downloads ao mesmo tempo.

Interface em JetBrains Mono, paleta verde-fósforo — e a fonte vai **embarcada** (funciona offline).

---

## Stack

- **UI:** React 18 + TypeScript + SCSS (sem CSS-in-JS)
- **Desktop:** Electron 43, `electron-builder` (AppImage / NSIS / portable)
- **Android:** Capacitor 8 + WebView, Gradle 8.14, AGP 8.13
- **Build:** Vite 8
- **Motor:** `yt-dlp` + `ffmpeg` — binário no desktop, `youtubedl-boom` (Python + ffmpeg empacotados) no Android

---

## Rodando

### Requisitos

- **Node 22+**
- **Desktop:** nada além do Node (o `bin/yt-dlp` já está no repo)
- **Android:** JDK 21 + Android SDK 36 (`platforms;android-36`, `build-tools;36.0.0`)

> O `npm install` precisa de `--legacy-peer-deps` por um conflito pré-existente entre `vite@8` e `@vitejs/plugin-react@4`.

```bash
git clone https://github.com/duraesrobson/tui-tube.git
cd tui-tube
npm install --legacy-peer-deps
```

### Desktop

```bash
npm run dev          # hot reload
npm run build        # pacote da plataforma atual
npm run build:linux  # AppImage
npm run build:win    # instalador Windows
```

### Android

```bash
# 1. aponte o SDK
echo "sdk.dir=$HOME/Android/Sdk" > android/local.properties

# 2. gere o APK release assinado
npm run android:build
# → android/app/build/outputs/apk/release/app-release.apk

# 3. com o celular no USB (depuração ativada)
npm run android:install
```

Assinatura: `android/keystore/release.keystore` + `android/keystore.properties` (ambos no `.gitignore`). Para gerar um novo:

```bash
keytool -genkeypair -v -keystore android/keystore/release.keystore \
  -alias tuitube -keyalg RSA -keysize 2048 -validity 10000
```

---

## Como o download funciona em cada plataforma

A UI é a mesma; o que muda é só o motor por trás de `src/lib/platform.ts`.

```
src/lib/platform.ts ──┬── platform.electron.ts  → IPC → spawn bin/yt-dlp
                      ├── platform.android.ts   → plugin Kotlin → youtubedl-boom
                      └── platform.web.ts       → fallback (só UI)
```

### Desktop (Electron)

O processo principal dá `spawn` no binário `bin/yt-dlp` e repassa o `stdout` para a UI, que extrai a porcentagem e atualiza a barra.

### Android (Capacitor)

| Peça | Papel |
|---|---|
| `TuiTubeDownloaderPlugin` | Ponte JS ↔ nativo (`getVideoInfo`, `download`, `cancel`, `openFile`, `deleteFile`, `updateEngine`, `getSharedLink`) |
| `DownloadEngine` | Fila, montagem dos argumentos do yt-dlp, cancelamento por process id, auto-update |
| `DownloadService` | Foreground service `dataSync` + notificação: o download não morre em background |
| `MediaStorage` | yt-dlp grava em `cacheDir` → o app copia para `Download/tui-tube/{Audio,Video}` via MediaStore |
| `ShareIntake` | Lê o `ACTION_SEND`, extrai a URL (YouTube primeiro, depois qualquer link) |

Detalhe importante: desde o Android 10 o app **não pode executar** binários gravados em `filesDir` (W^X/SELinux). Por isso o motor vem como `lib*.so` em `jniLibs` e roda de `nativeLibraryDir` — daí `useLegacyPackaging = true` e `android:extractNativeLibs="true"`.

---

## Estrutura

```
src/
  App.tsx                  # Tela principal
  lib/platform*.ts         # Contrato PlatformAPI e implementações
  lib/downloadProgress.ts  # Fases e progresso compartilhados
  lib/downloadErrors.ts    # Tradução dos erros do yt-dlp
  lib/formats.ts           # Normalização das qualidades reais
  lib/youtubeUrl.ts        # Parse/normalização de links
  hooks/usePlaylist.ts     # Listagem paginada (10 por vez)
  lib/history.ts           # Histórico persistido (localStorage)
  hooks/                   # useVideo, useDownloads
  components/              # Header, UrlInput, OptionsGrid, DownloadsList...
  styles/                  # Tema terminal + fontes locais
electron/
  main.ts                  # Janela, IPC, spawn do yt-dlp
  preload.ts               # contextBridge (contextIsolation ligado)
android/
  app/src/main/java/com/tuitube/app/
    MainActivity.java      # Recebe ACTION_SEND
    TuiTubeDownloaderPlugin.kt
    DownloadEngine.kt
    DownloadService.kt
    MediaStorage.kt
    ShareIntake.kt
bin/yt-dlp                 # Binário do desktop
```

---

## Limitações conhecidas

- **APK só `arm64-v8a`** — cobre praticamente todo celular moderno, mas não roda em emulador x86_64.
- **APK ~31 MB** — Python + ffmpeg (variante *lite*) embarcados. Merge e extração de áudio funcionam; só o re-encode de vídeo fica limitado ao mpeg4, que o app não usa.
- **YouTube e JS runtime** — o yt-dlp atual usa um runtime JS (Deno) para extração completa; ele não é embarcado, então alguns vídeos podem oferecer menos formatos. O botão **Atualizar** resolve a maioria dos casos de extractor desatualizado.
- **1080p** exige merge no aparelho, o que é mais lento e consome mais bateria que baixar um arquivo pronto.
- **Mix/rádio (`list=RD...`)** não é suportado pelo yt-dlp: o app avisa e sugere baixar o vídeo individualmente.
- **Remover no Android 10** pode abrir um diálogo de confirmação do sistema (política de scoped storage).
- **Abrir** depende de existir um app instalado que aceite `audio/mpeg` ou `video/mp4`; sem player, o card mostra o erro.

---

## Licença

O código deste repositório é **MIT**.

O build Android embarca `youtubedl-android` / `youtubedl-boom`, distribuídos sob **GPL-3.0**, e o `yt-dlp`, sob **Unlicense**. Por isso, **APKs distribuídos** carregam essas obrigações (GPL-3.0) — o que é compatível com este repositório público, já que o código-fonte está disponível. O build desktop usa o `yt-dlp` como processo separado.

---

<p align="center">
  <sub>Feito para uso pessoal — baixe apenas conteúdo que você tem direito de acessar.</sub>
</p>
