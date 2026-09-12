import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ajbleadersacademy.grades',
  appName: 'AJB Leaders Academy',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  backgroundColor: '#0a0a0a',
};

export default config;
