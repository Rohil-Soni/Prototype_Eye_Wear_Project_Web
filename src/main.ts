// src/main.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

let faceLandmarker: FaceLandmarker | null = null;
const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');

// Use non-null assertion after null-check
const app = document.querySelector<HTMLDivElement>('#app')!;

if (!app) {
  throw new Error('Root element #app not found');
}

// Initialize MediaPipe
async function initMediaPipe() {
  try {
    console.log('📦 Loading MediaPipe...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        // CORRECT PATH with /float16/1/ subdirectory
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
      },
      runningMode: 'VIDEO' as const,
      numFaces: 1
    });

    console.log('✅ MediaPipe Ready');
  } catch (error) {
    console.error('❌ MediaPipe Error:', error);
    throw error;
  }
}

// Setup camera
async function setupCamera(): Promise<boolean> {
  try {
    console.log('📷 Requesting camera...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } }
    });

    videoElement.srcObject = stream;
    videoElement.play();
    console.log('✅ Camera Active');

    return new Promise<boolean>((resolve) => {
      videoElement.onloadedmetadata = () => {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        console.log(`✅ Canvas: ${canvasElement.width}x${canvasElement.height}`);
        resolve(true);
      };
    });
  } catch (error) {
    console.error('❌ Camera Error:', error);
    throw error;
  }
}

// Draw stylized glasses with two lenses + nose bridge
function drawGlasses(landmarks: any[]): void {
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return;

  // Base camera image
  ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  ctx.drawImage(videoElement, 0, 0);

  // ---- 1. Key landmarks ----
  const leftEyeOuter = landmarks[33];   // left eye outer
  const leftEyeInner = landmarks[133];  // left eye inner
  const rightEyeOuter = landmarks[263]; // right eye outer
  const rightEyeInner = landmarks[362]; // right eye inner
  const noseBridge = landmarks[168];    // between eyes

  if (!leftEyeOuter || !rightEyeOuter || !noseBridge) {
    return;
  }

  // Convert to pixel coords
  const lx = leftEyeOuter.x * canvasElement.width;
  const ly = leftEyeOuter.y * canvasElement.height;
  const lix = leftEyeInner.x * canvasElement.width;
  const liy = leftEyeInner.y * canvasElement.height;

  const rx = rightEyeOuter.x * canvasElement.width;
  const ry = rightEyeOuter.y * canvasElement.height;
  const rix = rightEyeInner.x * canvasElement.width;
  const riy = rightEyeInner.y * canvasElement.height;

  const nx = noseBridge.x * canvasElement.width;
  const ny = noseBridge.y * canvasElement.height;

  // ---- 2. Compute lens size ----
  // Left lens: distance between outer and inner
  const leftLensRadius = Math.hypot(lx - lix, ly - liy) * 0.6;
  const rightLensRadius = Math.hypot(rx - rix, ry - riy) * 0.6;

  // Left and right lens centers
  const leftCenterX = (lx + lix) / 2;
  const leftCenterY = (ly + liy) / 2;
  const rightCenterX = (rx + rix) / 2;
  const rightCenterY = (ry + riy) / 2;

  // ---- 3. Draw styles ----
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';  // black frame
  ctx.fillStyle = 'rgba(100, 150, 200, 0.15)'; // light blue tint
  ctx.lineWidth = 3;

  // Left lens (circle)
  ctx.beginPath();
  ctx.arc(leftCenterX, leftCenterY, leftLensRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Right lens (circle)
  ctx.beginPath();
  ctx.arc(rightCenterX, rightCenterY, rightLensRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Nose bridge (connector line)
  ctx.beginPath();
  ctx.moveTo(leftCenterX + leftLensRadius * 0.3, leftCenterY);
  ctx.lineTo(rightCenterX - rightLensRadius * 0.3, rightCenterY);
  ctx.stroke();

  // Optional: top frame bar connecting lenses
  ctx.beginPath();
  ctx.moveTo(leftCenterX - leftLensRadius * 0.3, leftCenterY - leftLensRadius * 0.3);
  ctx.lineTo(rightCenterX + rightLensRadius * 0.3, rightCenterY - rightLensRadius * 0.3);
  ctx.stroke();

  // Optional: small decorative nose pads
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.arc(nx - 3, ny, 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(nx + 3, ny, 2, 0, 2 * Math.PI);
  ctx.fill();
}


// Detection loop
async function detect(): Promise<void> {
  if (!faceLandmarker || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const results = faceLandmarker.detectForVideo(videoElement, performance.now());

    if (results.faceLandmarks && results.faceLandmarks.length > 0) 
    {
      const landmarks = results.faceLandmarks[0];
      // console.log(`✓ Face: ${landmarks.length} landmarks`);
      drawGlasses(landmarks);
    }
  } catch (error) {
    console.error('Detection Error:', error);
  }

  requestAnimationFrame(detect);
}

// Main
async function main(): Promise<void> {
  try {
    console.log('🚀 Initializing...');
    await initMediaPipe();
    await setupCamera();

    app.style.margin = '0';
    app.style.padding = '0';
    app.style.width = '100vw';
    app.style.height = '100vh';
    app.style.overflow = 'hidden';
    app.textContent = '';
    app.appendChild(canvasElement);

    canvasElement.style.display = 'block';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';

    console.log('✅ Ready - Detecting faces...');
    detect();
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

main();
