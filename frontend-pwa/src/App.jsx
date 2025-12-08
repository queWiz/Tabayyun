import React, { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import { postprocess } from "./utils/yolo_utils";

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  
  // State
  const [model, setModel] = useState(null);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);

  // Configuration
  // Roboflow usually sorts classes alphabetically (A-Z)
  const CLASS_NAMES = [
    'banana_milk',       // B
    'buldak_carbonara',  // B (bu comes after ba)
    'pepero',            // P
    'shin_ramyun',       // S (sh)
    'soju'               // S (so)
  ]; 
  const THRESHOLD = 0.50; // 50% Confidence needed

  // 1. Load Resources (Brain & Memory)
  useEffect(() => {
    const loadResources = async () => {
      try {
        await tf.ready();
        const loadedModel = await tf.loadGraphModel("/model/model.json");
        
        const dbResponse = await fetch("/db/products.json");
        const loadedDb = await dbResponse.json();

        setModel(loadedModel);
        setDb(loadedDb);
        setLoading(false);
        console.log("✅ System Ready");
      } catch (err) {
        console.error("Failed to load resources", err);
      }
    };
    loadResources();
  }, []);

  // 2. The Loop: Run Detection every 500ms (or faster)
  useEffect(() => {
    if (!model || loading) return;

    const interval = setInterval(() => {
      detectFrame();
    }, 100); // 10 FPS

    return () => clearInterval(interval);
  }, [model, loading]);

  // 3. Detection Logic
  const detectFrame = async () => {
    if (
      typeof webcamRef.current !== "undefined" &&
      webcamRef.current !== null &&
      webcamRef.current.video.readyState === 4
    ) {
      const video = webcamRef.current.video;
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      canvasRef.current.width = videoWidth;
      canvasRef.current.height = videoHeight;

      // 1. Prepare Input
      // tf.tidy cleans up intermediate tensors automatically
      const res = tf.tidy(() => {
        const input = tf.image
          .resizeBilinear(tf.browser.fromPixels(video), [640, 640])
          .div(255.0)
          .expandDims(0);
        
        // OPTIMIZATION: Use execute() instead of executeAsync()
        // It's faster for this specific model type
        return model.execute(input);
      });

      // 2. Post-Process (Now Async!)
      // We must await it because we switched to nonMaxSuppressionAsync
      const detections = await postprocess(res, CLASS_NAMES.length, THRESHOLD);
      
      // Clean up the result tensor manually (tf.tidy doesn't catch async returns)
      tf.dispose(res);

      drawResults(detections, videoWidth, videoHeight);
    }
  };

  // 4. Drawing Logic
  const drawResults = (detections, vWidth, vHeight) => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, vWidth, vHeight); // Clear previous frame

    detections.forEach((det) => {
      const { box, classId, score } = det;
      const [x, y, w, h] = box;

      // Scale boxes from 640x640 back to video size
      const scaleX = vWidth / 640;
      const scaleY = vHeight / 640;

      const finalX = x * scaleX;
      const finalY = y * scaleY;
      const finalW = w * scaleX;
      const finalH = h * scaleY;

      // Get Data from JSON Memory
      const classKey = CLASS_NAMES[classId];
      const productInfo = db[classKey];

      // Default Style if product not found in DB
      let color = "white";
      let label = classKey;
      let status = "Unknown";

      if (productInfo) {
        color = productInfo.color || "white";
        label = productInfo.name_en;
        status = productInfo.status;
      }

      // Draw Box
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.strokeRect(finalX, finalY, finalW, finalH);

      // Draw Label Background
      ctx.fillStyle = color;
      ctx.font = "18px Arial";
      const text = `${label} (${status})`;
      const textWidth = ctx.measureText(text).width;
      ctx.fillRect(finalX, finalY - 25, textWidth + 10, 25);

      // Draw Text
      ctx.fillStyle = "black";
      ctx.fillText(text, finalX + 5, finalY - 7);
    });
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh", backgroundColor: "black" }}>
      {loading && <h2 style={{ color: "white", textAlign: "center", zIndex: 20 }}>Starting TBYN System...</h2>}
      
      {/* 1. Camera Layer */}
      <Webcam
        ref={webcamRef}
        muted={true} 
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 9,
          width: "640px",  // Fixed size for debugging
          height: "480px", // Fixed size for debugging
        }}
        // "user" works on laptops. "environment" works on phones.
        videoConstraints={{ facingMode: "user" }} 
      />

      {/* 2. Drawing Layer (Canvas) */}
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10,
          width: "640px",  // Match webcam size
          height: "480px", // Match webcam size
        }}
      />
    </div>
  );
}

export default App;