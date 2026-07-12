# Vitality — Premium AI-Powered Nutrition & Health Tracker

Vitality is a high-end, responsive Capacitor web application that serves as an aesthetic, state-of-the-art personal health dashboard. It leverages Google Gemini's frontier Vision AI to log food instanteneously, and integrates Google Health Connect to seamlessly aggregate daily steps, sleep cycles, and exercise history.

[![Build Android Debug APK](https://github.com/balakamal/Nutrition-tracker/actions/workflows/android.yml/badge.svg)](https://github.com/balakamal/Nutrition-tracker/actions)

---

## 🚀 Key Features

*   **Gemini 3.5 Flash Vision AI:** Simply snap a picture or upload an image of your meal to analyze and estimate calories and macronutrients (protein, carbs, fats) instantly.
*   **Google Health Connect:** Natively syncs steps, sleep logs, and workout sessions directly from your device. Includes a robust, intelligent JS proxy fallback to simulate data on unsupported platforms (like Web browsers) or when native APIs are unavailable, detailing the exact initialization status.
*   **Professional Color & UI Palette:** Features a cohesive, highly refined dark-slate and light-mode dashboard theme with responsive system scheme detection. Standardized, symmetrical design shapes ensure a premium feel.
*   **Persistent Local Datastore:** All daily food logs, customized calorie goals, and nutrient details are stored and computed dynamically from `localStorage`, ensuring zero data loss on page refreshes.
*   **Signed Production Release Build:** Ready for testing and distribution out of the box, with automated release packaging in the CI pipeline.

---

## 📱 Get the Android Application

You can download the compiled production-ready **Release APK** directly from the CI build pipeline:

1.  Navigate to the [GitHub Actions Runs](https://github.com/balakamal/Nutrition-tracker/actions).
2.  Click on the latest successful run of the **Build Android Debug APK** (which builds the signed release).
3.  Scroll down to the **Artifacts** section at the bottom.
4.  Download **`app-release`** (contains the signed, installable `app-release.apk`).

*Note: Sideloading requires enabling "Install from unknown sources" on your Android device.*

---

## 🛠️ Tech Stack & Architecture

*   **Core Logic & Structure:** Angular 18 (Standalone components, reactive inputs).
*   **Mobile Wrapper & Core Sync:** Capacitor 6 (Syncing web assets to Gradle project).
*   **AI Vision Engine:** Google Gemini Developer API (using the latest stable `gemini-3.5-flash` model).
*   **Styling:** Pure, customized Vanilla CSS utilizing flexible design tokens, glassmorphic card overlays, and high-end animations.

---

## 💻 Local Development Setup

To run the application locally on your computer:

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/balakamal/Nutrition-tracker.git
    cd "Nutrition tracker"
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Start the Local Web Development Server:**
    ```bash
    npm run start
    ```
    Open your browser and navigate to `http://localhost:4200/`.

4.  **Sync Capacitor and Build for Android:**
    Ensure you have Android SDK and Gradle set up, then run:
    ```bash
    npm run build
    npx cap sync android
    ```
    To open and run the project inside Android Studio:
    ```bash
    npx cap open android
    ```
