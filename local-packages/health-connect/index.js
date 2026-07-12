import { registerPlugin, Capacitor } from '@capacitor/core';

const HealthConnectNative = registerPlugin('HealthConnect');

const mockImplementation = {
  checkAvailability: async () => {
    console.warn('Health Connect: Using JS mock implementation');
    return { availability: 'Available' };
  },
  requestPermission: async () => {
    console.warn('Health Connect: Simulating permissions grant');
    return {};
  },
  readRecords: async (options) => {
    console.warn('Health Connect: Reading mock records for', options.type);
    const now = new Date();
    if (options.type === 'steps') {
      return {
        records: [
          { count: 4200, startTime: now.toISOString(), endTime: now.toISOString() },
          { count: 2642, startTime: now.toISOString(), endTime: now.toISOString() }
        ]
      };
    } else if (options.type === 'sleep') {
      return {
        records: [
          {
            id: 'sleep_1',
            startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 * 1).toISOString(),
            endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 * 1 + 8 * 60 * 60 * 1000).toISOString(),
            durationMinutes: 480,
            stage: 'Deep Sleep'
          },
          {
            id: 'sleep_2',
            startTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 * 2).toISOString(),
            endTime: new Date(now.getTime() - 24 * 60 * 60 * 1000 * 2 + 7.5 * 60 * 60 * 1000).toISOString(),
            durationMinutes: 450,
            stage: 'Light Sleep'
          }
        ]
      };
    } else if (options.type === 'exercise') {
      return {
        records: [
          {
            id: 'workout_1',
            title: 'HIIT Cardio Session',
            startTime: new Date(Date.now() - 3 * 3600000).toISOString(),
            durationMinutes: 45,
            caloriesBurned: 420,
            type: 'HIIT'
          },
          {
            id: 'workout_2',
            title: 'Evening Strength Training',
            startTime: new Date(Date.now() - 24 * 3600000).toISOString(),
            durationMinutes: 60,
            caloriesBurned: 350,
            type: 'Weights'
          }
        ]
      };
    }
    return { records: [] };
  }
};

const proxyHandler = {
  get(target, prop) {
    if (Capacitor.isNativePlatform()) {
      return async (...args) => {
        try {
          if (target[prop]) {
            return await target[prop](...args);
          } else {
            throw new Error(`Method ${prop} not found on native HealthConnect`);
          }
        } catch (e) {
          console.warn(`Native HealthConnect.${prop} failed:`, e);
          const mockResult = await mockImplementation[prop](...args);
          if (mockResult && typeof mockResult === 'object') {
            mockResult._nativeError = e.message || String(e);
            mockResult._nativeFailed = true;
          }
          return mockResult;
        }
      };
    } else {
      return async (...args) => {
        const mockResult = await mockImplementation[prop](...args);
        if (mockResult && typeof mockResult === 'object') {
          mockResult._nativeError = 'Health Connect is not supported on non-Android platforms (running on Web/Desktop)';
          mockResult._nativeFailed = true;
        }
        return mockResult;
      };
    }
  }
};

const HealthConnect = new Proxy(HealthConnectNative, proxyHandler);
export { HealthConnect };
