// src/main.ts - MindAR Implementation
import './style.css';

// ===== Settings Storage =====
const SETTINGS_KEY = 'mindar-glasses-settings';

interface GlassesSettings {
  posX: number;
  posY: number;
  posZ: number;
  scale: number;
}

let glassesEntity: any;
let currentSettings: GlassesSettings = {
  posX: 0,
  posY: 0.05,
  posZ: 0,
  scale: 0.05
};

// ===== Initialize Controls =====
function initControls() {
  const posXSlider = document.getElementById('posX') as HTMLInputElement;
  const posYSlider = document.getElementById('posY') as HTMLInputElement;
  const posZSlider = document.getElementById('posZ') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  
  const posXVal = document.getElementById('posX-val');
  const posYVal = document.getElementById('posY-val');
  const posZVal = document.getElementById('posZ-val');
  const scaleVal = document.getElementById('scale-val');
  
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
    if (scaleVal) scaleVal.textContent = value.toFixed(1);
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
}

// ===== Update UI controls from current settings =====
function updateUIFromSettings() {
  const posXSlider = document.getElementById('posX') as HTMLInputElement;
  const posYSlider = document.getElementById('posY') as HTMLInputElement;
  const posZSlider = document.getElementById('posZ') as HTMLInputElement;
  const scaleSlider = document.getElementById('scale') as HTMLInputElement;
  
  const posXVal = document.getElementById('posX-val');
  const posYVal = document.getElementById('posY-val');
  const posZVal = document.getElementById('posZ-val');
  const scaleVal = document.getElementById('scale-val');
  
  if (posXSlider) posXSlider.value = currentSettings.posX.toString();
  if (posYSlider) posYSlider.value = currentSettings.posY.toString();
  if (posZSlider) posZSlider.value = currentSettings.posZ.toString();
  if (scaleSlider) scaleSlider.value = currentSettings.scale.toString();
  
  if (posXVal) posXVal.textContent = currentSettings.posX.toFixed(2);
  if (posYVal) posYVal.textContent = currentSettings.posY.toFixed(2);
  if (posZVal) posZVal.textContent = currentSettings.posZ.toFixed(2);
  if (scaleVal) scaleVal.textContent = currentSettings.scale.toFixed(1);
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
      currentSettings = JSON.parse(saved);
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
});

console.log('📦 main.ts loaded');
