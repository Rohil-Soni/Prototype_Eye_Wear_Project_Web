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
  positionX: 0.170,      // horizontal offset
  positionY: -0.230,  // vertical offset (relative to eye distance)
  positionZ: 0,      // depth
  rotationX: 1.650,      // pitch (up/down)
  rotationY: 0,      // yaw (left/right)
  rotationZ: 0,      // roll (with head tilt - auto, but can add manual)
  scaleMultiplier: 0.0025, // size factor (eyeDistance * this)
  debugMode: true
};

// ===== Bookmark storage =====
const BOOKMARK_KEY = 'glasses-adjustments-bookmark';

function saveBookmark(): void {
  const bookmark = {
    positionX: adjustments.positionX,
    positionY: adjustments.positionY,
    positionZ: adjustments.positionZ,
    rotationX: adjustments.rotationX,
    rotationY: adjustments.rotationY,
    rotationZ: adjustments.rotationZ,
    scaleMultiplier: adjustments.scaleMultiplier
  };
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
  console.log('🔖 Bookmark saved!', bookmark);
}

function loadBookmark(): boolean {
  const saved = localStorage.getItem(BOOKMARK_KEY);
  if (saved) {
    try {
      const bookmark = JSON.parse(saved);
      adjustments.positionX = bookmark.positionX;
      adjustments.positionY = bookmark.positionY;
      adjustments.positionZ = bookmark.positionZ;
      adjustments.rotationX = bookmark.rotationX;
      adjustments.rotationY = bookmark.rotationY;
      adjustments.rotationZ = bookmark.rotationZ;
      adjustments.scaleMultiplier = bookmark.scaleMultiplier;
      console.log('✅ Bookmark loaded!', bookmark);
      return true;
    } catch (e) {
      console.error('❌ Failed to load bookmark', e);
      return false;
    }
  }
  return false;
}

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

  // ===== Drive 3D model with proper 3D head pose =====
  const dx = rx - lx;
  const dy = ry - ly;
  const eyeDistance = Math.hypot(dx, dy);

  const centerX = nx;
  const centerY = ny - eyeDistance * 0.15;

  const leftEar = landmarks[234];   // left ear
  const rightEar = landmarks[454];  // right ear
  const noseTip = landmarks[4];      // nose tip
  const foreheadTop = landmarks[10]; // forehead/between eyes top

  if (glassesModel && threeCamera && leftEar && rightEar && noseTip && foreheadTop) {
    // 2D pixel positions
    const leftEarX = leftEar.x * w;
    const leftEarY = leftEar.y * h;
    const rightEarX = rightEar.x * w;
    const rightEarY = rightEar.y * h;

    // Z-depth values (normalized ~0.1 to 0.9, where smaller = closer)
    const leftEarZ = leftEar.z || 0;
    const rightEarZ = rightEar.z || 0;
    const noseTipZ = noseTip.z || 0;
    const foreheadZ = foreheadTop.z || 0;

    // 1. Position: blend eyes + ears
    const earAwareX = (leftEarX + rightEarX) / 2;
    const earAwareY = (leftEarY + rightEarY) / 2;
    const finalX = centerX * 0.4 + earAwareX * 0.6;
    const finalY = centerY * 0.4 + earAwareY * 0.6;

    const nxNorm = (finalX / w) * 2 - 1 + adjustments.positionX;
    const nyNorm = -(finalY / h) * 2 + 1 + adjustments.positionY * eyeDistance / h;

    const vec = new THREE.Vector3(nxNorm, nyNorm, adjustments.positionZ).unproject(threeCamera);
    glassesModel.position.copy(vec);

    // 2. Scale
    const scaleDistance = Math.max(eyeDistance, Math.hypot(rightEarX - leftEarX, rightEarY - leftEarY));
    const s = scaleDistance * adjustments.scaleMultiplier;
    glassesModel.scale.set(s, s, s);

    // 3. Rotation: use 3D z-depth for head pose
    // === YAW (head left/right) ===
    // If left ear is further away (bigger z) than right ear, head is turning right
    const yawFromEars = (rightEarZ - leftEarZ) * 2; // scale up for more rotation

    // === PITCH (head up/down) ===
    // If forehead is closer (smaller z) than nose, head is tilted down
    const pitchFromFace = (foreheadZ - noseTipZ) * 3;

    // === ROLL (head tilt left/right) ===
    // Compute from ear positions
    const earDx = rightEarX - leftEarX;
    const earDy = rightEarY - leftEarY;
    const rollFromEars = Math.atan2(earDy, earDx);

    glassesModel.rotation.order = 'YXZ'; // important: yaw first, then pitch, then roll
    glassesModel.rotation.y = yawFromEars + adjustments.rotationY;  // YAW (left/right turn)
    glassesModel.rotation.x = pitchFromFace + adjustments.rotationX; // PITCH (up/down)
    glassesModel.rotation.z = rollFromEars + adjustments.rotationZ;   // ROLL (tilt)

    // Debug info
    if (adjustments.debugMode) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(10, 10, 380, 280);

      ctx.fillStyle = 'rgb(0, 255, 0)';
      ctx.font = '12px monospace';
      let y = 30;
      const lineHeight = 15;

      ctx.fillText(`=== POSITION ===`, 20, y);
      y += lineHeight;
      ctx.fillText(`posX: ${adjustments.positionX.toFixed(3)} (Q/W)`, 20, y);
      y += lineHeight;
      ctx.fillText(`posY: ${adjustments.positionY.toFixed(3)} (A/S)`, 20, y);
      y += lineHeight;
      ctx.fillText(`posZ: ${adjustments.positionZ.toFixed(3)} (Z/X)`, 20, y);
      y += lineHeight;

      ctx.fillText(`=== ROTATION (3D) ===`, 20, y);
      y += lineHeight;
      ctx.fillText(`YAW (L/R): ${(glassesModel.rotation.y).toFixed(3)} (T/Y)`, 20, y);
      y += lineHeight;
      ctx.fillText(`PITCH (U/D): ${(glassesModel.rotation.x).toFixed(3)} (E/R)`, 20, y);
      y += lineHeight;
      ctx.fillText(`ROLL: ${(glassesModel.rotation.z).toFixed(3)} (U/I)`, 20, y);
      y += lineHeight;

      ctx.fillText(`=== HEAD POSE (Z-depth) ===`, 20, y);
      y += lineHeight;
      ctx.fillText(`leftEarZ: ${leftEarZ.toFixed(3)}`, 20, y);
      y += lineHeight;
      ctx.fillText(`rightEarZ: ${rightEarZ.toFixed(3)}`, 20, y);
      y += lineHeight;
      ctx.fillText(`yaw: ${yawFromEars.toFixed(3)}`, 20, y);
      y += lineHeight;
      ctx.fillText(`pitch: ${pitchFromFace.toFixed(3)}`, 20, y);
      y += lineHeight;

      ctx.fillText(`scale: ${adjustments.scaleMultiplier.toFixed(4)} (P/O)`, 20, y);
      y += lineHeight;
      ctx.fillText(`Press H to hide debug`, 20, y);
      y += lineHeight;
      ctx.fillText(`Press B to bookmark | Press N to load`, 20, y);
    }
  }

  // Render Three.js
  if (threeRenderer && threeScene && threeCamera) {
    threeRenderer.render(threeScene, threeCamera);
  }
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

    // Bookmark - save current settings
    if (key === 'B') {
      saveBookmark();
    }

    // Load bookmarked settings
    if (key === 'N') {
      if (loadBookmark()) {
        console.log('✅ Loaded bookmarked settings');
      } else {
        console.log('ℹ️ No bookmark found');
      }
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
