import { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';

export const useIngredientScanner = () => {
  const [database, setDatabase] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [extractedText, setExtractedText] = useState(""); // NEW: Store the full text
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    fetch('/db/additives.json')
      .then(res => res.json())
      .then(data => setDatabase(data))
      .catch(err => console.error("Failed to load DB", err));
  }, []);

  const cleanOCRText = (text) => {
    if (!text) return "";
    let clean = text.replace(/€/g, 'E').replace(/©/g, 'C');
    clean = clean.replace(/\b[60]([0-9]{3})\b/g, "E$1");
    clean = clean.replace(/\be([0-9]{3})\b/g, "E$1");
    return clean;
  };

  const scanImage = async (originalImageSrc) => {
    if (database.length === 0) return;
    setIsScanning(true);
    setScanResult(null);
    setExtractedText(""); // Reset text

    try {
      // 1. Run Tesseract (Raw Image is fine for Text-only)
      const { data } = await Tesseract.recognize(
        originalImageSrc,
        'eng+kor'
      );

      const cleanText = cleanOCRText(data.text);
      setExtractedText(cleanText); // Save text for UI

      // 2. Detection Logic
      const fuse = new Fuse(database, {
        keys: ['code', 'name_en', 'name_kr'],
        includeScore: true,
        threshold: 0.25, 
        ignoreLocation: true
      });

      const foundRisks = [];
      const lowerText = cleanText.toLowerCase();

      database.forEach(ingredient => {
        const enMatch = ingredient.name_en && lowerText.includes(ingredient.name_en.toLowerCase());
        const krMatch = ingredient.name_kr && lowerText.includes(ingredient.name_kr);
        const codeMatch = ingredient.code && lowerText.includes(ingredient.code.toLowerCase());
        if (enMatch || krMatch || codeMatch) foundRisks.push(ingredient);
      });

      const uniqueRisks = [...new Set(foundRisks)];
      setScanResult(uniqueRisks);

    } catch (err) {
      console.error("OCR Error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  return { scanImage, scanResult, extractedText, isScanning, dbSize: database.length };
};