// src/main.ts - MindAR Implementation with Auto-Adjustment
import './style.css';
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
let currentSettings: GlassesSettings = {
  posX: 0,
  posY: 0,
  posZ: -0.15,
  scale: 0.1,  // Match HTML default
  rotX: 0,
  rotY: 0,
  rotZ: 0
};

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

    // Load saved settings if available
    loadSettings();
    
    // Update UI to reflect current settings
    updateUIFromSettings();

    // Apply material settings for proper transparency
    glassesEntity.addEventListener('model-loaded', () => {
      console.log('✅ GLTF model loaded');
      const mesh = glassesEntity.getObject3D('mesh');
      
      if (mesh) {
        mesh.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            
            materials.forEach((mat: any) => {
              // Frame materials (opaque)
              if (mat.name.toLowerCase().includes('frame') || 
                  mat.name.toLowerCase().includes('stem')) {
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.side = 0; // THREE.FrontSide
                mat.depthWrite = true;
                mat.depthTest = true;
                mat.color.setHex(0x1a1a1a); // Dark frame
                mat.metalness = 0.05;
                mat.roughness = 0.4;
              }
              // Lens materials (transparent)
              else if (mat.name.toLowerCase().includes('lens') || 
                       mat.name.toLowerCase().includes('glass')) {
                mat.transparent = true;
                mat.opacity = 0.15; // Subtle transparency
                mat.side = 2; // THREE.DoubleSide
                mat.depthWrite = false; // Critical for transparency!
                mat.depthTest = true;
                mat.color.setHex(0x88ccff); // Light blue tint
                mat.metalness = 0.9;
                mat.roughness = 0.1;
                // Proper blending
                mat.blending = 1; // THREE.NormalBlending
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
    currentSettings = {
      ...currentSettings,
      scale: settings.scale,
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
    currentSettings = {
      ...currentSettings,
      scale: settings.scale,
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
        posX: loaded.posX ?? 0,
        posY: loaded.posY ?? 0,
        posZ: loaded.posZ ?? -0.05,
        scale: loaded.scale ?? 0.5,  // Match HTML default
        rotX: loaded.rotX ?? 0,
        rotY: loaded.rotY ?? 0,
        rotZ: loaded.rotZ ?? 0
      };
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
