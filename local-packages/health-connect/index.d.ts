import { Plugin } from '@capacitor/core';

export interface HealthConnectPlugin extends Plugin {
  checkAvailability(): Promise<{ availability: 'Available' | 'NotInstalled' | 'NotSupported' }>;
  requestPermission(options: { read: string[], write: string[] }): Promise<void>;
  readRecords(options: { type: string, startTime: string, endTime: string }): Promise<{ records: any[] }>;
}

export declare const HealthConnect: HealthConnectPlugin;
