// src/main.ts - MindAR Implementation with Auto-Adjustment
import './style.css';
import * as THREE from 'three';
import { FaceMeasurementSystem } from './faceMeasurement.ts';
import { AutoAdjuster, type AdjustmentSettings } from './autoAdjuster.ts';

// ===== Settings Storage =====
const SETTINGS_KEY = 'mindar-glasses-settings';
const CALIBRATION_KEY_PREFIX = 'mindar-projection-calibration';
const SIZE_POINTS_MIN = 40;
const SIZE_POINTS_MAX = 220;

interface PositionOffset {
  x: number;
  y: number;
  z: number;
}

interface CalibrationProfile {
  positionOffset: PositionOffset;
  scaleFactor: number;
}

interface GlassesSettings {
  posX: number;
  posY: number;
  posZ: number;
  scale: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

let glassesEntity: any;
const DEFAULT_SETTINGS: GlassesSettings = {
  posX: 0,
  posY: 0,
  posZ: -0.15,
  scale: 0.1,
  rotX: 0,
  rotY: 0,
  rotZ: 0
};
let currentSettings: GlassesSettings = { ...DEFAULT_SETTINGS };

// ===== Face Measurement & Auto-Adjustment =====
const faceMeasurement = new FaceMeasurementSystem();
const autoAdjuster = new AutoAdjuster(faceMeasurement);

const DEBUG_ANCHOR_POINTS: number[] = [
  10, 67, 109, 151, 168,
  1, 2, 4, 5,
  33, 263, 130, 359,
  98, 327,
  234, 454,
  61, 291, 17,
  152, 197
];

let activeAnchorIndex = 168;
let calibrationProfile: CalibrationProfile = {
  positionOffset: { x: 0, y: 0, z: 0 },
  scaleFactor: 1.0
};

function getCalibrationProfileKey(): string {
  const width = window.screen?.width ?? 0;
  const height = window.screen?.height ?? 0;
  const dpr = window.devicePixelRatio ?? 1;
  const ua = navigator.userAgent ?? 'unknown';
  return `${CALIBRATION_KEY_PREFIX}:${width}x${height}:dpr${dpr}:${ua}`;
}

function loadCalibrationProfile(): CalibrationProfile {
  try {
    const raw = localStorage.getItem(getCalibrationProfileKey());
    if (!raw) {
      return {
        positionOffset: { x: 0, y: 0, z: 0 },
        scaleFactor: 1.0
      };
    }
    const parsed = JSON.parse(raw);
    return {
      positionOffset: {
        x: Number(parsed.positionOffset?.x ?? parsed.x) || 0,
        y: Number(parsed.positionOffset?.y ?? parsed.y) || 0,
        z: Number(parsed.positionOffset?.z ?? parsed.z) || 0
      },
      scaleFactor: Number(parsed.scaleFactor) || 1.0
    };
  } catch {
    return {
      positionOffset: { x: 0, y: 0, z: 0 },
      scaleFactor: 1.0
    };
  }
}

function saveCalibrationProfile(profile: CalibrationProfile) {
  localStorage.setItem(getCalibrationProfileKey(), JSON.stringify(profile));
}

function clampNumber(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scaleToSizePoints(scale: number): number {
  const t = (scale - 0.05) / (1.5 - 0.05);
  const mapped = SIZE_POINTS_MIN + clampNumber(t, 0, 1) * (SIZE_POINTS_MAX - SIZE_POINTS_MIN);
  return Math.round(mapped);
}

function sizePointsToScale(points: number): number {
  const clampedPoints = clampNumber(points, SIZE_POINTS_MIN, SIZE_POINTS_MAX);
  const t = (clampedPoints - SIZE_POINTS_MIN) / (SIZE_POINTS_MAX - SIZE_POINTS_MIN);
  return 0.05 + t * (1.5 - 0.05);
}

// ===== Initialize Controls =====
function initControls() {
  const posXSlider = document.getElementById('posX') as HTMLInputElement;
  const posYSlider = document.getElementById('posY') as HTMLInputElement;
  const posZSlider = document.getElementById('posZ') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  const sizePointsRange = document.getElementById('sizePointsRange') as HTMLInputElement;
  const sizePointsInput = document.getElementById('sizePointsInput') as HTMLInputElement;
  const rotXSlider = document.getElementById('rotX') as HTMLInputElement;
  const rotYSlider = document.getElementById('rotY') as HTMLInputElement;
  const rotZSlider = document.getElementById('rotZ') as HTMLInputElement;
  
  const posXVal = document.getElementById('posX-val');
  const posYVal = document.getElementById('posY-val');
  const posZVal = document.getElementById('posZ-val');
  const scaleVal = document.getElementById('scale-val');
  const sizePointsVal = document.getElementById('size-points-val');
  const rotXVal = document.getElementById('rotX-val');
  const rotYVal = document.getElementById('rotY-val');
  const rotZVal = document.getElementById('rotZ-val');
  
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');
  const startCalibrationBtn = document.getElementById('startCalibrationBtn') as HTMLButtonElement | null;
  const saveCalibrationBtn = document.getElementById('saveCalibrationBtn') as HTMLButtonElement | null;
  const startScaleCalibrationBtn = document.getElementById('startScaleCalibrationBtn') as HTMLButtonElement | null;
  const saveScaleCalibrationBtn = document.getElementById('saveScaleCalibrationBtn') as HTMLButtonElement | null;
  const resetCalibrationBtn = document.getElementById('resetCalibrationBtn') as HTMLButtonElement | null;
  const toggleInspectorDebugBtn = document.getElementById('toggleInspectorDebugBtn') as HTMLButtonElement | null;
  const calibrationStatus = document.getElementById('calibrationStatus');

  const glassesAnchor = document.getElementById('glasses-anchor');
  const anchorMarker = document.getElementById('anchor-marker');
  const anchorDebugPool = document.getElementById('anchor-debug-pool');
  let occluderEntity: any = null;

  let debugVisible = false;
  let isPositionCalibrating = false;
  let isScaleCalibrating = false;
  let positionCalibrationBaseline: GlassesSettings | null = null;
  let scaleCalibrationBaseline: GlassesSettings | null = null;
  let isDraggingCalibration = false;
  let lastPointerX = 0;
  let lastPointerY = 0;

  calibrationProfile = loadCalibrationProfile();

  const anchorAliases = DEBUG_ANCHOR_POINTS.map((index, i) => ({
    alias: `a${i + 1}`,
    index
  }));

  const updateCalibrationStatus = () => {
    if (!calibrationStatus) return;
    calibrationStatus.textContent =
      `Position: ${isPositionCalibrating ? 'ON' : 'OFF'} | ` +
      `Size: ${isScaleCalibrating ? 'ON' : 'OFF'} | ` +
      `posOffset=(${calibrationProfile.positionOffset.x.toFixed(3)}, ${calibrationProfile.positionOffset.y.toFixed(3)}, ${calibrationProfile.positionOffset.z.toFixed(3)}) | ` +
      `scaleFactor=${calibrationProfile.scaleFactor.toFixed(3)}`;
  };

  const syncSizeControlsFromScale = () => {
    const points = scaleToSizePoints(currentSettings.scale);
    if (sizePointsRange) sizePointsRange.value = points.toString();
    if (sizePointsInput) sizePointsInput.value = points.toString();
    if (sizePointsVal) sizePointsVal.textContent = points.toString();
    if (scaleVal) scaleVal.textContent = currentSettings.scale.toFixed(2);
  };

  const setActiveAnchor = (anchorIndex: number) => {
    activeAnchorIndex = anchorIndex;
    if (glassesAnchor) {
      glassesAnchor.setAttribute('mindar-face-target', `anchorIndex: ${anchorIndex}`);
    }
    console.log(`📍 Active anchor set to ${anchorIndex}`);
  };

  const buildAnchorDebugPoints = () => {
    if (!anchorDebugPool) return;
    anchorDebugPool.innerHTML = '';

    anchorAliases.forEach((item) => {
      const targetEntity = document.createElement('a-entity');
      targetEntity.setAttribute('mindar-face-target', `anchorIndex: ${item.index}`);
      targetEntity.setAttribute('visible', 'true');

      const marker = document.createElement('a-sphere');
      marker.setAttribute('radius', '0.003');
      marker.setAttribute('color', '#00ff66');
      marker.setAttribute('material', 'shader: flat; transparent: true; opacity: 0.9');

      const label = document.createElement('a-text');
      label.setAttribute('value', item.alias);
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#00ff66');
      label.setAttribute('side', 'double');
      label.setAttribute('width', '0.18');
      label.setAttribute('position', '0 0.012 0');

      targetEntity.appendChild(marker);
      targetEntity.appendChild(label);
      anchorDebugPool.appendChild(targetEntity);
    });
  };

  const startPositionCalibration = () => {
    isPositionCalibrating = true;
    isScaleCalibrating = false;
    positionCalibrationBaseline = { ...currentSettings };
    disableAutoAdjust();
    if (startCalibrationBtn) {
      startCalibrationBtn.textContent = 'Cancel Position';
      startCalibrationBtn.style.background = '#c62828';
    }
    if (startScaleCalibrationBtn) {
      startScaleCalibrationBtn.textContent = 'Start Size';
      startScaleCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveCalibrationBtn) saveCalibrationBtn.disabled = false;
    if (saveScaleCalibrationBtn) saveScaleCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    console.log('🧭 Position calibration started');
  };

  const cancelPositionCalibration = () => {
    if (positionCalibrationBaseline) {
      currentSettings = { ...positionCalibrationBaseline };
      updateUIFromSettings();
      applySettings();
    }
    isPositionCalibrating = false;
    positionCalibrationBaseline = null;
    isDraggingCalibration = false;
    if (startCalibrationBtn) {
      startCalibrationBtn.textContent = 'Start Position';
      startCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveCalibrationBtn) saveCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    console.log('↩️ Position calibration canceled');
  };

  const commitPositionCalibration = () => {
    if (!isPositionCalibrating || !positionCalibrationBaseline) return;

    const delta: PositionOffset = {
      x: currentSettings.posX - positionCalibrationBaseline.posX,
      y: currentSettings.posY - positionCalibrationBaseline.posY,
      z: currentSettings.posZ - positionCalibrationBaseline.posZ
    };

    calibrationProfile.positionOffset = {
      x: calibrationProfile.positionOffset.x + delta.x,
      y: calibrationProfile.positionOffset.y + delta.y,
      z: calibrationProfile.positionOffset.z + delta.z
    };

    currentSettings = { ...positionCalibrationBaseline };
    saveCalibrationProfile(calibrationProfile);
    updateUIFromSettings();
    applySettings();

    isPositionCalibrating = false;
    positionCalibrationBaseline = null;
    isDraggingCalibration = false;
    if (startCalibrationBtn) {
      startCalibrationBtn.textContent = 'Start Position';
      startCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveCalibrationBtn) saveCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    alert(
      `✅ Position calibration saved\nOffset vector: (` +
      `${calibrationProfile.positionOffset.x.toFixed(3)}, ` +
      `${calibrationProfile.positionOffset.y.toFixed(3)}, ` +
      `${calibrationProfile.positionOffset.z.toFixed(3)})`
    );
  };

  const startScaleCalibration = () => {
    isScaleCalibrating = true;
    isPositionCalibrating = false;
    scaleCalibrationBaseline = { ...currentSettings };
    disableAutoAdjust();
    if (startScaleCalibrationBtn) {
      startScaleCalibrationBtn.textContent = 'Cancel Size';
      startScaleCalibrationBtn.style.background = '#c62828';
    }
    if (startCalibrationBtn) {
      startCalibrationBtn.textContent = 'Start Position';
      startCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveScaleCalibrationBtn) saveScaleCalibrationBtn.disabled = false;
    if (saveCalibrationBtn) saveCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    console.log('📏 Size calibration started');
  };

  const cancelScaleCalibration = () => {
    if (scaleCalibrationBaseline) {
      currentSettings = { ...scaleCalibrationBaseline };
      updateUIFromSettings();
      applySettings();
    }
    isScaleCalibrating = false;
    scaleCalibrationBaseline = null;
    isDraggingCalibration = false;
    if (startScaleCalibrationBtn) {
      startScaleCalibrationBtn.textContent = 'Start Size';
      startScaleCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveScaleCalibrationBtn) saveScaleCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    console.log('↩️ Size calibration canceled');
  };

  const commitScaleCalibration = () => {
    if (!isScaleCalibrating || !scaleCalibrationBaseline) return;
    if (scaleCalibrationBaseline.scale <= 0) return;

    const ratio = currentSettings.scale / scaleCalibrationBaseline.scale;
    calibrationProfile.scaleFactor = Math.max(0.1, Math.min(5.0, calibrationProfile.scaleFactor * ratio));

    currentSettings = { ...scaleCalibrationBaseline };
    saveCalibrationProfile(calibrationProfile);
    updateUIFromSettings();
    applySettings();

    isScaleCalibrating = false;
    scaleCalibrationBaseline = null;
    isDraggingCalibration = false;
    if (startScaleCalibrationBtn) {
      startScaleCalibrationBtn.textContent = 'Start Size';
      startScaleCalibrationBtn.style.background = '#ef6c00';
    }
    if (saveScaleCalibrationBtn) saveScaleCalibrationBtn.disabled = true;
    updateCalibrationStatus();
    alert(`✅ Size calibration saved\nScale factor: ${calibrationProfile.scaleFactor.toFixed(3)}`);
  };

  const resetCalibration = () => {
    calibrationProfile = {
      positionOffset: { x: 0, y: 0, z: 0 },
      scaleFactor: 1.0
    };
    saveCalibrationProfile(calibrationProfile);
    if (isPositionCalibrating) cancelPositionCalibration();
    if (isScaleCalibrating) cancelScaleCalibration();
    applySettings();
    updateCalibrationStatus();
    alert('✅ Position and size calibration reset for this device profile');
  };

  const setDebugVisibility = (visible: boolean) => {
    debugVisible = visible;
    if (anchorMarker) anchorMarker.setAttribute('visible', visible ? 'true' : 'false');
    if (anchorDebugPool) anchorDebugPool.setAttribute('visible', visible ? 'true' : 'false');
    if (occluderEntity) occluderEntity.setAttribute('visible', visible ? 'true' : 'false');
    if (toggleInspectorDebugBtn) {
      toggleInspectorDebugBtn.textContent = visible ? 'Hide Debug' : 'Show Debug';
    }
  };

  toggleInspectorDebugBtn?.addEventListener('click', () => {
    setDebugVisibility(!debugVisible);
  });

  startCalibrationBtn?.addEventListener('click', () => {
    if (isPositionCalibrating) {
      cancelPositionCalibration();
      return;
    }
    startPositionCalibration();
  });

  saveCalibrationBtn?.addEventListener('click', () => {
    commitPositionCalibration();
  });

  startScaleCalibrationBtn?.addEventListener('click', () => {
    if (isScaleCalibrating) {
      cancelScaleCalibration();
      return;
    }
    startScaleCalibration();
  });

  saveScaleCalibrationBtn?.addEventListener('click', () => {
    commitScaleCalibration();
  });

  resetCalibrationBtn?.addEventListener('click', () => {
    resetCalibration();
  });

  buildAnchorDebugPoints();
  setDebugVisibility(false);
  if (saveCalibrationBtn) saveCalibrationBtn.disabled = true;
  if (saveScaleCalibrationBtn) saveScaleCalibrationBtn.disabled = true;
  updateCalibrationStatus();
  setActiveAnchor(activeAnchorIndex);

  // Inspector-only API for anchor and debug operations.
  (window as any).anchorInspector = {
    list: () => anchorAliases.map((item) => ({ ...item })),
    active: () => activeAnchorIndex,
    setByIndex: (index: number) => setActiveAnchor(index),
    setByAlias: (alias: string) => {
      const match = anchorAliases.find((item) => item.alias === alias);
      if (match) setActiveAnchor(match.index);
      return match?.index ?? null;
    },
    showDebug: () => setDebugVisibility(true),
    hideDebug: () => setDebugVisibility(false)
  };

  // Wait for A-Frame to initialize
  const scene = document.querySelector('a-scene');

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const handlePointerMove = (event: PointerEvent) => {
    if ((!isPositionCalibrating && !isScaleCalibrating) || !isDraggingCalibration) return;

    const dx = event.clientX - lastPointerX;
    const dy = event.clientY - lastPointerY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;

    if (isPositionCalibrating) {
      const moveScale = 0.0008;
      // Front-camera preview is mirrored; flip X so drag direction feels natural.
      currentSettings.posX = clamp(currentSettings.posX - dx * moveScale, -0.5, 0.5);
      currentSettings.posY = clamp(currentSettings.posY - dy * moveScale, -0.5, 0.5);
    }

    if (isScaleCalibrating) {
      const scaleStep = 0.0015;
      currentSettings.scale = clamp(currentSettings.scale - dy * scaleStep, 0.05, 1.5);
    }

    updateUIFromSettings();
    syncSizeControlsFromScale();
    applySettings();
  };

  scene?.addEventListener('pointerdown', (event: Event) => {
    if (!isPositionCalibrating && !isScaleCalibrating) return;
    const pe = event as PointerEvent;
    isDraggingCalibration = true;
    lastPointerX = pe.clientX;
    lastPointerY = pe.clientY;
  });

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', () => {
    isDraggingCalibration = false;
  });

  scene?.addEventListener('wheel', (event: Event) => {
    if (!isPositionCalibrating) return;
    const we = event as WheelEvent;
    we.preventDefault();
    const zScale = 0.0005;
    currentSettings.posZ = clamp(currentSettings.posZ + we.deltaY * zScale, -0.5, 0.5);
    updateUIFromSettings();
    syncSizeControlsFromScale();
    applySettings();
  }, { passive: false });
  
  scene?.addEventListener('loaded', () => {
    console.log('✅ A-Frame scene loaded');
    glassesEntity = document.getElementById('glasses');
    
    if (!glassesEntity) {
      console.error('❌ Glasses entity not found');
      return;
    }

    // Style MindAR's default face occluder as a visible green wireframe in debug mode.
    const applyOccluderDebugStyle = () => {
      const occluder = document.querySelector('[mindar-face-default-face-occluder]') as any;
      if (!occluder) return;
      occluderEntity = occluder;
      setDebugVisibility(debugVisible);

      const tryApply = () => {
        const mesh = occluder.getObject3D?.('mesh');
        if (!mesh) return false;

        mesh.traverse((child: any) => {
          if (!child.isMesh || !child.material) return;
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.color?.setHex?.(0x00ff66);
            mat.wireframe = true;
            mat.transparent = true;
            mat.opacity = 0.2;
            mat.depthWrite = false;
            mat.side = 2; // THREE.DoubleSide
            mat.needsUpdate = true;
          });
        });

        return true;
      };

      if (tryApply()) return;
      occluder.addEventListener('object3dset', () => {
        tryApply();
      });
    };

    applyOccluderDebugStyle();

    // Get MindAR anchor entity reference
    const glassesAnchorRef = document.getElementById('glasses-anchor') as any;

    if (glassesAnchorRef) {
      // Initialize face measurement system with anchor entity
      faceMeasurement.initialize(glassesAnchorRef);
      faceMeasurement.startTracking();
      
      // Start measuring face on interval (when face is detected)
      setInterval(() => {
        if (glassesAnchorRef.object3D && glassesAnchorRef.object3D.visible) {
          faceMeasurement.measureFace();
        }
      }, 1000);
      
      console.log('✅ Face measurement system active');
    } else {
      console.error('❌ Glasses anchor not found - face measurement disabled');
    }

    // Update UI to reflect current settings
    updateUIFromSettings();
    syncSizeControlsFromScale();

    // Keep auto-adjust base scale synced with active manual scale.
    autoAdjuster.setBaseScale(currentSettings.scale);

    // Apply material settings for proper transparency
    glassesEntity.addEventListener('model-loaded', () => {
      console.log('✅ GLTF model loaded');
      const mesh = glassesEntity.getObject3D('mesh');
      
      if (mesh) {
        // Helps verify whether size issues come from model dimensions.
        const bbox = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        console.log('📦 Model bounding size (x,y,z):', size);

        mesh.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach((mat: any) => {
              const materialName = (mat?.name || '').toLowerCase();
              const isFrameLike =
                materialName.includes('frame') ||
                materialName.includes('stem') ||
                materialName.includes('rim') ||
                materialName.includes('temple');
              const isLikelyLens =
                materialName.includes('lens') ||
                materialName.includes('glass') ||
                mat.transparent === true ||
                (typeof mat.opacity === 'number' && mat.opacity < 0.99);

              // Frame materials (opaque)
              if (isFrameLike) {
                mat.visible = true;
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.side = 0; // THREE.FrontSide
                mat.depthWrite = true;
                mat.depthTest = true;
                mat.color.setHex(0x1a1a1a); // Dark frame
                mat.metalness = 0.05;
                mat.roughness = 0.4;
              }
              // Hide likely lens / glass materials.
              else if (isLikelyLens) {
                // Hide lens rendering to keep only the frame visible.
                mat.visible = false;
              }
              
              mat.needsUpdate = true;
            });
          }
        });
        
        console.log('✅ Materials configured for transparency');
        applySettings();
      }
    });
  });

  // Position X control
  posXSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.posX = value;
    if (posXVal) posXVal.textContent = value.toFixed(2);
    applySettings();
  });

  // Position Y control
  posYSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.posY = value;
    if (posYVal) posYVal.textContent = value.toFixed(2);
    applySettings();
  });

  // Position Z control
  posZSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.posZ = value;
    if (posZVal) posZVal.textContent = value.toFixed(2);
    applySettings();
  });

  // Scale control
  scaleSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.scale = value;
    autoAdjuster.setBaseScale(value);
    if (scaleVal) scaleVal.textContent = value.toFixed(2);
    syncSizeControlsFromScale();
    applySettings();
  });

  // Points-based size range control
  sizePointsRange?.addEventListener('input', (e) => {
    const points = parseFloat((e.target as HTMLInputElement).value);
    const nextScale = sizePointsToScale(points);
    currentSettings.scale = nextScale;
    autoAdjuster.setBaseScale(nextScale);
    syncSizeControlsFromScale();
    applySettings();
  });

  // Typeable size in points
  sizePointsInput?.addEventListener('change', (e) => {
    const raw = parseFloat((e.target as HTMLInputElement).value);
    const safePoints = Number.isFinite(raw) ? clampNumber(raw, SIZE_POINTS_MIN, SIZE_POINTS_MAX) : scaleToSizePoints(currentSettings.scale);
    const nextScale = sizePointsToScale(safePoints);
    currentSettings.scale = nextScale;
    autoAdjuster.setBaseScale(nextScale);
    syncSizeControlsFromScale();
    applySettings();
  });

  // Rotation X control
  rotXSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.rotX = value;
    if (rotXVal) rotXVal.textContent = value.toString();
    applySettings();
  });

  // Rotation Y control
  rotYSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.rotY = value;
    if (rotYVal) rotYVal.textContent = value.toString();
    applySettings();
  });

  // Rotation Z control
  rotZSlider?.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value);
    currentSettings.rotZ = value;
    if (rotZVal) rotZVal.textContent = value.toString();
    applySettings();
  });

  // Save button
  saveBtn?.addEventListener('click', () => {
    saveSettings();
    alert('✅ Settings saved!');
  });

  // Load button
  loadBtn?.addEventListener('click', () => {
    if (loadSettings()) {
      updateUIFromSettings();
      applySettings();
      alert('✅ Settings loaded!');
    } else {
      alert('❌ No saved settings found');
    }
  });
}

// ===== Auto-Adjustment Functions =====
/**
 * Initialize automatic adjustment pipeline
 * Connects measurement system to auto-adjuster for seamless real-time adjustment
 */
function initializeAutoAdjustmentPipeline() {
  autoAdjuster.enable((settings: AdjustmentSettings) => {
    // Update current settings with auto-adjusted values
    const resolvedScale = autoAdjuster.isAutoScaleEnabled()
      ? settings.scale
      : currentSettings.scale;

    currentSettings = {
      ...currentSettings,
      scale: resolvedScale,
      posX: settings.posX,
      posY: settings.posY,
      posZ: settings.posZ
    };
    
    updateUIFromSettings();
    applySettings();
  });
  
  console.log('🔄 Auto-adjustment pipeline initialized and active');
}

function enableAutoAdjust() {
  autoAdjuster.enable((settings: AdjustmentSettings) => {
    // Update current settings with auto-adjusted values
    const resolvedScale = autoAdjuster.isAutoScaleEnabled()
      ? settings.scale
      : currentSettings.scale;

    currentSettings = {
      ...currentSettings,
      scale: resolvedScale,
      posX: settings.posX,
      posY: settings.posY,
      posZ: settings.posZ
    };
    
    updateUIFromSettings();
    applySettings();
  });
}

function disableAutoAdjust() {
  autoAdjuster.disable();
}

// Expose auto-adjustment controls globally
(window as any).enableAutoAdjust = enableAutoAdjust;
(window as any).disableAutoAdjust = disableAutoAdjust;
(window as any).initializeAutoAdjustmentPipeline = initializeAutoAdjustmentPipeline;
(window as any).setAutoScaleEnabled = (enabled: boolean) => autoAdjuster.setAutoScaleEnabled(enabled);
(window as any).isAutoScaleEnabled = () => autoAdjuster.isAutoScaleEnabled();
(window as any).getFaceMeasurements = () => faceMeasurement.getAverageMeasurements();
(window as any).getRecommendedSettings = () => autoAdjuster.getRecommendedSettings();

// ===== Apply settings to glasses entity =====
function applySettings() {
  if (!glassesEntity) return;
  
  glassesEntity.setAttribute('position', {
    x: currentSettings.posX + calibrationProfile.positionOffset.x,
    y: currentSettings.posY + calibrationProfile.positionOffset.y,
    z: currentSettings.posZ + calibrationProfile.positionOffset.z
  });
  
  const calibratedScale = currentSettings.scale * calibrationProfile.scaleFactor;
  glassesEntity.setAttribute('scale', {
    x: calibratedScale,
    y: calibratedScale,
    z: calibratedScale
  });

  glassesEntity.setAttribute('rotation', {
    x: currentSettings.rotX,
    y: currentSettings.rotY,
    z: currentSettings.rotZ
  });
}

// ===== Update UI controls from current settings =====
function updateUIFromSettings() {
  const posXSlider = document.getElementById('posX') as HTMLInputElement;
  const posYSlider = document.getElementById('posY') as HTMLInputElement;
  const posZSlider = document.getElementById('posZ') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  const rotXSlider = document.getElementById('rotX') as HTMLInputElement;
  const rotYSlider = document.getElementById('rotY') as HTMLInputElement;
  const rotZSlider = document.getElementById('rotZ') as HTMLInputElement;
  
  const posXVal = document.getElementById('posX-val');
  const posYVal = document.getElementById('posY-val');
  const posZVal = document.getElementById('posZ-val');
  const scaleVal = document.getElementById('scale-val');
  const rotXVal = document.getElementById('rotX-val');
  const rotYVal = document.getElementById('rotY-val');
  const rotZVal = document.getElementById('rotZ-val');
  
  if (posXSlider) posXSlider.value = currentSettings.posX.toString();
  if (posYSlider) posYSlider.value = currentSettings.posY.toString();
  if (posZSlider) posZSlider.value = currentSettings.posZ.toString();
  if (scaleSlider) scaleSlider.value = currentSettings.scale.toString();
  if (rotXSlider) rotXSlider.value = currentSettings.rotX.toString();
  if (rotYSlider) rotYSlider.value = currentSettings.rotY.toString();
  if (rotZSlider) rotZSlider.value = currentSettings.rotZ.toString();
  
  if (posXVal) posXVal.textContent = currentSettings.posX.toFixed(2);
  if (posYVal) posYVal.textContent = currentSettings.posY.toFixed(2);
  if (posZVal) posZVal.textContent = currentSettings.posZ.toFixed(2);
  if (scaleVal) scaleVal.textContent = currentSettings.scale.toFixed(2);
  if (rotXVal) rotXVal.textContent = currentSettings.rotX.toString();
  if (rotYVal) rotYVal.textContent = currentSettings.rotY.toString();
  if (rotZVal) rotZVal.textContent = currentSettings.rotZ.toString();
}

// ===== Save settings to localStorage =====
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(currentSettings));
    console.log('🔖 Settings saved:', currentSettings);
  } catch (error) {
    console.error('❌ Failed to save settings:', error);
  }
}

// ===== Load settings from localStorage =====
function loadSettings(): boolean {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const loaded = JSON.parse(saved);
      // Merge with defaults to handle missing properties
      currentSettings = {
        posX: loaded.posX ?? DEFAULT_SETTINGS.posX,
        posY: loaded.posY ?? DEFAULT_SETTINGS.posY,
        posZ: loaded.posZ ?? DEFAULT_SETTINGS.posZ,
        scale: loaded.scale ?? DEFAULT_SETTINGS.scale,
        rotX: loaded.rotX ?? DEFAULT_SETTINGS.rotX,
        rotY: loaded.rotY ?? DEFAULT_SETTINGS.rotY,
        rotZ: loaded.rotZ ?? DEFAULT_SETTINGS.rotZ
      };
      autoAdjuster.setBaseScale(currentSettings.scale);
      console.log('✅ Settings loaded:', currentSettings);
      return true;
    }
  } catch (error) {
    console.error('❌ Failed to load settings:', error);
  }
  return false;
}

// ===== Initialize application =====
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 MindAR Glasses Try-On - Initializing...');
  // Force deterministic defaults on startup for easier fit debugging.
  currentSettings = { ...DEFAULT_SETTINGS };
  initControls();
  
  // Initialize automatic adjustment pipeline
  // Call this after MindAR is ready to enable real-time auto-adjustment
  setTimeout(() => initializeAutoAdjustmentPipeline(), 2000);
});

// Console API Examples:
// window.enableAutoAdjust() - Manually enable auto-adjustment (position only)
// window.disableAutoAdjust() - Disable auto-adjustment  
// window.setAutoScaleEnabled(true) - Enable automatic scale calculation
// window.setAutoScaleEnabled(false) - Disable (default - position only)
// window.isAutoScaleEnabled() - Check current status
// window.getFaceMeasurements() - Get average face measurements
// window.getRecommendedSettings() - Get recommended glasses settings
// window.initializeAutoAdjustmentPipeline() - Auto-initialize on startup

console.log('📦 main.ts loaded');

/**
 * Browser Console Commands:
 * 
 * enableAutoAdjust()         - Enable automatic face-based adjustment
 * disableAutoAdjust()        - Disable automatic adjustment
 * getFaceMeasurements()      - View current face measurements
 * getRecommendedSettings()   - Get recommended settings
 */
