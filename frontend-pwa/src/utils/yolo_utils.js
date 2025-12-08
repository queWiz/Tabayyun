import * as tf from '@tensorflow/tfjs';

/**
 * Async Post-Processing
 * Uses nonMaxSuppressionAsync to keep UI smooth
 */
export const postprocess = async (tensor, numClasses, threshold = 0.5) => {
  const shape = tensor.shape;
  const output = tensor.dataSync(); // Converting tensor to array is still sync (fast enough)
  
  const boxes = [];
  const scores = [];
  const classIds = [];

  const isChannelFirst = shape[1] < shape[2];
  const numAnchors = isChannelFirst ? shape[2] : shape[1];

  for (let i = 0; i < numAnchors; i++) {
    let prob = 0;
    let classId = -1;
    let xc, yc, w, h;

    if (isChannelFirst) {
      for (let c = 0; c < numClasses; c++) {
        const val = output[(4 + c) * numAnchors + i];
        if (val > prob) {
          prob = val;
          classId = c;
        }
      }
      if (prob > threshold) {
        xc = output[0 * numAnchors + i];
        yc = output[1 * numAnchors + i];
        w  = output[2 * numAnchors + i];
        h  = output[3 * numAnchors + i];
      }
    } else {
      const offset = i * (4 + numClasses);
      for (let c = 0; c < numClasses; c++) {
        const val = output[offset + 4 + c];
        if (val > prob) {
          prob = val;
          classId = c;
        }
      }
      if (prob > threshold) {
        xc = output[offset + 0];
        yc = output[offset + 1];
        w  = output[offset + 2];
        h  = output[offset + 3];
      }
    }

    if (prob > threshold) {
      const x = xc - w / 2;
      const y = yc - h / 2;
      boxes.push([x, y, w, h]);
      scores.push(prob);
      classIds.push(classId);
    }
  }

  if (boxes.length === 0) return [];

  // --- OPTIMIZATION: Async NMS ---
  const nmsTensor = await tf.image.nonMaxSuppressionAsync(
    tf.tensor2d(boxes),
    tf.tensor1d(scores),
    10, 
    0.5, 
    0.3
  );

  const resultIndices = nmsTensor.dataSync();
  nmsTensor.dispose();

  const indicesArray = Array.from(resultIndices); 

  return indicesArray.map(idx => ({
    box: boxes[idx],
    score: scores[idx],
    classId: classIds[idx]
  }));
};