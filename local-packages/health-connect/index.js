import { registerPlugin } from '@capacitor/core';

// Register our custom native HealthConnect plugin (implemented in HealthConnectPlugin.kt)
// This plugin uses only stable public Health Connect APIs and works on Android 16+
export const HealthConnect = registerPlugin('HealthConnect', {
  web: () => ({
    // Web stub — all methods gracefully fail with "not available"
    checkAvailability: async () => ({ availability: 'NotSupported' }),
    requestPermission: async () => { throw new Error('Health Connect is not available on web'); },
    getSteps: async () => ({ steps: 0, available: false }),
    readRecords: async () => ({ records: [] }),
    openHealthConnect: async () => {},
  })
});
