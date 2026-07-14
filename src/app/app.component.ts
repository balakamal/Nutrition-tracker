import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HealthConnectService } from './services/health-connect.service';
import { GeminiService, FoodAnalysisResult } from './services/gemini.service';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { FirebaseService, FirebaseConfig } from './services/firebase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  Math = Math; // Expose Math to template

  // Onboarding / API Key State
  hasApiKey = false;
  apiKeyInput = '';
  showSettings = false;

  // Active Theme Selection
  activeTheme: 'light' | 'dark' | 'system' = 'system';

  // User Profile State
  profileName = 'User';
  profileAge = 28;
  profileGender: 'Male' | 'Female' | 'Other' = 'Male';
  profileWeight = 70; // kg
  profileHeight = 175; // cm
  profileActivity: 'Sedentary' | 'Lightly Active' | 'Moderately Active' | 'Very Active' = 'Moderately Active';
  profileGoal: 'Lose Weight' | 'Maintain Weight' | 'Gain Weight' = 'Maintain Weight';

  // Manual Health Input State
  healthMode: 'sync' | 'manual' = 'sync';
  manualSteps = 8000;
  manualSleep = 480; // minutes

  // Nutrition Goal and Intake State
  targetCalories = 2500;
  consumedCalories = 0;
  
  targetProtein = 150;
  consumedProtein = 0;
  
  targetCarbs = 275;
  consumedCarbs = 0;
  
  targetFat = 80;
  consumedFat = 0;

  // Food Log History
  foodLogs: FoodAnalysisResult[] = [];

  // Health Connect Metrics State
  healthConnectStatus: 'Available' | 'NotInstalled' | 'NotSupported' | 'Checking' = 'Checking';
  healthConnectReason = '';
  healthConnectIsMocked = false;
  healthTimeFilter: 'today' | 'yesterday' | 'week' = 'today';
  remindersEnabled = true;
  pendingChatResult: FoodAnalysisResult | null = null;
  dailySteps = 0;
  sleepSessions: any[] = [];
  workouts: any[] = [];
  isSyncing = false;
  expandedLogIndex: number | null = null;
  dailySummaryText: string | null = null;
  isGeneratingSummary = false;
  summaryError: string | null = null;

  // Firebase Integration State
  isLoggedIn = false;
  firebaseEmail = '';
  firebasePassword = '';
  isLoginMode = true;
  firebaseError: string | null = null;
  isFirebaseBusy = false;
  firebaseConfigJson = '';

  // Historical Analytics State
  historicalAnalyticsText: string | null = null;
  isGeneratingHistoricalAnalytics = false;
  historicalAnalyticsError: string | null = null;

  // Unified AI & Manual Food Logger State
  aiInputText = '';
  selectedImageBase64: string | null = null;
  selectedImageMimeType: string | null = null;
  selectedImageName: string | null = null;
  isAnalyzing = false;
  analysisError: string | null = null;
  pendingAnalysisResult: FoodAnalysisResult | null = null;
  refinePrompt = '';
  isManualEntry = false;

  // Camera & Dropdown states
  showCamera = false;
  showAddMenu = false;
  private cameraStream: MediaStream | null = null;

  demoFoods: any[] = [];

  constructor(
    private healthService: HealthConnectService,
    private geminiService: GeminiService,
    public firebaseService: FirebaseService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.migrateStorageIfNeeded();
    await this.checkApiKeyConfig();
    
    // Register the Firebase auth listener
    this.firebaseService.registerAuthStateListener(async (user) => {
      if (user) {
        this.isLoggedIn = true;
        await this.loadUserDataFromFirebase();
      } else {
        this.isLoggedIn = false;
      }
    });

    // Load saved Firebase config json
    const savedConfig = await this.firebaseService.loadFirebaseConfig();
    this.firebaseConfigJson = savedConfig ? JSON.stringify(savedConfig, null, 2) : '';

    if (this.firebaseService.currentUserEmail) {
      this.isLoggedIn = true;
      await this.loadUserDataFromFirebase();
    } else {
      // Check mock session
      const { value: mockUser } = await Preferences.get({ key: 'mock_current_user' });
      if (mockUser) {
        this.isLoggedIn = true;
        await this.loadUserDataFromFirebase();
      }
    }

    await this.loadFoodLogs();
    await this.loadUserProfile();
    await this.initHealthConnect();
    this.initTheme();
    await this.initReminders();
    await this.checkAndAutoSummary();

    // Load historical analytics cache
    const { value: savedAnalytics } = await Preferences.get({ key: 'historical_analytics' });
    this.historicalAnalyticsText = savedAnalytics || localStorage.getItem('historical_analytics');
  }

  // Theme Management
  initTheme(): void {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null;
    this.activeTheme = savedTheme || 'system';
    this.applyTheme(this.activeTheme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (this.activeTheme === 'system') {
        this.applyTheme('system');
      }
    });
  }

  setTheme(theme: 'light' | 'dark' | 'system'): void {
    this.activeTheme = theme;
    localStorage.setItem('theme', theme);
    this.applyTheme(theme);
  }

  applyTheme(theme: 'light' | 'dark' | 'system'): void {
    const root = document.documentElement;
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', isDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  // Native Preferences Storage Migration Fallback
  async migrateStorageIfNeeded(): Promise<void> {
    const migrated = localStorage.getItem('prefs_migrated') === 'true';
    if (migrated) return;

    const keys = [
      'gemini_api_key',
      'theme',
      'user_profile',
      'food_logs',
      'health_mode',
      'manual_steps',
      'manual_sleep',
      'reminders_enabled',
      'health_time_filter'
    ];

    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val !== null) {
        await Preferences.set({ key, value: val });
      }
    }
    
    localStorage.setItem('prefs_migrated', 'true');
    console.log('WebView localStorage migrated to native Preferences storage successfully.');
  }

  // API Key checks
  async checkApiKeyConfig(): Promise<void> {
    this.hasApiKey = await this.geminiService.hasApiKey();
    if (this.hasApiKey) {
      const key = await this.geminiService.getApiKey();
      this.apiKeyInput = key ? `••••••••••••••••${key.slice(-4)}` : '';
    } else {
      this.apiKeyInput = '';
    }
  }

  async saveApiKey(): Promise<void> {
    const key = this.apiKeyInput.trim();
    if (!key || !key.startsWith('AIzaSy') || key.length < 30) {
      alert('Please enter a valid Gemini API Key starting with AIzaSy.');
      return;
    }
    await this.geminiService.saveApiKey(key);
    this.hasApiKey = true;
    this.showSettings = false;
    this.analysisError = null;
  }

  async saveSettingsConfig(): Promise<void> {
    const key = this.apiKeyInput.trim();
    if (!key || (!key.includes('••••') && (!key.startsWith('AIzaSy') || key.length < 30))) {
      alert('Please enter a valid Gemini API Key starting with AIzaSy.');
      return;
    }
    // Save API key if modified
    if (!key.includes('••••')) {
      await this.geminiService.saveApiKey(key);
      this.hasApiKey = true;
    }
    // Save profile and sync mode
    await this.saveUserProfile();
    this.showSettings = false;
    this.analysisError = null;
  }

  async saveFirebaseConfig(): Promise<void> {
    if (!this.firebaseConfigJson.trim()) {
      await this.firebaseService.clearFirebaseConfig();
      alert('Firebase config cleared. Returned to Mock Offline Database mode.');
      return;
    }
    try {
      const config = JSON.parse(this.firebaseConfigJson);
      await this.firebaseService.saveFirebaseConfig(config);
      alert('Firebase configuration saved successfully! Switched to Cloud Mode.');
    } catch (e: any) {
      alert('Invalid JSON format: ' + (e?.message || 'verify syntax'));
    }
  }

  async resetApiKey(): Promise<void> {
    await this.geminiService.clearApiKey();
    this.hasApiKey = false;
    this.apiKeyInput = '';
    
    // Clear profile and logs in native preferences
    await Preferences.remove({ key: 'user_profile' });
    await Preferences.remove({ key: 'food_logs' });
    await Preferences.remove({ key: 'health_mode' });
    await Preferences.remove({ key: 'manual_steps' });
    await Preferences.remove({ key: 'manual_sleep' });
    await Preferences.remove({ key: 'reminders_enabled' });
    await Preferences.remove({ key: 'health_time_filter' });

    // Clear fallbacks
    localStorage.removeItem('user_profile');
    localStorage.removeItem('food_logs');
    localStorage.removeItem('health_mode');
    localStorage.removeItem('manual_steps');
    localStorage.removeItem('manual_sleep');
    localStorage.removeItem('reminders_enabled');
    localStorage.removeItem('health_time_filter');
    
    this.profileName = 'User';
    this.profileAge = 28;
    this.profileGender = 'Male';
    this.profileWeight = 70;
    this.profileHeight = 175;
    this.profileActivity = 'Moderately Active';
    this.profileGoal = 'Maintain Weight';
    this.healthMode = 'sync';
    this.manualSteps = 8000;
    this.manualSleep = 480;

    this.foodLogs = [];
    this.calculateTotals();
    this.recalculateGoals();
    this.initHealthConnect();
  }

  // User Profile configuration
  async loadUserProfile(): Promise<void> {
    const { value: savedProfile } = await Preferences.get({ key: 'user_profile' });
    const profileVal = savedProfile || localStorage.getItem('user_profile');
    if (profileVal) {
      try {
        const profile = JSON.parse(profileVal);
        this.profileName = profile.name || 'User';
        this.profileAge = Number(profile.age) || 28;
        this.profileGender = profile.gender || 'Male';
        this.profileWeight = Number(profile.weight) || 70;
        this.profileHeight = Number(profile.height) || 175;
        this.profileActivity = profile.activity || 'Moderately Active';
        this.profileGoal = profile.goal || 'Maintain Weight';
      } catch (e) {
        console.error('Failed to parse user profile', e);
      }
    }
    const { value: modeVal } = await Preferences.get({ key: 'health_mode' });
    this.healthMode = (modeVal as 'sync' | 'manual') || localStorage.getItem('health_mode') as 'sync' | 'manual' || 'sync';
    
    const { value: stepsVal } = await Preferences.get({ key: 'manual_steps' });
    this.manualSteps = Number(stepsVal) || Number(localStorage.getItem('manual_steps')) || 8000;

    const { value: sleepVal } = await Preferences.get({ key: 'manual_sleep' });
    this.manualSleep = Number(sleepVal) || Number(localStorage.getItem('manual_sleep')) || 480;

    const { value: remindersVal } = await Preferences.get({ key: 'reminders_enabled' });
    this.remindersEnabled = remindersVal !== 'false' && localStorage.getItem('reminders_enabled') !== 'false';

    const { value: filterVal } = await Preferences.get({ key: 'health_time_filter' });
    this.healthTimeFilter = (filterVal as 'today' | 'yesterday' | 'week') || localStorage.getItem('health_time_filter') as 'today' | 'yesterday' | 'week' || 'today';

    this.recalculateGoals();
  }

  async saveUserProfile(): Promise<void> {
    const profile = {
      name: this.profileName,
      age: this.profileAge,
      gender: this.profileGender,
      weight: this.profileWeight,
      height: this.profileHeight,
      activity: this.profileActivity,
      goal: this.profileGoal
    };
    const profileJson = JSON.stringify(profile);
    await Preferences.set({ key: 'user_profile', value: profileJson });
    await Preferences.set({ key: 'health_mode', value: this.healthMode });
    await Preferences.set({ key: 'manual_steps', value: String(this.manualSteps) });
    await Preferences.set({ key: 'manual_sleep', value: String(this.manualSleep) });
    await Preferences.set({ key: 'reminders_enabled', value: String(this.remindersEnabled) });
    await Preferences.set({ key: 'health_time_filter', value: this.healthTimeFilter });

    // Fallbacks
    localStorage.setItem('user_profile', profileJson);
    localStorage.setItem('health_mode', this.healthMode);
    localStorage.setItem('manual_steps', String(this.manualSteps));
    localStorage.setItem('manual_sleep', String(this.manualSleep));
    localStorage.setItem('reminders_enabled', String(this.remindersEnabled));
    localStorage.setItem('health_time_filter', this.healthTimeFilter);

    this.recalculateGoals();
    await this.syncHealthData();
    
    // Save to Firebase if authenticated
    if (this.isLoggedIn) {
      await this.saveUserDataToFirebase();
    }

    // Apply reminder settings updates
    if (this.remindersEnabled) {
      await this.scheduleReminders();
    } else {
      await this.cancelReminders();
    }
  }

  recalculateGoals(): void {
    // Mifflin-St Jeor BMR equation
    let bmr = 10 * this.profileWeight + 6.25 * this.profileHeight - 5 * this.profileAge;
    if (this.profileGender === 'Male') {
      bmr += 5;
    } else if (this.profileGender === 'Female') {
      bmr -= 161;
    } else {
      bmr -= 78; // Midpoint average
    }

    // TDEE activity factor
    let factor = 1.2;
    if (this.profileActivity === 'Lightly Active') factor = 1.375;
    else if (this.profileActivity === 'Moderately Active') factor = 1.55;
    else if (this.profileActivity === 'Very Active') factor = 1.725;

    let tdee = bmr * factor;

    // Weight goal adjustment
    if (this.profileGoal === 'Lose Weight') {
      this.targetCalories = Math.max(1200, Math.round(tdee - 500));
    } else if (this.profileGoal === 'Gain Weight') {
      this.targetCalories = Math.round(tdee + 500);
    } else {
      this.targetCalories = Math.round(tdee);
    }

    // Macros calculations
    // Protein: 2.0g per kg of weight (4 kcal per gram)
    this.targetProtein = Math.round(this.profileWeight * 2.0);
    
    // Fat: 25% of calories. (9 kcal per gram)
    this.targetFat = Math.round((this.targetCalories * 0.25) / 9);

    // Carbs: Remainder of calories. (4 kcal per gram)
    const proteinKcal = this.targetProtein * 4;
    const fatKcal = this.targetFat * 9;
    this.targetCarbs = Math.max(50, Math.round((this.targetCalories - proteinKcal - fatKcal) / 4));
  }

  // Health Connect operations
  async initHealthConnect(): Promise<void> {
    const detail = await this.healthService.checkDetailedAvailability();
    this.healthConnectStatus = detail.status;
    this.healthConnectReason = detail.reason || '';
    this.healthConnectIsMocked = detail.isMocked;

    await this.syncHealthData();
  }

  async requestHealthConnectPermission(): Promise<void> {
    const granted = await this.healthService.requestPermissions();
    if (granted) {
      await this.initHealthConnect();
    }
  }

  getHealthFilterBounds(): { startTime: string; endTime: string } {
    const end = new Date();
    const start = new Date();
    
    if (this.healthTimeFilter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (this.healthTimeFilter === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (this.healthTimeFilter === 'week') {
      start.setDate(start.getDate() - 7);
    }
    
    return {
      startTime: start.toISOString(),
      endTime: end.toISOString()
    };
  }

  async syncHealthData(): Promise<void> {
    if (this.healthMode === 'manual') {
      this.dailySteps = this.manualSteps;
      this.sleepSessions = [
        {
          id: 'manual_sleep',
          startTime: new Date(Date.now() - (this.manualSleep + 60) * 60000).toISOString(),
          endTime: new Date().toISOString(),
          durationMinutes: this.manualSleep,
          stage: 'Manual Sleep Log'
        }
      ];
      this.workouts = [
        {
          id: 'manual_workout',
          title: 'Manual Exercise Activity',
          startTime: new Date(Date.now() - 3600000).toISOString(),
          durationMinutes: 45,
          caloriesBurned: 300,
          type: 'General'
        }
      ];
      return;
    }

    if (this.isSyncing) return;
    this.isSyncing = true;
    try {
      const bounds = this.getHealthFilterBounds();
      this.dailySteps = await this.healthService.getDailySteps(bounds.startTime, bounds.endTime);
      this.sleepSessions = await this.healthService.getSleepSessions(bounds.startTime, bounds.endTime);
      this.workouts = await this.healthService.getWorkouts(bounds.startTime, bounds.endTime);
    } catch (e) {
      console.error('Failed to sync Health Connect data', e);
    } finally {
      this.isSyncing = false;
    }
  }

  // Dynamic Data & Preferences Persistence
  async loadFoodLogs(): Promise<void> {
    const { value: savedLogs } = await Preferences.get({ key: 'food_logs' });
    const logsVal = savedLogs || localStorage.getItem('food_logs');
    if (logsVal) {
      try {
        this.foodLogs = JSON.parse(logsVal);
      } catch (e) {
        console.error('Failed to parse saved food logs, using defaults', e);
      }
    } else {
      this.foodLogs = [];
      const logsJson = JSON.stringify(this.foodLogs);
      await Preferences.set({ key: 'food_logs', value: logsJson });
      localStorage.setItem('food_logs', logsJson);
    }
    this.calculateTotals();
  }

  calculateTotals(): void {
    this.consumedCalories = 0;
    this.consumedProtein = 0;
    this.consumedCarbs = 0;
    this.consumedFat = 0;

    this.foodLogs.forEach(log => {
      this.consumedCalories += log.calories || 0;
      this.consumedProtein += log.protein || 0;
      this.consumedCarbs += log.carbs || 0;
      this.consumedFat += log.fat || 0;
    });
  }
  async clearFoodLogs(): Promise<void> {
    if (confirm('Are you sure you want to clear all logs?')) {
      this.foodLogs = [];
      const logsJson = JSON.stringify(this.foodLogs);
      await Preferences.set({ key: 'food_logs', value: logsJson });
      localStorage.setItem('food_logs', logsJson);
      this.calculateTotals();
      if (this.isLoggedIn) {
        await this.saveUserDataToFirebase();
      }
    }
  }

  async deleteFoodLog(index: number): Promise<void> {
    if (confirm('Are you sure you want to delete this log entry?')) {
      this.foodLogs.splice(index, 1);
      const logsJson = JSON.stringify(this.foodLogs);
      await Preferences.set({ key: 'food_logs', value: logsJson });
      localStorage.setItem('food_logs', logsJson);
      this.calculateTotals();
      if (this.isLoggedIn) {
        await this.saveUserDataToFirebase();
      }
    }
  }

  toggleLogExpansion(index: number): void {
    this.expandedLogIndex = this.expandedLogIndex === index ? null : index;
  }

  // File Upload & Unified AI Logger Handling
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.selectedImageName = file.name;
    this.analysisError = null;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.selectedImageBase64 = e.target.result;
      this.selectedImageMimeType = file.type;
    };
    reader.onerror = () => {
      this.analysisError = 'Failed to read image file.';
    };
    reader.readAsDataURL(file);
  }

  clearSelectedImage(): void {
    this.selectedImageBase64 = null;
    this.selectedImageMimeType = null;
    this.selectedImageName = null;
  }

  async analyzeFood(): Promise<void> {
    if (!this.selectedImageBase64 && !this.aiInputText.trim()) {
      this.analysisError = 'Please upload a photo, write a description, or click Log Manually.';
      return;
    }

    this.isAnalyzing = true;
    this.analysisError = null;
    this.pendingAnalysisResult = null;
    this.isManualEntry = false;

    try {
      if (this.selectedImageBase64) {
        const result = await this.geminiService.analyzeFoodImage(
          this.selectedImageBase64,
          this.selectedImageMimeType || 'image/jpeg',
          this.aiInputText
        );
        this.pendingAnalysisResult = result;
      } else {
        const result = await this.geminiService.analyzeFoodText(this.aiInputText);
        this.pendingAnalysisResult = result;
      }
    } catch (err: any) {
      this.analysisError = err?.message || 'AI estimation failed. Check your API Key and input.';
    } finally {
      this.isAnalyzing = false;
    }
  }

  startManualLog(): void {
    this.pendingAnalysisResult = {
      mealName: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      description: 'Manually logged.'
    };
    this.isManualEntry = true;
    this.analysisError = null;
  }

  async refineFoodAnalysis(): Promise<void> {
    if (!this.refinePrompt.trim()) return;

    this.isAnalyzing = true;
    this.analysisError = null;

    const fullPrompt = `${this.aiInputText} | Additional adjustment requested by user: ${this.refinePrompt}`;

    try {
      if (this.selectedImageBase64) {
        const result = await this.geminiService.analyzeFoodImage(
          this.selectedImageBase64,
          this.selectedImageMimeType || 'image/jpeg',
          fullPrompt
        );
        this.pendingAnalysisResult = result;
      } else {
        const result = await this.geminiService.analyzeFoodText(fullPrompt);
        this.pendingAnalysisResult = result;
      }
      this.refinePrompt = '';
    } catch (err: any) {
      this.analysisError = err?.message || 'Refinement failed. Please try again.';
    } finally {
      this.isAnalyzing = false;
    }
  }

  async confirmAndAddLog(): Promise<void> {
    if (!this.pendingAnalysisResult) return;

    // Direct validation of numeric types to prevent string type issues from HTML inputs
    this.pendingAnalysisResult.calories = Number(this.pendingAnalysisResult.calories) || 0;
    this.pendingAnalysisResult.protein = Number(this.pendingAnalysisResult.protein) || 0;
    this.pendingAnalysisResult.carbs = Number(this.pendingAnalysisResult.carbs) || 0;
    this.pendingAnalysisResult.fat = Number(this.pendingAnalysisResult.fat) || 0;

    this.foodLogs.unshift({ ...this.pendingAnalysisResult });
    const logsJson = JSON.stringify(this.foodLogs);
    await Preferences.set({ key: 'food_logs', value: logsJson });
    localStorage.setItem('food_logs', logsJson);
    this.calculateTotals();

    if (this.isLoggedIn) {
      await this.saveUserDataToFirebase();
    }

    // Reset logger state
    this.pendingAnalysisResult = null;
    this.aiInputText = '';
    this.refinePrompt = '';
    this.clearSelectedImage();
    this.isManualEntry = false;
  }

  cancelPendingLog(): void {
    this.pendingAnalysisResult = null;
    this.refinePrompt = '';
    this.isManualEntry = false;
  }

  async startCamera(): Promise<void> {
    this.showCamera = true;
    this.analysisError = null;
    
    // Allow the DOM to render the video element
    setTimeout(async () => {
      try {
        const video = document.getElementById('cameraVideo') as HTMLVideoElement;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        this.cameraStream = stream;
        if (video) {
          video.srcObject = stream;
          video.play();
        }
      } catch (err: any) {
        console.error('Error accessing camera:', err);
        this.analysisError = 'Could not access camera. Please check permissions.';
        this.stopCamera();
      }
    }, 100);
  }

  capturePhoto(): void {
    const video = document.getElementById('cameraVideo') as HTMLVideoElement;
    const canvas = document.getElementById('cameraCanvas') as HTMLCanvasElement;
    if (video && canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        // Match canvas dimensions to video feed
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const base64Data = canvas.toDataURL('image/jpeg');
        this.selectedImageBase64 = base64Data;
        this.selectedImageMimeType = 'image/jpeg';
        this.selectedImageName = `camera_capture_${Date.now()}.jpg`;
      }
    }
    this.stopCamera();
  }

  stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    this.showCamera = false;
  }

  // Progress Percentages
  getCaloriePercentage(): number {
    return Math.min(100, Math.round((this.consumedCalories / (this.targetCalories || 2000)) * 100));
  }

  getProteinPercentage(): number {
    return Math.min(100, Math.round((this.consumedProtein / (this.targetProtein || 120)) * 100));
  }

  getCarbsPercentage(): number {
    return Math.min(100, Math.round((this.consumedCarbs / (this.targetCarbs || 250)) * 100));
  }

  getFatPercentage(): number {
    return Math.min(100, Math.round((this.consumedFat / (this.targetFat || 70)) * 100));
  }

  // Helpers for formatting
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Local Notification Reminders
  async initReminders(): Promise<void> {
    this.remindersEnabled = localStorage.getItem('reminders_enabled') !== 'false';
    if (this.remindersEnabled) {
      await this.scheduleReminders();
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      }
      return true;
    } catch (e) {
      console.error('Failed to request notification permission:', e);
      return false;
    }
  }

  async scheduleReminders(): Promise<void> {
    try {
      // Clear existing first to avoid duplicate notifications
      await this.cancelReminders();

      const hasPerm = await this.requestNotificationPermission();
      if (!hasPerm) {
        console.warn('Notifications permission denied, skipping schedule.');
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 101,
            title: "🍳 Breakfast Time!",
            body: "Time to log your breakfast. Keep up with your target calorie and macros goal!",
            schedule: { every: 'day', on: { hour: 8, minute: 30 } }
          },
          {
            id: 102,
            title: "🥗 Lunch Reminder",
            body: "Don't forget to track your lunch. Let AI analyze your food plate image or describe your meal!",
            schedule: { every: 'day', on: { hour: 13, minute: 0 } }
          },
          {
            id: 103,
            title: "💧 Water & Hydration",
            body: "Have you had a glass of water recently? Keep hydrated for optimal metabolism!",
            schedule: { every: 'day', on: { hour: 15, minute: 30 } }
          },
          {
            id: 104,
            title: "🍽 Dinner Time!",
            body: "Time for dinner logging. How close are you to meeting your daily protein, carbs and fats target?",
            schedule: { every: 'day', on: { hour: 19, minute: 30 } }
          },
          {
            id: 105,
            title: "💧 Evening Hydration",
            body: "One last check on your water intake for today. Have a restful night!",
            schedule: { every: 'day', on: { hour: 21, minute: 30 } }
          }
        ]
      });
      console.log('Daily reminders scheduled.');
    } catch (e) {
      console.error('Failed to schedule reminders:', e);
    }
  }

  async cancelReminders(): Promise<void> {
    try {
      await LocalNotifications.cancel({
        notifications: [
          { id: 101 },
          { id: 102 },
          { id: 103 },
          { id: 104 },
          { id: 105 }
        ]
      });
      console.log('Reminders cancelled.');
    } catch (e) {
      console.error('Failed to cancel reminders:', e);
    }
  }

  // Firebase Remote Integration Helpers
  async loadUserDataFromFirebase(): Promise<void> {
    try {
      const remoteData = await this.firebaseService.loadUserData();
      if (remoteData) {
        if (remoteData.user_profile) {
          this.profileName = remoteData.user_profile.name || this.profileName;
          this.profileAge = remoteData.user_profile.age || this.profileAge;
          this.profileGender = remoteData.user_profile.gender || this.profileGender;
          this.profileWeight = remoteData.user_profile.weight || this.profileWeight;
          this.profileHeight = remoteData.user_profile.height || this.profileHeight;
          this.profileActivity = remoteData.user_profile.activity || this.profileActivity;
          this.profileGoal = remoteData.user_profile.goal || this.profileGoal;
        }
        this.foodLogs = remoteData.food_logs || this.foodLogs;
        this.healthMode = remoteData.health_mode || this.healthMode;
        this.manualSteps = remoteData.manual_steps || this.manualSteps;
        this.manualSleep = remoteData.manual_sleep || this.manualSleep;
        this.remindersEnabled = remoteData.reminders_enabled !== undefined ? remoteData.reminders_enabled : this.remindersEnabled;
        this.healthTimeFilter = remoteData.health_time_filter || this.healthTimeFilter;

        this.calculateTotals();
        this.recalculateGoals();

        // Write to native Preferences and localStorage for local persistence
        const profile = {
          name: this.profileName,
          age: this.profileAge,
          gender: this.profileGender,
          weight: this.profileWeight,
          height: this.profileHeight,
          activity: this.profileActivity,
          goal: this.profileGoal
        };
        const profileJson = JSON.stringify(profile);
        await Preferences.set({ key: 'user_profile', value: profileJson });
        localStorage.setItem('user_profile', profileJson);

        const logsJson = JSON.stringify(this.foodLogs);
        await Preferences.set({ key: 'food_logs', value: logsJson });
        localStorage.setItem('food_logs', logsJson);

        await Preferences.set({ key: 'health_mode', value: this.healthMode });
        await Preferences.set({ key: 'manual_steps', value: String(this.manualSteps) });
        await Preferences.set({ key: 'manual_sleep', value: String(this.manualSleep) });
        await Preferences.set({ key: 'reminders_enabled', value: String(this.remindersEnabled) });
        await Preferences.set({ key: 'health_time_filter', value: this.healthTimeFilter });

        localStorage.setItem('health_mode', this.healthMode);
        localStorage.setItem('manual_steps', String(this.manualSteps));
        localStorage.setItem('manual_sleep', String(this.manualSleep));
        localStorage.setItem('reminders_enabled', String(this.remindersEnabled));
        localStorage.setItem('health_time_filter', this.healthTimeFilter);
      }
    } catch (e) {
      console.error('Failed to load user data from Firebase:', e);
    }
  }

  async saveUserDataToFirebase(): Promise<void> {
    try {
      const payload = {
        user_profile: {
          name: this.profileName,
          age: this.profileAge,
          gender: this.profileGender,
          weight: this.profileWeight,
          height: this.profileHeight,
          activity: this.profileActivity,
          goal: this.profileGoal
        },
        food_logs: this.foodLogs,
        health_mode: this.healthMode,
        manual_steps: this.manualSteps,
        manual_sleep: this.manualSleep,
        reminders_enabled: this.remindersEnabled,
        health_time_filter: this.healthTimeFilter
      };
      await this.firebaseService.saveUserData(payload);
    } catch (e) {
      console.error('Failed to save user data to Firebase:', e);
    }
  }

  async handleFirebaseSubmit(): Promise<void> {
    if (!this.firebaseEmail.trim() || !this.firebasePassword.trim()) {
      this.firebaseError = 'Please fill out all fields.';
      return;
    }
    this.isFirebaseBusy = true;
    this.firebaseError = null;
    try {
      if (this.isLoginMode) {
        await this.firebaseService.login(this.firebaseEmail, this.firebasePassword);
      } else {
        await this.firebaseService.signup(this.firebaseEmail, this.firebasePassword);
      }
      this.isLoggedIn = true;
      await this.loadUserDataFromFirebase();
      await this.syncHealthData();
    } catch (e: any) {
      console.error(e);
      this.firebaseError = e.message || 'Authentication failed.';
    } finally {
      this.isFirebaseBusy = false;
    }
  }

  async handleFirebaseGoogleLogin(): Promise<void> {
    this.isFirebaseBusy = true;
    this.firebaseError = null;
    try {
      await this.firebaseService.loginWithGoogle();
      this.isLoggedIn = true;
      await this.loadUserDataFromFirebase();
      await this.syncHealthData();
    } catch (e: any) {
      console.error(e);
      this.firebaseError = e.message || 'Google Sign-In failed.';
    } finally {
      this.isFirebaseBusy = false;
    }
  }

  async handleFirebaseLogout(): Promise<void> {
    try {
      await this.firebaseService.logout();
      this.isLoggedIn = false;
      // Reset state to defaults on logout
      this.foodLogs = [];
      this.calculateTotals();
    } catch (e) {
      console.error('Failed to log out:', e);
    }
  }

  async triggerDailySummary(): Promise<void> {
    this.isGeneratingSummary = true;
    this.summaryError = null;
    try {
      const sleepMinutes = this.healthMode === 'manual' ? this.manualSleep : (this.sleepSessions[0]?.durationMinutes || 0);
      const summary = await this.geminiService.generateDailySummary(
        this.foodLogs,
        this.dailySteps,
        sleepMinutes,
        this.targetCalories,
        this.targetProtein,
        this.targetCarbs,
        this.targetFat
      );
      this.dailySummaryText = summary;
      const todayStr = new Date().toDateString();
      await Preferences.set({ key: `summary_${todayStr}`, value: summary });
      localStorage.setItem(`summary_${todayStr}`, summary);
    } catch (e: any) {
      this.summaryError = e?.message || 'Failed to generate summary.';
    } finally {
      this.isGeneratingSummary = false;
    }
  }

  async checkAndAutoSummary(): Promise<void> {
    const todayStr = new Date().toDateString();
    const { value: savedSummary } = await Preferences.get({ key: `summary_${todayStr}` });
    const localSummary = savedSummary || localStorage.getItem(`summary_${todayStr}`);
    if (localSummary) {
      this.dailySummaryText = localSummary;
    } else {
      const currentHour = new Date().getHours();
      if (currentHour >= 21) {
        await this.triggerDailySummary();
      }
    }
  }

  async triggerHistoricalAnalytics(): Promise<void> {
    this.isGeneratingHistoricalAnalytics = true;
    this.historicalAnalyticsError = null;
    try {
      const profile = {
        name: this.profileName,
        age: this.profileAge,
        gender: this.profileGender,
        weight: this.profileWeight,
        height: this.profileHeight,
        activity: this.profileActivity,
        goal: this.profileGoal
      };
      
      const analysis = await this.geminiService.generatePastDataAnalytics(
        this.foodLogs,
        profile
      );
      this.historicalAnalyticsText = analysis;
      await Preferences.set({ key: 'historical_analytics', value: analysis });
      localStorage.setItem('historical_analytics', analysis);
    } catch (e: any) {
      this.historicalAnalyticsError = e?.message || 'Failed to generate recommendations.';
    } finally {
      this.isGeneratingHistoricalAnalytics = false;
    }
  }
}
