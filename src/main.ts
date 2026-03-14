// src/main.ts - MindAR Implementation with Auto-Adjustment
import './style.css';
import * as THREE from 'three';
import { FaceMeasurementSystem } from './faceMeasurement.ts';
import { AutoAdjuster, type AdjustmentSettings } from './autoAdjuster.ts';

// ===== Settings Storage =====
const SETTINGS_KEY = 'mindar-glasses-settings';

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

// ===== Initialize Controls =====
function initControls() {
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
  
  const saveBtn = document.getElementById('saveBtn');
  const loadBtn = document.getElementById('loadBtn');

  // Wait for A-Frame to initialize
  const scene = document.querySelector('a-scene');
  
  scene?.addEventListener('loaded', () => {
    console.log('✅ A-Frame scene loaded');
    glassesEntity = document.getElementById('glasses');
    
    if (!glassesEntity) {
      console.error('❌ Glasses entity not found');
      return;
    }

    // Get MindAR anchor entity reference
    const glassesAnchor = document.getElementById('glasses-anchor') as any;
    
    if (glassesAnchor) {
      // Initialize face measurement system with anchor entity
      faceMeasurement.initialize(glassesAnchor);
      faceMeasurement.startTracking();
      
      // Start measuring face on interval (when face is detected)
      setInterval(() => {
        if (glassesAnchor.object3D && glassesAnchor.object3D.visible) {
          faceMeasurement.measureFace();
        }
      }, 1000);
      
      console.log('✅ Face measurement system active');
    } else {
      console.error('❌ Glasses anchor not found - face measurement disabled');
    }

    // Update UI to reflect current settings
    updateUIFromSettings();

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
    x: currentSettings.posX,
    y: currentSettings.posY,
    z: currentSettings.posZ
  });
  
  glassesEntity.setAttribute('scale', {
    x: currentSettings.scale,
    y: currentSettings.scale,
    z: currentSettings.scale
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
