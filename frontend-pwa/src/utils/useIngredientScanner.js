import { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';

export const useIngredientScanner = () => {
  const [database, setDatabase] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  
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

  const resizeImage = (imageSrc) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const targetWidth = 800; // Downsample to remove noise
        const scale = targetWidth / img.width;
        scaleRef.current = scale; 
        
        canvas.width = targetWidth;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg'));
      };
    });
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
      report("🧪 TEST: Resizing + English Only...");
      const processedImage = await resizeImage(originalImageSrc);

      // --- ISOLATION TEST: ENGLISH ONLY ---
      // If boxes appear now, we know 'eng+kor' was the problem.
      const { data } = await Tesseract.recognize(
        processedImage,
        'eng', 
        { 
            // Using Default PSM (3) 
        }
      );

      const cleanText = cleanOCRText(data.text); 
      const words = data.words || [];

      // Debug: Check if HOCR has coordinates (Backup check)
      const hasHocrCoords = data.hocr && data.hocr.includes("bbox");

      report(`📊 Words: ${words.length} | HOCR Coords: ${hasHocrCoords ? "Yes" : "No"}`);

      // 1. Detection (Logic still works for codes like E120 even in English mode)
      const fuse = new Fuse(database, {
        keys: ['code', 'name_en'], 
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
             const s = scaleRef.current;
             boxesToDraw.push({
               x0: wordObj.bbox.x0 / s,
               y0: wordObj.bbox.y0 / s,
               x1: wordObj.bbox.x1 / s,
               y1: wordObj.bbox.y1 / s
             });
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