import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export interface FoodAnalysisResult {
  mealName: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  description: string;
  vitamins?: string[];
  minerals?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent';

  constructor() {}

  /**
   * Saves the Gemini API key to Capacitor Preferences and local storage
   */
  async saveApiKey(key: string): Promise<void> {
    await Preferences.set({ key: 'gemini_api_key', value: key.trim() });
    localStorage.setItem('gemini_api_key', key.trim());
  }

  /**
   * Retrieves the Gemini API key from Capacitor Preferences or local storage fallback
   */
  async getApiKey(): Promise<string | null> {
    const { value } = await Preferences.get({ key: 'gemini_api_key' });
    if (value) return value;
    return localStorage.getItem('gemini_api_key');
  }

  /**
   * Clears the Gemini API key from Preferences and local storage
   */
  async clearApiKey(): Promise<void> {
    await Preferences.remove({ key: 'gemini_api_key' });
    localStorage.removeItem('gemini_api_key');
  }

  /**
   * Checks if an API key exists in Preferences or local storage
   */
  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return !!key && key.length > 10;
  }

  /**
   * Cleans and parses a JSON response from Gemini, removing any markdown code blocks.
   */
  private cleanAndParseJson(text: string): any {
    let cleanText = text.trim();
    
    // Remove markdown code block formatting if present
    if (cleanText.startsWith('```')) {
      const firstNewLine = cleanText.indexOf('\n');
      if (firstNewLine !== -1) {
        cleanText = cleanText.substring(firstNewLine).trim();
      }
      if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3).trim();
      }
    }
    
    // Extract JSON block if surrounded by other text
    try {
      return JSON.parse(cleanText);
    } catch (e) {
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonSub = cleanText.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonSub);
      }
      throw e;
    }
  }

  /**
   * Analyzes an image of food using Gemini Vision and returns nutritional estimates.
   * @param base64Image The base64 string of the image (without the data:image/*;base64 prefix)
   * @param mimeType The mime type of the image, e.g. "image/jpeg"
   */
  async analyzeFoodImage(base64Image: string, mimeType: string): Promise<FoodAnalysisResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this food image. Provide the name of the meal, estimated macronutrients, and list any significant vitamins and minerals present in the meal. 
Respond ONLY with a JSON object. Do not write any markdown wrappers (like \`\`\`json) or extra text.
The JSON format MUST be exactly:
{
  "mealName": "Name of the meal",
  "calories": 450,
  "protein": 25,
  "carbs": 40,
  "fat": 15,
  "description": "A brief description of what this meal appears to consist of.",
  "vitamins": ["Vitamin A", "Vitamin C"],
  "minerals": ["Calcium", "Iron"]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('No content returned from Gemini.');
      }

      // Parse the JSON response robustly
      const parsedResult: FoodAnalysisResult = this.cleanAndParseJson(textResponse);
      
      // Ensure all fields are populated correctly with defaults if missing
      return {
        mealName: parsedResult.mealName || 'Unknown Meal',
        calories: Number(parsedResult.calories) || 0,
        protein: Number(parsedResult.protein) || 0,
        carbs: Number(parsedResult.carbs) || 0,
        fat: Number(parsedResult.fat) || 0,
        description: parsedResult.description || 'No description provided.',
        vitamins: parsedResult.vitamins || [],
        minerals: parsedResult.minerals || []
      };
    } catch (error) {
      console.error('Error analyzing food image with Gemini:', error);
      throw error;
    }
  }

  /**
   * Analyzes food text entry using Gemini and returns parsed nutritional estimates.
   */
  async analyzeFoodText(textPrompt: string): Promise<FoodAnalysisResult> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const systemPrompt = `Analyze the following text input describing a meal or direct calorie/macro logging request.
If the input describes a meal (e.g. "I had a cup of rice and 100g of chicken breast"), estimate the calories, macronutrients (protein, carbs, fat in grams), and any significant vitamins/minerals present in it.
If the input specifies direct values, parse those values exactly. Set missing macros to reasonable estimates or 0.
Respond ONLY with a JSON object. Do not include markdown formatting or wrappers (like \`\`\`json).
The JSON format MUST be exactly:
{
  "mealName": "Short descriptive name of the food/entry",
  "calories": 450,
  "protein": 25,
  "carbs": 40,
  "fat": 15,
  "description": "Brief description of the logged items and values.",
  "vitamins": ["Vitamin B", "Vitamin D"],
  "minerals": ["Potassium", "Magnesium"]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            { text: `User input: "${textPrompt}"` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textResponse) {
        throw new Error('No content returned from Gemini.');
      }

      const parsedResult: FoodAnalysisResult = this.cleanAndParseJson(textResponse);
      
      return {
        mealName: parsedResult.mealName || 'Text Logged Food',
        calories: Number(parsedResult.calories) || 0,
        protein: Number(parsedResult.protein) || 0,
        carbs: Number(parsedResult.carbs) || 0,
        fat: Number(parsedResult.fat) || 0,
        description: parsedResult.description || 'Logged via Chat.',
        vitamins: parsedResult.vitamins || [],
        minerals: parsedResult.minerals || []
      };
    } catch (error) {
      console.error('Error analyzing food text with Gemini:', error);
      throw error;
    }
  }

  /**
   * Generates a comprehensive health and fitness summary of the day.
   */
  async generateDailySummary(
    foodLogs: any[],
    steps: number,
    sleepMinutes: number,
    targetCalories: number,
    targetProtein: number,
    targetCarbs: number,
    targetFat: number
  ): Promise<string> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const foodSummary = foodLogs.map(log => `- ${log.mealName}: ${log.calories} kcal (P:${log.protein}g, C:${log.carbs}g, F:${log.fat}g)`).join('\n');

    const prompt = `You are AETHER, a premium medical-grade AI nutrition and fitness advisor. 
Analyze the user's health metrics for today and construct a highly premium, concise daily summary.
Keep your analysis brief (under 120 words), direct, encouraging, and actionable. Write in high-end, clean markdown.

Here are the user's stats for today:
- Food entries:
${foodSummary || 'None logged yet'}
- Calorie target: ${targetCalories} kcal
- Protein target: ${targetProtein}g
- Carbs target: ${targetCarbs}g
- Fat target: ${targetFat}g
- Daily Steps: ${steps} (Goal: 10,000 steps)
- Sleep duration: ${Math.floor(sleepMinutes / 60)}h ${sleepMinutes % 60}m (Goal: 8 hours)

Provide your feedback in two sections:
1. **ACHIEVEMENTS**: What went well (concise bullet points).
2. **OPTIMIZATIONS**: Practical suggestions for tomorrow (concise bullet points).`;

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 250
      }
    };

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const textResponse = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        throw new Error('No content returned from Gemini.');
      }
      return textResponse.trim();
    } catch (error) {
      console.error('Error generating daily summary:', error);
      throw error;
    }
  }
}
