import { Injectable } from '@angular/core';

export interface FoodAnalysisResult {
  mealName: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

  constructor() {}

  /**
   * Saves the Gemini API key to local storage
   */
  saveApiKey(key: string): void {
    localStorage.setItem('gemini_api_key', key.trim());
  }

  /**
   * Retrieves the Gemini API key from local storage
   */
  getApiKey(): string | null {
    return localStorage.getItem('gemini_api_key');
  }

  /**
   * Clears the Gemini API key from local storage
   */
  clearApiKey(): void {
    localStorage.removeItem('gemini_api_key');
  }

  /**
   * Checks if an API key exists in local storage
   */
  hasApiKey(): boolean {
    const key = this.getApiKey();
    return !!key && key.length > 10;
  }

  /**
   * Analyzes an image of food using Gemini Vision and returns nutritional estimates.
   * @param base64Image The base64 string of the image (without the data:image/*;base64 prefix)
   * @param mimeType The mime type of the image, e.g. "image/jpeg"
   */
  async analyzeFoodImage(base64Image: string, mimeType: string): Promise<FoodAnalysisResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key is not configured.');
    }

    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this food image. Provide the name of the meal and estimated macronutrients. 
Respond ONLY with a JSON object containing the nutritional values. Do not write any markdown wrappers (like \`\`\`json) or extra text.
The JSON format MUST be exactly:
{
  "mealName": "Name of the meal",
  "calories": 450,
  "protein": 25,
  "carbs": 40,
  "fat": 15,
  "description": "A brief description of what this meal appears to consist of."
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

      // Parse the JSON response
      const parsedResult: FoodAnalysisResult = JSON.parse(textResponse.trim());
      
      // Ensure all fields are populated correctly with defaults if missing
      return {
        mealName: parsedResult.mealName || 'Unknown Meal',
        calories: Number(parsedResult.calories) || 0,
        protein: Number(parsedResult.protein) || 0,
        carbs: Number(parsedResult.carbs) || 0,
        fat: Number(parsedResult.fat) || 0,
        description: parsedResult.description || 'No description provided.'
      };
    } catch (error) {
      console.error('Error analyzing food image with Gemini:', error);
      throw error;
    }
  }
}
