import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.archepal.app',
  appName: 'ArchePal',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    hostname: 'archepal.app',
    // Load from local built assets (dist/) — never from a development server
    // To enable live reload in development, set CAP_SERVER_URL env var explicitly:
    // export CAP_SERVER_URL=http://<YOUR_IP>:8080 && npm run ios
    url: process.env.CAP_SERVER_URL,
    // Allow all hosts for Firebase connectivity + Vercel API backend
    allowNavigation: [
      'firestore.googleapis.com',
      'firebase.googleapis.com',
      'firebaseio.com',
      '*.firebaseio.com',
      '*.googleapis.com',
      '*.google.com',
      'myarchepal.vercel.app',     // Allow API calls to Vercel backend
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#2563eb',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'light',
      backgroundColor: '#2563eb'
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'ArchePal'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
