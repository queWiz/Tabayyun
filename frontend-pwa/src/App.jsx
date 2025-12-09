import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import { postprocess } from "./utils/yolo_utils";
import { useIngredientScanner } from "./utils/useIngredientScanner";
import "./App.css";
import { HighlightedText } from "./utils/textHighlighter";


function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null); 
  
  const [mode, setMode] = useState("visual"); 
  const [model, setModel] = useState(null);
  const [productsDb, setProductsDb] = useState(null);
  const [classNames, setClassNames] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [snapshot, setSnapshot] = useState(null); 

  const { scanImage, scanResult, boundingBoxes, isScanning, dbSize, extractedText } = useIngredientScanner();
  const THRESHOLD = 0.50; 

  const videoConstraints = {
    facingMode: { exact: "environment" }, // Force Back Camera
    width: { ideal: 1280 },               // Ask for 720p (HD)
    height: { ideal: 720 }
  };
  const [debugLog, setDebugLog] = useState("Ready.");


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
      setDebugLog("Starting Scan..."); // Reset log
      // Pass the setter as the callback
      scanImage(imageSrc, (msg) => setDebugLog(msg));
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
             {/* Show the photo the user took */}
             <img src={snapshot} alt="Captured" style={{opacity: 0.4}} /> 
             
             {/* Show the TEXT TRANSCRIPT on top */}
             <div className="text-overlay">
                <h3>📜 Detected Text:</h3>
                <div className="scrolled-text">
                   <HighlightedText text={extractedText} risks={scanResult || []} />
                </div>
             </div>
           </div>
        ) : (
           /* LIVE VIEW */
           <>
             <Webcam
                ref={webcamRef}
                muted={true}
                screenshotFormat="image/jpeg"
                className="camera-feed"
                videoConstraints={{ facingMode: "environment" }}
             />
             {mode === "visual" && <canvas ref={canvasRef} className="drawing-canvas" />}
           </>
        )}
      </div>

      <div style={{
        position: 'absolute', 
        top: '60px', 
        left: '10px', 
        zIndex: 999, 
        color: 'lime', 
        background: 'rgba(0,0,0,0.7)', 
        padding: '5px',
        fontSize: '10px',
        maxWidth: '200px',
        pointerEvents: 'none'
      }}>
        LOG: {debugLog}
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
                  <div className="safe-item">✅ Safe to Eat? (No risks found)</div>
               ) : (
                  <div>
                    <p style={{color:'#c62828', fontWeight:'bold', margin:'0 0 10px 0'}}>
                      ⚠️ Found {scanResult.length} Warnings:
                    </p>
                    {scanResult.map((item, idx) => (
                      <div key={idx} className="risk-item">
                        <strong>{item.name_en}</strong> ({item.status})
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