import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HealthConnectService } from './services/health-connect.service';
import { GeminiService, FoodAnalysisResult } from './services/gemini.service';

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
  dailySteps = 0;
  sleepSessions: any[] = [];
  workouts: any[] = [];
  isSyncing = false;

  // Vision Logging State
  isAnalyzing = false;
  analysisError: string | null = null;
  uploadedFileName: string | null = null;
  latestAnalysis: FoodAnalysisResult | null = null;

  // Pre-coded demo image base64 strings to facilitate instant testing
  demoFoods = [
    {
      name: 'Avocado Toast with Egg',
      mimeType: 'image/jpeg',
      base64: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', // Minimal dummy jpeg base64
      calories: 380,
      protein: 14,
      carbs: 32,
      fat: 22,
      description: 'Sourdough toast topped with mashed avocado, a poached egg, and red pepper flakes.'
    },
    {
      name: 'Grilled Salmon with Quinoa',
      mimeType: 'image/jpeg',
      base64: '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      calories: 540,
      protein: 38,
      carbs: 45,
      fat: 22,
      description: 'Atlantic salmon filet served over herbed quinoa and steamed asparagus.'
    }
  ];

  constructor(
    private healthService: HealthConnectService,
    private geminiService: GeminiService
  ) {}

  ngOnInit(): void {
    this.checkApiKeyConfig();
    this.loadFoodLogs();
    this.loadUserProfile();
    this.initHealthConnect();
    this.initTheme();
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

  // API Key checks
  checkApiKeyConfig(): void {
    this.hasApiKey = this.geminiService.hasApiKey();
    if (this.hasApiKey) {
      const key = this.geminiService.getApiKey();
      this.apiKeyInput = key ? `••••••••••••••••${key.slice(-4)}` : '';
    } else {
      this.apiKeyInput = '';
    }
  }

  saveApiKey(): void {
    if (this.apiKeyInput.trim().length > 10) {
      this.geminiService.saveApiKey(this.apiKeyInput);
      this.hasApiKey = true;
      this.showSettings = false;
      this.analysisError = null;
    }
  }

  saveSettingsConfig(): void {
    // Save API key if modified
    if (this.apiKeyInput.trim() && !this.apiKeyInput.includes('••••')) {
      this.geminiService.saveApiKey(this.apiKeyInput);
      this.hasApiKey = true;
    }
    // Save profile and sync mode
    this.saveUserProfile();
    this.showSettings = false;
    this.analysisError = null;
  }

  resetApiKey(): void {
    this.geminiService.clearApiKey();
    this.hasApiKey = false;
    this.apiKeyInput = '';
    
    // Clear profile and logs as well
    localStorage.removeItem('user_profile');
    localStorage.removeItem('food_logs');
    localStorage.removeItem('health_mode');
    localStorage.removeItem('manual_steps');
    localStorage.removeItem('manual_sleep');
    
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
  loadUserProfile(): void {
    const savedProfile = localStorage.getItem('user_profile');
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile);
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
    this.healthMode = (localStorage.getItem('health_mode') as 'sync' | 'manual') || 'sync';
    this.manualSteps = Number(localStorage.getItem('manual_steps')) || 8000;
    this.manualSleep = Number(localStorage.getItem('manual_sleep')) || 480;

    this.recalculateGoals();
  }

  saveUserProfile(): void {
    const profile = {
      name: this.profileName,
      age: this.profileAge,
      gender: this.profileGender,
      weight: this.profileWeight,
      height: this.profileHeight,
      activity: this.profileActivity,
      goal: this.profileGoal
    };
    localStorage.setItem('user_profile', JSON.stringify(profile));
    localStorage.setItem('health_mode', this.healthMode);
    localStorage.setItem('manual_steps', String(this.manualSteps));
    localStorage.setItem('manual_sleep', String(this.manualSleep));

    this.recalculateGoals();
    this.syncHealthData();
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
      this.dailySteps = await this.healthService.getDailySteps();
      this.sleepSessions = await this.healthService.getSleepSessions();
      this.workouts = await this.healthService.getWorkouts();
    } catch (e) {
      console.error('Failed to sync Health Connect data', e);
    } finally {
      this.isSyncing = false;
    }
  }

  // Dynamic Data & LocalStorage Persistence
  loadFoodLogs(): void {
    const savedLogs = localStorage.getItem('food_logs');
    if (savedLogs) {
      try {
        this.foodLogs = JSON.parse(savedLogs);
      } catch (e) {
        console.error('Failed to parse saved food logs, using defaults', e);
      }
    } else {
      // Default initial static logs to make the dashboard look nice on first load
      this.foodLogs = [
        {
          mealName: 'Greek Yogurt Bowl',
          calories: 320,
          protein: 24,
          carbs: 38,
          fat: 8,
          description: 'Greek yogurt with honey, granola, and mixed berries.'
        },
        {
          mealName: 'Grilled Chicken Salad',
          calories: 450,
          protein: 42,
          carbs: 18,
          fat: 22,
          description: 'Grilled chicken breast on mixed greens with olive oil dressing.'
        }
      ];
      localStorage.setItem('food_logs', JSON.stringify(this.foodLogs));
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

  clearFoodLogs(): void {
    if (confirm('Are you sure you want to clear all logs?')) {
      this.foodLogs = [];
      localStorage.setItem('food_logs', JSON.stringify(this.foodLogs));
      this.calculateTotals();
    }
  }

  // Vision Analysis Operations
  async triggerDemoAnalysis(demo: any): Promise<void> {
    this.isAnalyzing = true;
    this.analysisError = null;
    this.uploadedFileName = demo.name;

    try {
      if (this.geminiService.hasApiKey() && !this.geminiService.getApiKey()?.startsWith('AIzaSyMock')) {
        const result = await this.geminiService.analyzeFoodImage(demo.base64, demo.mimeType);
        this.addFoodLog(result);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1500));
        const result: FoodAnalysisResult = {
          mealName: demo.name,
          calories: demo.calories,
          protein: demo.protein,
          carbs: demo.carbs,
          fat: demo.fat,
          description: demo.description
        };
        this.addFoodLog(result);
      }
    } catch (err: any) {
      this.analysisError = err?.message || 'Failed to analyze food image.';
    } finally {
      this.isAnalyzing = false;
    }
  }

  // File Upload Handling
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    this.uploadedFileName = file.name;
    this.isAnalyzing = true;
    this.analysisError = null;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const base64Data = e.target.result;
      try {
        const result = await this.geminiService.analyzeFoodImage(base64Data, file.type);
        this.addFoodLog(result);
      } catch (err: any) {
        this.analysisError = err?.message || 'Gemini Vision analysis failed. Please verify your API Key and image.';
      } finally {
        this.isAnalyzing = false;
      }
    };
    reader.onerror = () => {
      this.analysisError = 'Failed to read image file.';
      this.isAnalyzing = false;
    };
    reader.readAsDataURL(file);
  }

  addFoodLog(result: FoodAnalysisResult): void {
    this.latestAnalysis = result;
    this.foodLogs.unshift(result);
    localStorage.setItem('food_logs', JSON.stringify(this.foodLogs));
    this.calculateTotals();
  }

  clearLatestAnalysis(): void {
    this.latestAnalysis = null;
  }

  // Progress Percentages
  getCaloriePercentage(): number {
    return Math.min(100, Math.round((this.consumedCalories / this.targetCalories) * 100));
  }

  getProteinPercentage(): number {
    return Math.min(100, Math.round((this.consumedProtein / this.targetProtein) * 100));
  }

  getCarbsPercentage(): number {
    return Math.min(100, Math.round((this.consumedCarbs / this.targetCarbs) * 100));
  }

  getFatPercentage(): number {
    return Math.min(100, Math.round((this.consumedFat / this.targetFat) * 100));
  }

  // Helpers for formatting
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
