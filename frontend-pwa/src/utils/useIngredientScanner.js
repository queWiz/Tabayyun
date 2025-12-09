import { useState, useEffect } from 'react';
import Tesseract from 'tesseract.js';
import Fuse from 'fuse.js';

export const useIngredientScanner = () => {
  const [database, setDatabase] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [boundingBoxes, setBoundingBoxes] = useState([]);
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

  const scanImage = async (originalImageSrc, logCallback) => {
    if (database.length === 0) return;
    setIsScanning(true);
    setScanResult(null);
    setBoundingBoxes([]);

    // Helper to log to console AND UI
    const log = (msg) => {
        console.log(msg);
        if(logCallback) logCallback(msg);
    };


    try {
      console.log("📷 Sending RAW Image to Tesseract (Default Mode)...");
      log("📷 Processing Image...");

      const { data } = await Tesseract.recognize(
        originalImageSrc,
        'eng+kor'
      );

      const cleanText = cleanOCRText(data.text); 
      
      // --- DIAGNOSTIC LOGS ---
      console.log("📊 Tesseract Data Keys:", Object.keys(data));
      console.log(`   Words: ${data.words ? data.words.length : 0}`);
      console.log(`   Lines: ${data.lines ? data.lines.length : 0}`);
      console.log(`   Blocks: ${data.blocks ? data.blocks.length : 0}`);
      console.log(`   Symbols: ${data.symbols ? data.symbols.length : 0}`); // Individual letters

      // FALLBACK CASCADE: Try Words -> Lines -> Blocks -> Paragraphs
      let segments = [];
      if (data.words && data.words.length > 0) segments = data.words;
      else if (data.lines && data.lines.length > 0) segments = data.lines;
      else if (data.blocks && data.blocks.length > 0) segments = data.blocks;
      
      log(`📦 Segments Found: ${segments.length}`);
      console.log(`📦 Using ${segments.length} segments for boxes.`);
      console.log("📝 Raw Text:", cleanText);

      // 1. Detection Logic (Populate Red List)
      const fuse = new Fuse(database, {
        keys: ['code', 'name_en', 'name_kr'],
        includeScore: true,
        threshold: 0.25, 
        ignoreLocation: true
      });

      const foundRisks = [];
      const boxesToDraw = [];
      const lowerText = cleanText.toLowerCase();

      database.forEach(ingredient => {
        const enMatch = ingredient.name_en && lowerText.includes(ingredient.name_en.toLowerCase());
        const krMatch = ingredient.name_kr && lowerText.includes(ingredient.name_kr);
        const codeMatch = ingredient.code && lowerText.includes(ingredient.code.toLowerCase());
        if (enMatch || krMatch || codeMatch) foundRisks.push(ingredient);
      });

      const uniqueRisks = [...new Set(foundRisks)];
      setScanResult(uniqueRisks);

      // 2. Box Logic
      if (uniqueRisks.length > 0 && segments.length > 0) {
        
        segments.forEach(seg => {
          let segText = cleanOCRText(seg.text.trim());
          const segClean = segText.replace(/[^a-zA-Z0-9가-힣]/g, ''); 
          const wLower = segClean.toLowerCase();

          if (segClean.length < 2) return;

          const isRiskySegment = uniqueRisks.some(risk => {
             const riskCode = risk.code ? risk.code.toLowerCase() : "";
             const riskEn = risk.name_en ? risk.name_en.toLowerCase() : "";
             const riskKr = risk.name_kr ? risk.name_kr : "";
             
             if (riskCode && wLower.includes(riskCode)) return true;
             if (riskEn && (riskEn.includes(wLower) || wLower.includes(riskEn))) return true;
             if (riskKr && (riskKr.includes(segClean) || segClean.includes(riskKr))) return true;
             return false;
          });

          if (isRiskySegment && seg.bbox) {
             boxesToDraw.push(seg.bbox);
          }
        });
        
        // setBoundingBoxes(boxesToDraw);
      }

      log(`🎯 Risky Boxes: ${boxesToDraw.length}`);
      setBoundingBoxes(boxesToDraw);

    } catch (err) {
      console.error("OCR Error:", err);
    } finally {
      setIsScanning(false);
    }
  };

  return { scanImage, scanResult, boundingBoxes, isScanning, dbSize: database.length };
};