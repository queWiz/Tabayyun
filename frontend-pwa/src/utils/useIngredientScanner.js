import { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';

export const useIngredientScanner = () => {
  const [database, setDatabase] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  
  // We remove all scaling logic for this test to keep it raw
  const scaleRef = useRef(1);

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

  const scanImage = async (originalImageSrc, logCallback) => {
    if (database.length === 0) return;
    setIsScanning(true);
    setScanResult(null);
    setBoundingBoxes([]);

    const report = (msg) => {
        console.log(msg);
        if(logCallback) logCallback(msg);
    };

    try {
      report("🧪 DEBUG MODE: Starting...");

      // TEST 1: RAW IMAGE (No Canvas processing)
      // TEST 2: ENGLISH ONLY (Remove 'kor' to test segmentation)
      // TEST 3: PSM 6 (Assume uniform block)
      
      const { data } = await Tesseract.recognize(
        originalImageSrc,
        'eng', 
        {
          tessedit_pageseg_mode: '6',
        }
      );

      const cleanText = cleanOCRText(data.text);
      const words = data.words || [];

      // --- CRITICAL DEBUGGING ---
      console.log("--- RAW DEBUG DATA ---");
      console.log(`TEXT DETECTED: "${cleanText.substring(0, 50)}..."`);
      console.log(`WORDS ARRAY LENGTH: ${words.length}`);
      
      // Check if HOCR contains bbox coordinates even if words is empty
      const hasHocrCoordinates = data.hocr && data.hocr.includes("bbox");
      console.log(`HOCR CONTAINS BBOX? ${hasHocrCoordinates ? "YES" : "NO"}`);
      
      if (words.length > 0) {
          console.log(`FIRST WORD CONFIDENCE: ${words[0].confidence}`);
          console.log(`FIRST WORD BBOX:`, words[0].bbox);
      }
      console.log("----------------------");

      report(`Stats: ${words.length} words found. HOCR: ${hasHocrCoordinates ? "Yes" : "No"}`);

      // 1. Detection Logic
      const fuse = new Fuse(database, {
        keys: ['code', 'name_en'], // Removed name_kr for English test
        includeScore: true,
        threshold: 0.25, 
        ignoreLocation: true
      });

      const foundRisks = [];
      const boxesToDraw = [];
      const lowerText = cleanText.toLowerCase();

      database.forEach(ingredient => {
        const enMatch = ingredient.name_en && lowerText.includes(ingredient.name_en.toLowerCase());
        const codeMatch = ingredient.code && lowerText.includes(ingredient.code.toLowerCase());
        if (enMatch || codeMatch) foundRisks.push(ingredient);
      });

      const uniqueRisks = [...new Set(foundRisks)];
      setScanResult(uniqueRisks);

      // 2. Box Matching
      if (uniqueRisks.length > 0 && words.length > 0) {
        words.forEach(wordObj => {
          let wText = cleanOCRText(wordObj.text.trim());
          wText = wText.replace(/[^a-zA-Z0-9]/g, ''); 
          const wLower = wText.toLowerCase();

          if (wText.length < 2) return;

          const isRiskySegment = uniqueRisks.some(risk => {
             const riskCode = risk.code ? risk.code.toLowerCase() : "";
             const riskEn = risk.name_en ? risk.name_en.toLowerCase() : "";
             
             if (riskCode && wLower.includes(riskCode)) return true;
             if (riskEn && (riskEn.includes(wLower) || wLower.includes(riskEn))) return true;
             return false;
          });

          if (isRiskySegment && wordObj.bbox) {
             // Pass Raw Box (No scaling, assuming direct overlay)
             boxesToDraw.push(wordObj.bbox);
          }
        });
        
        setBoundingBoxes(boxesToDraw);
        report(`🎯 Drawing ${boxesToDraw.length} boxes.`);
      }

    } catch (err) {
      report(`❌ Error: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  return { scanImage, scanResult, boundingBoxes, isScanning, dbSize: database.length };
};