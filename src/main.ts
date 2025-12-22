// src/main.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker;
const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Root element #app not found');
}

// Initialize MediaPipe
async function initMediaPipe() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
  );

  faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite'
    },
    runningMode: 'VIDEO',
    numFaces: 1
  });

  console.log('✓ MediaPipe loaded');
}

// Setup camera
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    videoElement.srcObject = stream;
    videoElement.play();

    console.log('✓ Camera active');

    // Wait for video to load
    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        resolve(true);
      };
    });
  } catch (error) {
    console.error('Camera access denied:', error);
    throw error;
  }
}

// Draw face landmarks on canvas
function drawLandmarks(landmarks: any[]) {
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  ctx.drawImage(videoElement, 0, 0);

  // Draw landmarks as small circles
  ctx.fillStyle = '#00ff00';
  landmarks.forEach((landmark) => {
    const x = landmark.x * canvasElement.width;
    const y = landmark.y * canvasElement.height;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fill();
  });
}

// Detection loop
async function detect() {
  if (!faceLandmarker || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(detect);
    return;
  }

  const results = faceLandmarker.detectForVideo(videoElement, performance.now());

  if (results.faceLandmarks && results.faceLandmarks.length > 0) {
    const landmarks = results.faceLandmarks[0];
    console.log('Face detected! Landmarks:', landmarks.length);
    drawLandmarks(landmarks);
  }

  requestAnimationFrame(detect);
}

// Main setup
async function main() {
  try {
    await initMediaPipe();
    await setupCamera();
    
    // Display canvas fullscreen
    app.style.margin = '0';
    app.style.padding = '0';
    app.style.width = '100vw';
    app.style.height = '100vh';
    app.appendChild(canvasElement);

    canvasElement.style.display = 'block';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';

    console.log('✓ Setup complete. Detecting faces...');
    detect();
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

main();
