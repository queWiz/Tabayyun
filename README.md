# Tabayyun 🔍

> An offline-first, hybrid AI Computer Vision PWA helping Muslim travelers navigate Korean/Other-Countries convenience stores.

![Project Status](https://img.shields.io/badge/Status-MVP_Complete-success)
![Tech Stack](https://img.shields.io/badge/Stack-React_|_TensorFlow.js_|_Tesseract-blue)
![Platform](https://img.shields.io/badge/Platform-Mobile_Web_(PWA)-orange)

## 💡 The Philosophy: Tabayyun (تَبَيُّن)
The name comes from the Arabic word **Tabayyun**, which means **"to verify," "to seek clarity," or "to investigate the truth before acting."**

In an era of complex food processing and chemical additives, it is often hard to know what we are consuming. This app embodies the spirit of *Tabayyun* by using technology to reveal the truth behind the label, empowering users to make informed, conscious choices about what they eat.

## 📖 The Problem
Muslim travelers in Korea often struggle to identify Halal-friendly snacks. 
1.  **Language Barrier:** Ingredient lists are in Korean (Hangul).
2.  **Hidden Ingredients:** E-numbers (e.g., E120/Cochineal) are not immediately obvious.
3.  **Visual Overload:** Convenience store shelves are crowded, making it hard to spot known safe products.

## 🚀 The Solution
Tabayyun is a **Hybrid AI Web App** that runs entirely in the browser (Edge AI). It uses two distinct AI engines to verify food safety:

### 1. 👁️ Visual Scanner (Object Detection)
*   **Tech:** YOLOv8 (Nano) converted to TensorFlow.js.
*   **Function:** Recognizes product packaging in real-time video feeds (30fps).
*   **Capability:** Instantly flags known items (e.g., "Shin Ramyun") with AR bounding boxes indicating Halal/Haram status.

### 2. 📝 Ingredient Inspector (OCR + NLP)
*   **Tech:** Tesseract.js (WASM) + Fuse.js (Fuzzy Matching).
*   **Function:** Reads raw text from ingredient labels.
*   **Capability:** Extracts text, cleans common OCR errors (e.g., correcting `6120` to `E120`), and cross-references a local database of 100+ additives to generate a safety report.

## 🛠️ Tech Stack

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React + Vite | UI/UX and PWA logic |
| **Vision AI** | YOLOv8n + TensorFlow.js | Real-time Object Detection |
| **Text AI** | Tesseract.js (WASM) | Optical Character Recognition (Eng/Kor) |
| **Search** | Fuse.js | Fuzzy string matching for ingredients |
| **Data Eng** | Python (Pandas) | Dataset curation & JSON generation |
| **Styling** | CSS3 | Glassmorphism & High-Contrast Mobile UI |

## 🧠 Technical Challenges & Solutions

### 1. Mobile Browser Memory Limits
**Challenge:** Running YOLO and Tesseract simultaneously crashed mobile browsers due to high RAM usage on 4K camera streams.
**Solution:** Implemented a dynamic resolution throttle. The app forces a **720p stream** for the video feed and downscales static snapshots to **800px width** before processing, reducing memory footprint by ~70% without losing accuracy.

### 2. OCR Noise & Layout Failure
**Challenge:** Tesseract failed to generate bounding boxes on sparse text (ingredient lists) due to layout analysis failures on mobile photos.
**Solution:** Pivoted to a **Transcript UI**. Instead of unstable AR boxes, the app generates a "Matrix-style" text overlay, highlighting detected risk words in Red within the scanned text. This proved 100% more reliable for user verification.

### 3. Heuristic Data Cleaning
**Challenge:** OCR often mistook `E` for `6` or `€` (e.g., reading `E120` as `6120`).
**Solution:** Built a custom Regex cleaning layer that detects context. If a number is preceded by specific artifacts, it is heuristically corrected before database matching.

## 📸 Screenshots

| Visual Scanner | Ingredient Inspector |
| :---: | :---: |
| *(Place Screenshot of Red Box here)* | *(Place Screenshot of Transcript here)* |

## 📦 Installation & Local Development

**Prerequisites:** Node.js 18+

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/Tabayyun.git
cd Tabayyun

# 2. Install Dependencies
cd frontend-pwa
npm install

# 3. Run Development Server
npm run dev

*Note: To run the Python data pipeline, navigate to `backend-ml` and install `requirements.txt`.*

## 🔮 Future Roadmap (Phase 2)
- [ ] **Supabase Integration:** Move from static JSON to PostgreSQL for dynamic database updates.
- [ ] **Barcode Scanning:** Add a fallback scanner for OpenFoodFacts API integration.
- [ ] **Crowdsourcing:** Allow users to tag and submit new products for review.