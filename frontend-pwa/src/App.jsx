import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import { postprocess } from "./utils/yolo_utils";
import { useIngredientScanner } from "./utils/useIngredientScanner";
import "./App.css";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null); 
  const overlayRef = useRef(null); 
  
  const [mode, setMode] = useState("visual"); 
  const [model, setModel] = useState(null);
  const [productsDb, setProductsDb] = useState(null);
  const [classNames, setClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [snapshot, setSnapshot] = useState(null); 

  const { scanImage, scanResult, boundingBoxes, isScanning, dbSize } = useIngredientScanner();
  const THRESHOLD = 0.50; 

  // 1. Load Resources
  useEffect(() => {
    const loadResources = async () => {
      try {
        await tf.ready();
        const loadedModel = await tf.loadGraphModel("/model/model.json");
        const dbResponse = await fetch("/db/products.json");
        const loadedDb = await dbResponse.json();
        const keys = Object.keys(loadedDb).sort();
        
        setClassNames(keys);
        setModel(loadedModel);
        setProductsDb(loadedDb);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load resources", err);
      }
    };
    loadResources();
  }, []);

  // 2. Visual Loop
  useEffect(() => {
    if (!model || loading || mode !== "visual" || snapshot) return;
    const interval = setInterval(() => detectFrame(), 100); 
    return () => clearInterval(interval);
  }, [model, loading, mode, snapshot]);

  // 3. DRAW OCR BOXES (Debugged)
  useEffect(() => {
    if (boundingBoxes.length > 0 && overlayRef.current && snapshot) {
      const ctx = overlayRef.current.getContext('2d');
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
      
      const img = new Image();
      img.src = snapshot;
      img.onload = () => {
         // IMPORTANT: Set canvas internal resolution to match the RAW image
         overlayRef.current.width = img.width;
         overlayRef.current.height = img.height;

         ctx.strokeStyle = '#ff0000'; 
         ctx.lineWidth = 10; // Thicker lines for High Res photos
         ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';

         boundingBoxes.forEach(bbox => {
           // bbox is now raw: {x0, y0, x1, y1}
           const w = bbox.x1 - bbox.x0;
           const h = bbox.y1 - bbox.y0;
           
           ctx.strokeRect(bbox.x0, bbox.y0, w, h);
           ctx.fillRect(bbox.x0, bbox.y0, w, h);
         });
      };
    }
  }, [boundingBoxes, snapshot]);

  const detectFrame = async () => {
    if (webcamRef.current && webcamRef.current.video.readyState === 4) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;
      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;
      const res = tf.tidy(() => {
        const input = tf.image.resizeBilinear(tf.browser.fromPixels(video), [640, 640]).div(255.0).expandDims(0);
        return model.execute(input);
      });
      const detections = await postprocess(res, classNames.length, THRESHOLD);
      tf.dispose(res);
      drawResults(detections, videoWidth, videoHeight);
    }
  };

  const drawResults = (detections, vWidth, vHeight) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, vWidth, vHeight);
    detections.forEach((det) => {
      const { box, classId } = det;
      const [x, y, w, h] = box;
      const scaleX = vWidth / 640;
      const scaleY = vHeight / 640;
      const finalX = x * scaleX;
      const finalY = y * scaleY;
      const finalW = w * scaleX;
      const finalH = h * scaleY;
      const classKey = classNames[classId];
      const productInfo = productsDb[classKey];
      let color = productInfo ? productInfo.color : "white";
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(finalX, finalY, finalW, finalH);
      ctx.fillStyle = color;
      ctx.font = "18px Arial";
      ctx.fillText(classKey, finalX + 5, finalY - 7);
    });
  };

  const handleCapture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setSnapshot(imageSrc);
      scanImage(imageSrc);
    }
  }, [webcamRef, scanImage]);

  const clearSnapshot = () => {
    setSnapshot(null);
  };

  return (
    <div className="app-container">
      {loading && <div className="loading-screen"><h2>Starting Tabayyun...</h2></div>}

      <div style={{position: 'relative', width:'100%', height:'100%'}}>
        {snapshot ? (
           /* SNAPSHOT VIEW */
           <div className="snapshot-wrapper">
             <img src={snapshot} alt="Captured" className="camera-feed" />
             <canvas ref={overlayRef} className="drawing-canvas" />
           </div>
        ) : (
           /* LIVE VIEW */
           <>
             <Webcam
                ref={webcamRef}
                muted={true}
                screenshotFormat="image/jpeg"
                className="camera-feed"
                videoConstraints={{ facingMode: "user" }}
             />
             {mode === "visual" && <canvas ref={canvasRef} className="drawing-canvas" />}
           </>
        )}
      </div>

      <div className="ui-layer">
        
        {/* 1. Header (Mode Switcher) */}
        {!snapshot && (
          <div className="mode-switcher-container">
            <div className="mode-switcher">
              <button 
                className={`mode-btn ${mode === 'visual' ? 'active' : ''}`} 
                onClick={() => setMode('visual')}
              >
                Scanner
              </button>
              <button 
                className={`mode-btn ${mode === 'text' ? 'active' : ''}`} 
                onClick={() => setMode('text')}
              >
                Inspector
              </button>
            </div>
          </div>
        )}

        {/* 2. Capture Button (THE MISSING PART?) */}
        {/* Only show in TEXT mode and when NOT showing a result */}
        {mode === "text" && !snapshot && (
          <div className="scanner-controls">
            {/* We removed the camera emoji, the CSS now makes the shape */}
            <button className="capture-btn" onClick={handleCapture}></button>
          </div>
        )}

        {/* 3. Loading Indicator */}
        {isScanning && (
          <div className="result-modal" style={{textAlign:'center', paddingBottom: '30px'}}>
            <div className="spinner"></div>
            <h3>🔍 Analyzing Text...</h3>
          </div>
        )}

        {/* 4. Results Modal */}
        {snapshot && !isScanning && (
           <div className="result-modal">
             <div className="results-header">
               <h3>Analysis Result</h3>
             </div>
             
             <div className="results-list">
               {(!scanResult || scanResult.length === 0) ? (
                  <div className="safe-item">
                    ✅ Safe to Eat?
                    <div style={{fontSize:'13px', fontWeight:'normal', marginTop:'5px', color:'var(--safe)'}}>
                       No common haram ingredients detected.
                    </div>
                  </div>
               ) : (
                  <div>
                    <p style={{fontSize:'13px', color:'var(--text-sub)', marginBottom:'10px'}}>
                      Detected {scanResult.length} potential issues:
                    </p>
                    {scanResult.map((item, idx) => (
                      <div key={idx} className="risk-item">
                        <span className="risk-name">{item.name_en}</span>
                        <span className="risk-detail">{item.status} ({item.code || "Ingredient"})</span>
                      </div>
                    ))}
                  </div>
               )}
             </div>

             <button className="nice-close-btn" onClick={clearSnapshot}>
               Done
             </button>
           </div>
        )}
      </div>
    </div>
  );
}

export default App;