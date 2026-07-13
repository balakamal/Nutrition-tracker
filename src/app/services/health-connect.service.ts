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
        status: 'NotSupported',
        reason: 'Health Connect is not supported on non-Android platforms (running on Web/Desktop). Please use Manual Input mode.',
        isMocked: false
      };
    }

    try {
      const result = await HealthConnect.checkAvailability();
      
      let reason = '';
      if (result.availability === 'NotInstalled') {
        reason = 'Health Connect app is not installed on this Android device. Please install it from the Google Play Store.';
      } else if (result.availability === 'NotSupported') {
        reason = 'Health Connect is not supported on this Android OS version. Requires Android 8.0 (API 26) or higher.';
      } else {
        reason = 'Health Connect is active and connected natively.';
      }

      return {
        status: result.availability,
        reason,
        isMocked: false
      };
    } catch (error: any) {
      console.error('Error checking Health Connect availability:', error);
      return {
        status: 'NotSupported',
        reason: `Failed to initialize Health Connect: ${error.message || error}`,
        isMocked: false
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
      return false;
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
   * Pulls deduplicated steps for a specified timeframe.
   */
  async getDailySteps(startTime?: string, endTime?: string): Promise<number> {
    if (!this.isAndroid) {
      return 0;
    }

    try {
      let start = startTime;
      let end = endTime;
      
      if (!start || !end) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        start = todayStart.toISOString();
        end = new Date().toISOString();
      }

      const response = await HealthConnect.readRecords({
        type: 'steps',
        startTime: start,
        endTime: end
      });

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
   * Fetches sleep sessions for a specified timeframe.
   */
  async getSleepSessions(startTime?: string, endTime?: string): Promise<any[]> {
    if (!this.isAndroid) {
      return [];
    }

    try {
      let start = startTime;
      let end = endTime;

      if (!start || !end) {
        const defaultStart = new Date();
        defaultStart.setDate(defaultStart.getDate() - 7);
        start = defaultStart.toISOString();
        end = new Date().toISOString();
      }

      const response = await HealthConnect.readRecords({
        type: 'sleep',
        startTime: start,
        endTime: end
      });

      return response.records || [];
    } catch (error) {
      console.error('Failed to read sleep sessions from Health Connect:', error);
      return [];
    }
  }

  /**
   * Fetches workout (exercise) sessions for a specified timeframe.
   */
  async getWorkouts(startTime?: string, endTime?: string): Promise<any[]> {
    if (!this.isAndroid) {
      return [];
    }

    try {
      let start = startTime;
      let end = endTime;

      if (!start || !end) {
        const defaultStart = new Date();
        defaultStart.setDate(defaultStart.getDate() - 7);
        start = defaultStart.toISOString();
        end = new Date().toISOString();
      }

      const response = await HealthConnect.readRecords({
        type: 'exercise',
        startTime: start,
        endTime: end
      });

      return response.records || [];
    } catch (error) {
      console.error('Failed to read workouts from Health Connect:', error);
      return [];
    }
  }
}
