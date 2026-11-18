import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.tuitube.app',
  appName: 'tui-tube',
  webDir: 'dist',
  android: {
    backgroundColor: '#0d0d0d',
    allowMixedContent: false
  }
}

export default config
