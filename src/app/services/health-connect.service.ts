import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { HealthConnect } from '@capacitor-community/health-connect';

export interface HealthAvailability {
  status: 'Available' | 'NotInstalled' | 'NotSupported' | 'Checking';
  reason?: string;
  isMocked: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class HealthConnectService {
  private isAndroid: boolean = Capacitor.getPlatform() === 'android';

  constructor() {}

  /**
   * Checks the Health Connect OS-level availability with detailed diagnostics.
   */
  async checkDetailedAvailability(): Promise<HealthAvailability> {
    if (!this.isAndroid) {
      return {
        status: 'Available',
        reason: 'Running in Web environment (automatically falling back to mock data simulation).',
        isMocked: true
      };
    }

    try {
      const result = await HealthConnect.checkAvailability();
      
      let reason = '';
      let isMocked = false;
      
      // If our JS proxy fallback caught a native failure, mark it.
      if ((result as any)._nativeFailed) {
        reason = `Native Health Connect failed: ${(result as any)._nativeError || 'Unknown native error'}. Using simulated fallback.`;
        isMocked = true;
      } else if (result.availability === 'NotInstalled') {
        reason = 'Health Connect app is not installed on this Android device. Please install it from the Google Play Store.';
      } else if (result.availability === 'NotSupported') {
        reason = 'Health Connect is not supported on this Android OS version. Requires Android 8.0 (API 26) or higher.';
      } else {
        reason = 'Health Connect is active and connected natively.';
      }

      return {
        status: (result as any)._nativeFailed ? 'Available' : result.availability,
        reason,
        isMocked
      };
    } catch (error: any) {
      console.error('Error checking Health Connect availability:', error);
      return {
        status: 'NotSupported',
        reason: `Failed to initialize Health Connect: ${error.message || error}`,
        isMocked: true
      };
    }
  }

  /**
   * Checks the Health Connect OS-level availability. (Legacy wrapper)
   */
  async checkAvailability(): Promise<'Available' | 'NotInstalled' | 'NotSupported'> {
    const res = await this.checkDetailedAvailability();
    return res.status as 'Available' | 'NotInstalled' | 'NotSupported';
  }

  /**
   * Request native runtime permissions for steps, sleep, and workouts.
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isAndroid) {
      console.warn('Requesting permissions simulated on web.');
      return true;
    }

    try {
      await HealthConnect.requestPermission({
        read: ['steps', 'sleep', 'exercise'],
        write: []
      });
      return true;
    } catch (error) {
      console.error('Failed to request Health Connect permissions:', error);
      return false;
    }
  }

  /**
   * Pulls deduplicated steps for the current day.
   * Sums up step records for the today interval.
   */
  async getDailySteps(): Promise<number> {
    if (!this.isAndroid) {
      // Return simulated steps for web testing
      return 6842;
    }

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();

      const response = await HealthConnect.readRecords({
        type: 'steps',
        startTime: todayStart.toISOString(),
        endTime: todayEnd.toISOString()
      });

      // Sum up and deduplicate records. Some apps write steps in intervals.
      // Deduplicate steps by aggregating.
      if (response && response.records) {
        return response.records.reduce((sum: number, record: any) => sum + (record.count || 0), 0);
      }
      return 0;
    } catch (error) {
      console.error('Failed to read steps from Health Connect:', error);
      return 0;
    }
  }

  /**
   * Fetches sleep sessions for the last 7 days.
   */
  async getSleepSessions(): Promise<any[]> {
    if (!this.isAndroid) {
      // Return simulated sleep sessions for web testing
      const now = new Date();
      return [
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
      ];
    }

    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 7);
      const endTime = new Date();

      const response = await HealthConnect.readRecords({
        type: 'sleep',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      return response.records || [];
    } catch (error) {
      console.error('Failed to read sleep sessions from Health Connect:', error);
      return [];
    }
  }

  /**
   * Fetches workout (exercise) sessions for the last 7 days.
   */
  async getWorkouts(): Promise<any[]> {
    if (!this.isAndroid) {
      // Return simulated workouts for web testing
      return [
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
      ];
    }

    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - 7);
      const endTime = new Date();

      const response = await HealthConnect.readRecords({
        type: 'exercise',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      return response.records || [];
    } catch (error) {
      console.error('Failed to read workouts from Health Connect:', error);
      return [];
    }
  }
}
