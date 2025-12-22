// src/main.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

// ===== MediaPipe globals =====
let faceLandmarker: FaceLandmarker | null = null;
const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');

// ===== Three.js globals =====
let threeRenderer: THREE.WebGLRenderer | undefined;
let threeScene: THREE.Scene | undefined;
let threeCamera: THREE.PerspectiveCamera | undefined;
let glassesModel: THREE.Object3D | null = null;
let threeCanvas: HTMLCanvasElement | undefined;

// ===== Adjustment parameters =====
const adjustments = {
  positionX: 0,      // horizontal offset
  positionY: -0.15,  // vertical offset (relative to eye distance)
  positionZ: 0,      // depth
  rotationX: 0,      // pitch (up/down)
  rotationY: 0,      // yaw (left/right)
  rotationZ: 0,      // roll (with head tilt - auto, but can add manual)
  scaleMultiplier: 0.0015, // size factor (eyeDistance * this)
  debugMode: true
};

// Root element
const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Root element #app not found');
}
const root = app as HTMLDivElement;

// ====================== MediaPipe init ======================
async function initMediaPipe() {
  try {
    console.log('📦 Loading MediaPipe...');
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
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

// ====================== Camera setup ======================
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

// ====================== Three.js overlay ======================
function initThreeOverlay() {
  const width = canvasElement.width;
  const height = canvasElement.height;

  threeScene = new THREE.Scene();
  threeScene.background = null; // transparent

  threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  threeCamera.position.z = 2;

  threeCanvas = document.createElement('canvas');
  threeCanvas.style.position = 'absolute';
  threeCanvas.style.top = '0';
  threeCanvas.style.left = '0';
  threeCanvas.style.width = '100%';
  threeCanvas.style.height = '100%';
  threeCanvas.style.pointerEvents = 'none';
  root.appendChild(threeCanvas);

  threeRenderer = new THREE.WebGLRenderer({
    canvas: threeCanvas,
    alpha: true,
    antialias: true
  });
  threeRenderer.setSize(width, height);
  threeRenderer.setPixelRatio(window.devicePixelRatio);

  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  threeScene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(0, 1, 2);
  threeScene.add(dir);

  // BOOKMARKED: 3D model loading disabled to show 2D canvas only
  /*
  const loader = new GLTFLoader();
  loader.load(
    '/models/glasses.glb', // put your model at public/models/glasses.glb
    (gltf) => {
      glassesModel = gltf.scene;
      glassesModel.traverse((child) => {
        if ((child as any).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      // Initial scale; will be overridden each frame but good as a default
      glassesModel.scale.set(0.1, 0.1, 0.1);
      if (threeScene) {
        threeScene.add(glassesModel);
      }
      console.log('✅ Glasses model loaded');
    },
    undefined,
    (err) => {
      console.error('❌ Failed to load glasses model', err);
    }
  );
  */
}

// ====================== Draw 2D + drive 3D ======================
function drawGlasses(landmarks: any[]): void {
  const ctx = canvasElement.getContext('2d');
  if (!ctx) return;

  const w = canvasElement.width;
  const h = canvasElement.height;

  // Base camera image
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(videoElement, 0, 0);

  // Key landmarks
  const leftEyeOuter = landmarks[33];
  const leftEyeInner = landmarks[133];
  const rightEyeOuter = landmarks[263];
  const rightEyeInner = landmarks[362];
  const noseBridge = landmarks[168];

  if (!leftEyeOuter || !rightEyeOuter || !noseBridge) return;

  // Pixel coords
  const lx = leftEyeOuter.x * w;
  const ly = leftEyeOuter.y * h;
  const lix = leftEyeInner.x * w;
  const liy = leftEyeInner.y * h;

  const rx = rightEyeOuter.x * w;
  const ry = rightEyeOuter.y * h;
  const rix = rightEyeInner.x * w;
  const riy = rightEyeInner.y * h;

  const nx = noseBridge.x * w;
  const ny = noseBridge.y * h;

  // Lens sizes
  const leftLensRadius = Math.hypot(lx - lix, ly - liy) * 0.6;
  const rightLensRadius = Math.hypot(rx - rix, ry - riy) * 0.6;

  const leftCenterX = (lx + lix) / 2;
  const leftCenterY = (ly + liy) / 2;
  const rightCenterX = (rx + rix) / 2;
  const rightCenterY = (ry + riy) / 2;

  // 2D style overlay (keep for debugging / nice effect)
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillStyle = 'rgba(100, 150, 200, 0.15)';
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.arc(leftCenterX, leftCenterY, leftLensRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(rightCenterX, rightCenterY, rightLensRadius, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(leftCenterX + leftLensRadius * 0.3, leftCenterY);
  ctx.lineTo(rightCenterX - rightLensRadius * 0.3, rightCenterY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(
    leftCenterX - leftLensRadius * 0.3,
    leftCenterY - leftLensRadius * 0.3
  );
  ctx.lineTo(
    rightCenterX + rightLensRadius * 0.3,
    rightCenterY - rightLensRadius * 0.3
  );
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.arc(nx - 3, ny, 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(nx + 3, ny, 2, 0, 2 * Math.PI);
  ctx.fill();

  // ===== Drive 3D model with ear-aware positioning =====
  const dx = rx - lx;
  const dy = ry - ly;
  const eyeDistance = Math.hypot(dx, dy);

  const centerX = nx;
  const centerY = ny - eyeDistance * 0.15;

  const leftEar = landmarks[234];   // left ear
  const rightEar = landmarks[454];  // right ear

  if (glassesModel && threeCamera && leftEar && rightEar) {
    // Calculate ear positions in pixels
    const leftEarX = leftEar.x * w;
    const leftEarY = leftEar.y * h;
    const rightEarX = rightEar.x * w;
    const rightEarY = rightEar.y * h;

    // Distance from eye center to ear = how wide glasses should spread
    const leftEarDistance = Math.hypot(leftEarX - leftCenterX, leftEarY - leftCenterY);
    const rightEarDistance = Math.hypot(rightEarX - rightCenterX, rightEarY - rightCenterY);
    const avgEarDistance = (leftEarDistance + rightEarDistance) / 2;

    // Compute position based on eyes + ears average
    const earAwareX = (leftEarX + rightEarX) / 2;
    const earAwareY = (leftEarY + rightEarY) / 2;

    // Blend eye center with ear-aware position (60% ear, 40% eye)
    const finalX = centerX * 0.4 + earAwareX * 0.6;
    const finalY = centerY * 0.4 + earAwareY * 0.6;

    const nxNorm = (finalX / w) * 2 - 1 + adjustments.positionX;
    const nyNorm = -(finalY / h) * 2 + 1 + adjustments.positionY * eyeDistance / h;

    const vec = new THREE.Vector3(nxNorm, nyNorm, adjustments.positionZ).unproject(threeCamera);
    glassesModel.position.copy(vec);

    // Scale: use larger scale to reach ears
    const scaleDistance = Math.max(eyeDistance, avgEarDistance);
    const s = scaleDistance * adjustments.scaleMultiplier;
    glassesModel.scale.set(s, s, s);

    // Rotation: use ear-based angle for more natural tilt
    const earDx = rightEarX - leftEarX;
    const earDy = rightEarY - leftEarY;
    const earAngle = Math.atan2(earDy, earDx);

    glassesModel.rotation.order = 'XYZ';
    glassesModel.rotation.x = adjustments.rotationX;
    glassesModel.rotation.y = adjustments.rotationY;
    glassesModel.rotation.z = earAngle + adjustments.rotationZ;

    // Debug info
    if (adjustments.debugMode) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 350, 250);

      ctx.fillStyle = 'rgb(0, 255, 0)';
      ctx.font = '12px monospace';
      let y = 30;
      const lineHeight = 15;

      ctx.fillText(`posX: ${adjustments.positionX.toFixed(3)} (Q/W)`, 20, y);
      y += lineHeight;
      ctx.fillText(`posY: ${adjustments.positionY.toFixed(3)} (A/S)`, 20, y);
      y += lineHeight;
      ctx.fillText(`posZ: ${adjustments.positionZ.toFixed(3)} (Z/X)`, 20, y);
      y += lineHeight;
      ctx.fillText(`rotX: ${adjustments.rotationX.toFixed(3)} (E/R)`, 20, y);
      y += lineHeight;
      ctx.fillText(`rotY: ${adjustments.rotationY.toFixed(3)} (T/Y)`, 20, y);
      y += lineHeight;
      ctx.fillText(`rotZ: ${adjustments.rotationZ.toFixed(3)} (U/I)`, 20, y);
      y += lineHeight;
      ctx.fillText(`scale: ${adjustments.scaleMultiplier.toFixed(4)} (P/O)`, 20, y);
      y += lineHeight;
      ctx.fillText(`earDist: ${avgEarDistance.toFixed(1)}px`, 20, y);
      y += lineHeight;
      ctx.fillText(`eyeDist: ${eyeDistance.toFixed(1)}px`, 20, y);
      y += lineHeight;
      ctx.fillText(`Press H to hide debug`, 20, y);
    }
  }

  // BOOKMARKED: Three.js rendering disabled
  /*
  // Render Three.js
  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }
  */
}

// ====================== Detection loop ======================
async function detect(): Promise<void> {
  if (!faceLandmarker || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
    requestAnimationFrame(detect);
    return;
  }

  try {
    const results = faceLandmarker.detectForVideo(videoElement, performance.now());

    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const landmarks = results.faceLandmarks[0];
      drawGlasses(landmarks);
    }
  } catch (error) {
    console.error('Detection Error:', error);
  }

  requestAnimationFrame(detect);
}

// ====================== Keyboard adjustments ======================
function setupKeyboardControls() {
  const step = 0.01; // adjustment step per keypress
  const rotStep = 0.05;

  document.addEventListener('keydown', (e) => {
    const key = e.key.toUpperCase();

    // Position X
    if (key === 'Q') adjustments.positionX -= step;
    if (key === 'W') adjustments.positionX += step;

    // Position Y
    if (key === 'A') adjustments.positionY -= step;
    if (key === 'S') adjustments.positionY += step;

    // Position Z
    if (key === 'Z') adjustments.positionZ -= step;
    if (key === 'X') adjustments.positionZ += step;

    // Rotation X (pitch)
    if (key === 'E') adjustments.rotationX -= rotStep;
    if (key === 'R') adjustments.rotationX += rotStep;

    // Rotation Y (yaw)
    if (key === 'T') adjustments.rotationY -= rotStep;
    if (key === 'Y') adjustments.rotationY += rotStep;

    // Rotation Z (roll)
    if (key === 'U') adjustments.rotationZ -= rotStep;
    if (key === 'I') adjustments.rotationZ += rotStep;

    // Scale
    if (key === 'P') adjustments.scaleMultiplier -= 0.0001;
    if (key === 'O') adjustments.scaleMultiplier += 0.0001;

    // Debug toggle
    if (key === 'H') adjustments.debugMode = !adjustments.debugMode;

    // Reset to defaults
    if (key === '0') {
      adjustments.positionX = 0;
      adjustments.positionY = -0.15;
      adjustments.positionZ = 0;
      adjustments.rotationX = 0;
      adjustments.rotationY = 0;
      adjustments.rotationZ = 0;
      adjustments.scaleMultiplier = 0.0015;
      console.log('🔄 Reset to defaults');
    }

    // Log current values
    if (key === 'L') {
      console.log('Current adjustments:', { ...adjustments });
    }
  });
}

// ====================== Main ======================
async function main(): Promise<void> {
  try {
    console.log('🚀 Initializing...');
    await initMediaPipe();
    await setupCamera();

    // Layout root + base canvas
    root.style.margin = '0';
    root.style.padding = '0';
    root.style.width = '100vw';
    root.style.height = '100vh';
    root.style.overflow = 'hidden';
    root.textContent = '';
    root.appendChild(canvasElement);

    canvasElement.style.display = 'block';
    canvasElement.style.width = '100%';
    canvasElement.style.height = '100%';

    // Now that canvas size is known, init Three overlay
    initThreeOverlay();

    console.log('✅ Ready - Detecting faces...');
    detect();
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

main();
{
  setupKeyboardControls();
}
