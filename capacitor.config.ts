import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neonuptime.monitor',
  appName: 'NeonUptime',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
