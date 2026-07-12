import { Capacitor } from '@capacitor/core';
import { HealthConnect as NativeHealthConnect } from '@pianissimoproject/capacitor-health-connect';

// We adapt the native plugin's API to the mock's original API names expected by the app.
// Note: We use actual native Health Connect data without mock fallbacks!
const HealthConnect = {
  async checkAvailability() {
    if (!Capacitor.isNativePlatform()) {
      return { availability: 'NotSupported' };
    }
    const isPluginAvailable = Capacitor.isPluginAvailable('HealthConnect');
    if (!isPluginAvailable) {
      return { availability: 'NotSupported' };
    }
    try {
      const res = await NativeHealthConnect.checkAvailability();
      return { availability: res.availability };
    } catch (e) {
      console.error('Native HealthConnect.checkAvailability failed:', e);
      return { availability: 'NotSupported' };
    }
  },

  async requestPermission(options) {
    if (!Capacitor.isNativePlatform()) {
      return { grantedPermissions: [], hasAllPermissions: false };
    }
    const isPluginAvailable = Capacitor.isPluginAvailable('HealthConnect');
    if (!isPluginAvailable) {
      return { grantedPermissions: [], hasAllPermissions: false };
    }

    const readTypes = [];
    if (options && options.read) {
      if (options.read.includes('steps')) readTypes.push('Steps');
      if (options.read.includes('weight')) readTypes.push('Weight');
      if (options.read.includes('height')) readTypes.push('Height');
      // Sleep and Exercise are not supported natively in this plugin's RecordType.
    }

    try {
      return await NativeHealthConnect.requestHealthPermissions({
        read: readTypes,
        write: []
      });
    } catch (e) {
      console.error('Native HealthConnect.requestHealthPermissions failed:', e);
      throw e;
    }
  },

  async readRecords(options) {
    if (!Capacitor.isNativePlatform()) {
      return { records: [] };
    }
    const isPluginAvailable = Capacitor.isPluginAvailable('HealthConnect');
    if (!isPluginAvailable) {
      return { records: [] };
    }

    const typeMap = {
      steps: 'Steps',
      weight: 'Weight',
      height: 'Height'
    };

    const nativeType = typeMap[options.type];
    if (!nativeType) {
      // Sleep and exercise are not supported natively, return empty instead of mock data!
      return { records: [] };
    }

    try {
      const res = await NativeHealthConnect.readRecords({
        type: nativeType,
        timeRangeFilter: {
          type: 'between',
          startTime: new Date(options.startTime),
          endTime: new Date(options.endTime)
        }
      });

      const mappedRecords = (res.records || []).map(record => {
        if (nativeType === 'Steps') {
          return {
            count: record.count,
            startTime: record.startTime,
            endTime: record.endTime
          };
        } else if (nativeType === 'Weight') {
          return {
            weight: record.weight ? record.weight.value : 0,
            time: record.time
          };
        }
        return record;
      });

      return { records: mappedRecords };
    } catch (e) {
      console.error(`Native HealthConnect.readRecords for ${options.type} failed:`, e);
      return { records: [] }; // No mock fallback!
    }
  }
};

export { HealthConnect };
