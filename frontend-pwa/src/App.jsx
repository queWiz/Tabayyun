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

  const { scanImage, scanResult, extractedText, isScanning } = useIngredientScanner();
  const THRESHOLD = 0.50; 

  const videoConstraints = {
    facingMode: "environment", 
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

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
      let label = productInfo ? productInfo.name_en : classKey;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(finalX, finalY, finalW, finalH);
      
      // Draw Label Background
      ctx.fillStyle = color;
      ctx.font = "bold 16px sans-serif";
      const text = ` ${label} `;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(finalX, finalY - 26, textWidth, 26);
      
      // Draw Label Text
      ctx.fillStyle = "black"; // Always black text on colored bg
      ctx.fillText(text, finalX, finalY - 8);
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
           <div className="snapshot-wrapper">
             <img src={snapshot} alt="Captured" /> 
             <div className="text-overlay">
                <h3>Detected Text</h3>
                <div className="scrolled-text">
                   <HighlightedText text={extractedText} risks={scanResult || []} />
                </div>
             </div>
           </div>
        ) : (
           <>
             <Webcam
                ref={webcamRef}
                muted={true}
                screenshotFormat="image/jpeg"
                className="camera-feed"
                videoConstraints={videoConstraints}
             />
             {mode === "visual" && <canvas ref={canvasRef} className="drawing-canvas" />}
           </>
        )}
      </div>

      <div className="ui-layer">
        {!snapshot && (
          <div className="mode-switcher-container">
            <div className="mode-switcher">
              <button className={`mode-btn ${mode === 'visual' ? 'active' : ''}`} onClick={() => setMode('visual')}>Scanner</button>
              <button className={`mode-btn ${mode === 'text' ? 'active' : ''}`} onClick={() => setMode('text')}>Inspector</button>
            </div>
          </div>
        )}

        {mode === "text" && !snapshot && (
          <div className="scanner-controls">
            <button className="capture-btn" onClick={handleCapture}></button>
          </div>
        )}

        {isScanning && (
          <div className="result-modal" style={{justifyContent: 'center', alignItems: 'center'}}>
            <div className="spinner"></div>
            <h3 style={{margin:0, color:'#333'}}>Analyzing Text...</h3>
          </div>
        )}

        {snapshot && !isScanning && (
           <div className="result-modal">
             <div className="results-header">
               <h3>Analysis Result</h3>
             </div>
             
             <div className="results-list">
               {(!scanResult || scanResult.length === 0) ? (
                  <div className="safe-item">
                    ✅ Safe to Eat?
                    <div style={{fontSize:'13px', fontWeight:'normal', marginTop:'5px', color:'#1B5E20'}}>
                       No common haram ingredients detected.
                    </div>
                  </div>
               ) : (
                  <div>
                    <p style={{fontSize:'13px', color:'#666', marginBottom:'10px'}}>
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