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
  onboardingStep = 1;
  showSettings = false;

  // Nutrition Goal and Intake State
  targetCalories = 2500;
  consumedCalories = 1250;
  
  targetProtein = 150;
  consumedProtein = 85;
  
  targetCarbs = 275;
  consumedCarbs = 140;
  
  targetFat = 80;
  consumedFat = 42;

  // Food Log History
  foodLogs: FoodAnalysisResult[] = [
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

  // Health Connect Metrics State
  healthConnectStatus: 'Available' | 'NotInstalled' | 'NotSupported' | 'Checking' = 'Checking';
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
    this.initHealthConnect();
  }

  // API Key checks
  checkApiKeyConfig(): void {
    this.hasApiKey = this.geminiService.hasApiKey();
    if (this.hasApiKey) {
      const key = this.geminiService.getApiKey();
      this.apiKeyInput = key ? `••••••••••••••••${key.slice(-4)}` : '';
    } else {
      this.apiKeyInput = '';
      this.onboardingStep = 1;
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

  resetApiKey(): void {
    this.geminiService.clearApiKey();
    this.hasApiKey = false;
    this.apiKeyInput = '';
    this.onboardingStep = 1;
  }

  // Health Connect operations
  async initHealthConnect(): Promise<void> {
    this.healthConnectStatus = await this.healthService.checkAvailability();
    if (this.healthConnectStatus === 'Available') {
      await this.syncHealthData();
    }
  }

  async requestHealthConnectPermission(): Promise<void> {
    const granted = await this.healthService.requestPermissions();
    if (granted) {
      await this.syncHealthData();
    }
  }

  async syncHealthData(): Promise<void> {
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

  // Vision Analysis Operations
  async triggerDemoAnalysis(demo: any): Promise<void> {
    this.isAnalyzing = true;
    this.analysisError = null;
    this.uploadedFileName = demo.name;

    try {
      // If a real key is present, attempt to analyze. Otherwise, use pre-mocked nutritional details.
      if (this.geminiService.hasApiKey() && !this.geminiService.getApiKey()?.startsWith('AIzaSyMock')) {
        const result = await this.geminiService.analyzeFoodImage(demo.base64, demo.mimeType);
        this.addFoodLog(result);
      } else {
        // Fallback to demo mock data after a small visual delay
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
    
    // Add nutrients to current total
    this.consumedCalories += result.calories;
    this.consumedProtein += result.protein;
    this.consumedCarbs += result.carbs;
    this.consumedFat += result.fat;
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

  nextOnboardingStep(): void {
    if (this.onboardingStep < 4) {
      this.onboardingStep++;
    }
  }

  prevOnboardingStep(): void {
    if (this.onboardingStep > 1) {
      this.onboardingStep--;
    }
  }
}
