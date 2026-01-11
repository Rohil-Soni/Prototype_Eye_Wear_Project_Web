// src/main.ts
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FastRenderer } from './renderer';

// ===== MediaPipe globals =====
let faceLandmarker: FaceLandmarker | null = null;
const videoElement = document.createElement('video');
const canvasElement = document.createElement('canvas');

// ===== Three.js globals =====
let fastRenderer: FastRenderer | undefined;
let threeScene: THREE.Scene | undefined;
let threeCamera: THREE.PerspectiveCamera | undefined;
let glassesModel: THREE.Object3D | null = null;
let threeCanvas: HTMLCanvasElement | undefined;

// ===== Skeleton bones for FK control =====
let skeleton: THREE.Skeleton | null = null;
let headBone: THREE.Bone | undefined;
let leftStemBone: THREE.Bone | undefined;
let rightStemBone: THREE.Bone | undefined;

// ===== Adjustment parameters =====
const adjustments = {
  positionX: 0.0,
  positionY: 0.0,  // starting at 0
  positionZ: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scale: 0.002,  // base scale value
  autoSize: true,  // automatically adjust size based on face
  // Calibrated offsets from perfect fit reference (posX: 0.060, posY: 0.130)
  calibratedOffsetX: 0.060,  // X offset for proper centering
  calibratedOffsetY: 0.130,  // Y offset for proper height on nose bridge
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
    scale: adjustments.scale
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
      adjustments.scale = bookmark.scale;
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

  // Initialize our custom FastRenderer
  fastRenderer = new FastRenderer({
    width,
    height,
    alpha: true,
    antialias: true,
    pixelRatio: window.devicePixelRatio,
    sortObjects: true
  });

  // Get scene and camera from renderer
  threeScene = fastRenderer.getScene();
  threeCamera = fastRenderer.getCamera();
  threeCanvas = fastRenderer.getCanvas();

  // Setup canvas styling
  threeCanvas.style.position = 'absolute';
  threeCanvas.style.top = '0';
  threeCanvas.style.left = '0';
  threeCanvas.style.width = '100%';
  threeCanvas.style.height = '100%';
  threeCanvas.style.pointerEvents = 'none';
  root.appendChild(threeCanvas);

  // Setup optimized lighting
  fastRenderer.setupLighting();

  console.log('👓 InitThreeOverlay: creating GLTFLoader');
  const loader = new GLTFLoader();
  console.log('👓 Calling loader.load...');
  loader.load(
    'models/glassesbonesfinal.glb',
    (gltf) => {
      glassesModel = gltf.scene;

      gltf.scene.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh) {
          skeleton = child.skeleton;
          headBone = skeleton.getBoneByName('Bone');
          leftStemBone = skeleton.getBoneByName('Bone001');
          rightStemBone = skeleton.getBoneByName('Bone005');
        }

        if ((child as any).isMesh) {
          const mesh = child as THREE.Mesh;
          
          if (mesh.material) {
            const materials = Array.isArray(mesh.material) 
              ? mesh.material 
              : [mesh.material];

            materials.forEach((mat: any) => {
              // Let the FastRenderer handle material optimization
              // Just set basic properties here
              
              // For frame (opaque)
              if (mat.name.toLowerCase().includes('frame') || 
                  mat.name.toLowerCase().includes('stem')) {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.color.setHex(0x1a1a1a);
                mat.metalness = 0.05;
                mat.roughness = 0.4;
              }
              // For lenses (transparent)
              else if (mat.name.toLowerCase().includes('lens') || 
                       mat.name.toLowerCase().includes('glass')) {
                mat.transparent = true;
                mat.opacity = 0.15; // Subtle tint
                mat.color.setHex(0x88ccff); // Light blue tint
                mat.metalness = 0.9;
                mat.roughness = 0.1;
              }
              // Default to opaque if unsure
              else {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.color.setHex(0x1a1a1a);
              }
              
              mat.needsUpdate = true;
            });
          }
        }
      });

      glassesModel.scale.set(0.0001, 0.0001, 0.0001);
      glassesModel.position.set(0, 0, 0);
      glassesModel.rotation.set(0, 0, 0);
      glassesModel.visible = true;

      // Use FastRenderer's addObject method for optimized rendering
      if (fastRenderer && glassesModel) {
        fastRenderer.addObject(glassesModel);
      }
    },
    undefined,
    (error) => console.error('❌ GLB Error:', error)
  );
}

// ====================== Face Size Calculator ======================
function calculateFaceScale(landmarks: any[], canvasWidth: number, canvasHeight: number): number {
  // Use ACTUAL eye lens width (outer to inner corner) - same as the 2D circles!
  const leftEyeOuter = landmarks[33];
  const leftEyeInner = landmarks[133];
  const rightEyeOuter = landmarks[263];
  const rightEyeInner = landmarks[362];
  
  if (!leftEyeOuter || !leftEyeInner || !rightEyeOuter || !rightEyeInner) return 0.002;
  
  // Calculate eye lens width (same calculation as the 2D circles)
  const leftEyeWidth = Math.hypot(
    (leftEyeOuter.x - leftEyeInner.x) * canvasWidth,
    (leftEyeOuter.y - leftEyeInner.y) * canvasHeight
  );
  const rightEyeWidth = Math.hypot(
    (rightEyeOuter.x - rightEyeInner.x) * canvasWidth,
    (rightEyeOuter.y - rightEyeInner.y) * canvasHeight
  );
  
  // Average eye width (this changes with camera distance, just like the circles!)
  const avgEyeWidth = (leftEyeWidth + rightEyeWidth) / 2;
  
  // Scale proportionally to eye width with a much smaller multiplier
  const baseScale = 0.00035;  // very small base
  const scaleFactor = avgEyeWidth * 0.15; // reduced multiplier for proper size
  
  return baseScale * scaleFactor;
}

function adjustGlassesSize(landmarks: any[], canvasWidth: number, canvasHeight: number): number {
  if (!adjustments.autoSize) {
    return adjustments.scale; // manual mode
  }
  
  const calculatedScale = calculateFaceScale(landmarks, canvasWidth, canvasHeight);
  return calculatedScale;
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

  const leftEar = landmarks[234];   // left ear
  const rightEar = landmarks[454];  // right ear
  const noseTip = landmarks[4];      // nose tip
  const foreheadTop = landmarks[10]; // forehead/between eyes top

  // ==== 3D GLASSES ANCHOR ====
  if (glassesModel && threeCamera && leftEar && rightEar && noseTip && foreheadTop) {
    const leftEarX = leftEar.x * w;
    const leftEarY = leftEar.y * h;
    const rightEarX = rightEar.x * w;
    const rightEarY = rightEar.y * h;

    // Eye centers already computed above:
    // leftCenterX, leftCenterY, rightCenterX, rightCenterY

    // 1) Mount point: Pure NOSE BRIDGE position for accurate tracking
    let targetX = nx;  // nose bridge X (landmark 168)
    let targetY = ny;  // nose bridge Y (landmark 168)

    // 2) Apply calibration offsets
    targetX += adjustments.calibratedOffsetX * w;
    targetY += adjustments.calibratedOffsetY * h;
    
    // 3) Apply additional manual adjustments if needed
    targetX += adjustments.positionX * w;      // Q/W for fine-tuning
    targetY += adjustments.positionY * h;      // A/S for fine-tuning

    // 3) Convert to NDC
    const ndcX = (targetX / w) * 2 - 1;
    const ndcY = -(targetY / h) * 2 + 1;

    // 4) Unproject to world (fix depth at -1 in front of camera)
    const depth = -1;
    const worldPos = new THREE.Vector3(ndcX, ndcY, depth).unproject(threeCamera);
    glassesModel.position.copy(worldPos);

    // 5) Auto-size based on face measurements
    const finalScale = adjustGlassesSize(landmarks, w, h);
    glassesModel.scale.set(finalScale, finalScale, finalScale);

    // 7) Head pose rotation (same as before)
    const leftEarZ = leftEar.z || 0;
    const rightEarZ = rightEar.z || 0;
    const noseTipZ = noseTip.z || 0;
    const foreheadZ = foreheadTop.z || 0;

    const yawFromEars = (rightEarZ - leftEarZ) * 2;
    const pitchFromFace = -(foreheadZ - noseTipZ) * 3;  // inverted for correct pitch

    const earDx = rightEarX - leftEarX;
    const earDy = rightEarY - leftEarY;
    const rollFromEars = -Math.atan2(earDy, earDx);  // inverted for correct roll

    glassesModel.rotation.order = 'YXZ';
    glassesModel.rotation.y = yawFromEars + adjustments.rotationY;
    glassesModel.rotation.x = pitchFromFace + adjustments.rotationX;
    glassesModel.rotation.z = rollFromEars + adjustments.rotationZ;

    glassesModel.visible = true;

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

      ctx.fillText(`scale: ${adjustments.scale.toFixed(2)} (P/O)`, 20, y);
      y += lineHeight;
      ctx.fillText(`Press H to hide debug`, 20, y);
      y += lineHeight;
      ctx.fillText(`Press B to bookmark | Press N to load`, 20, y);
    }
  }

  // Render Three.js with FastRenderer
  if (fastRenderer) {
    fastRenderer.render();
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
    if (key === 'P') adjustments.scale -= 0.01;
    if (key === 'O') adjustments.scale += 0.01;

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
      adjustments.scale = 0.15;
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

    // Setup keyboard controls
    setupKeyboardControls();

    console.log('✅ Ready - Detecting faces...');
    detect();
  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

main();
