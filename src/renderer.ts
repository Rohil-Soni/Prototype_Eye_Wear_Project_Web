/**
 * Custom Fast Renderer for Glasses Try-On
 * Optimized for performance and proper transparency handling
 * Time Complexity: O(n) where n is number of meshes
 */

import * as THREE from 'three';

export interface RenderConfig {
  width: number;
  height: number;
  alpha?: boolean;
  antialias?: boolean;
  pixelRatio?: number;
  sortObjects?: boolean;
}

export class FastRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;
  
  // Performance optimizations
  private renderCache: Map<string, THREE.Material> = new Map();
  private needsSort: boolean = false;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  
  // Transparency handling
  private opaqueObjects: THREE.Mesh[] = [];
  private transparentObjects: THREE.Mesh[] = [];

  constructor(config: RenderConfig) {
    this.canvas = document.createElement('canvas');
    
    // Configure renderer with optimal settings
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: config.alpha ?? true,
      antialias: config.antialias ?? true,
      powerPreference: 'high-performance',
      stencil: false, // Disable if not needed - performance boost
      depth: true,
      logarithmicDepthBuffer: false, // Can cause transparency issues
      premultipliedAlpha: false // Important for transparency
    });

    this.renderer.setSize(config.width, config.height);
    this.renderer.setPixelRatio(config.pixelRatio ?? Math.min(window.devicePixelRatio, 2));
    
    // Critical renderer settings for proper transparency
    this.renderer.autoClear = false; // Manual control for proper layering
    this.renderer.sortObjects = config.sortObjects ?? true; // Sort for transparency
    
    // Output encoding for proper color rendering
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = null; // Transparent background
    
    // Camera setup
    const aspect = config.width / config.height;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    console.log('✅ FastRenderer initialized');
  }

  /**
   * Add object to scene with automatic transparency detection
   * O(n) complexity where n is number of children
   */
  addObject(object: THREE.Object3D): void {
    this.scene.add(object);
    
    // Separate opaque and transparent objects for optimal rendering
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.optimizeMaterial(child);
        
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const hasTransparency = materials.some(mat => mat.transparent || mat.opacity < 1);
        
        if (hasTransparency) {
          this.transparentObjects.push(child);
          // Set proper render order for transparency
          child.renderOrder = 100; // Render after opaque
        } else {
          this.opaqueObjects.push(child);
          child.renderOrder = 0; // Render first
        }
      }
    });
    
    this.needsSort = true;
  }

  /**
   * Optimize material settings for fast rendering and proper transparency
   * O(1) complexity
   */
  private optimizeMaterial(mesh: THREE.Mesh): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    
    materials.forEach((mat) => {
      const cacheKey = mat.uuid;
      
      if (!this.renderCache.has(cacheKey)) {
        // First time seeing this material - optimize it
        
        if (mat instanceof THREE.MeshStandardMaterial || 
            mat instanceof THREE.MeshPhysicalMaterial) {
          
          // For opaque materials (frame)
          if (!mat.transparent && mat.opacity >= 1) {
            mat.transparent = false;
            mat.alphaTest = 0;
            mat.depthWrite = true;
            mat.depthTest = true;
            mat.side = THREE.FrontSide; // Front side only for opaque - faster
            mat.alphaToCoverage = false;
          }
          // For transparent materials (lenses)
          else {
            mat.transparent = true;
            mat.depthWrite = false; // Critical for transparency!
            mat.depthTest = true;
            mat.side = THREE.DoubleSide; // Both sides for transparent
            mat.alphaTest = 0.01; // Discard fully transparent pixels
            mat.alphaToCoverage = true; // Better transparency edges
            
            // Proper blending for transparency
            mat.blending = THREE.NormalBlending;
            mat.blendSrc = THREE.SrcAlphaFactor;
            mat.blendDst = THREE.OneMinusSrcAlphaFactor;
          }
          
          // Common optimizations
          mat.precision = 'mediump'; // Balance quality/performance
          mat.needsUpdate = true;
        }
        
        this.renderCache.set(cacheKey, mat);
      }
    });
  }

  /**
   * Remove object from scene
   * O(n) complexity where n is number of children
   */
  removeObject(object: THREE.Object3D): void {
    this.scene.remove(object);
    
    // Clean up tracking arrays
    object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const opaqueIndex = this.opaqueObjects.indexOf(child);
        if (opaqueIndex !== -1) {
          this.opaqueObjects.splice(opaqueIndex, 1);
        }
        
        const transparentIndex = this.transparentObjects.indexOf(child);
        if (transparentIndex !== -1) {
          this.transparentObjects.splice(transparentIndex, 1);
        }
      }
    });
  }

  /**
   * Setup lighting optimized for glasses rendering
   */
  setupLighting(): void {
    // Clear existing lights
    this.scene.traverse((child) => {
      if (child instanceof THREE.Light) {
        this.scene.remove(child);
      }
    });

    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambient);

    // Key light (main)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2, 2, 3);
    this.scene.add(keyLight);

    // Fill light (soften shadows)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-2, 1, 2);
    this.scene.add(fillLight);

    // Back light (rim light for definition)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.4);
    backLight.position.set(0, 1, -3);
    this.scene.add(backLight);
  }

  /**
   * Fast render with proper transparency layering
   * O(1) complexity for rendering (GPU handles mesh processing)
   */
  render(): void {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.frameCount++;

    // Log FPS every 60 frames (helpful for performance monitoring)
    if (this.frameCount % 60 === 0) {
      const fps = 1000 / deltaTime;
      console.log(`📊 FPS: ${fps.toFixed(1)}`);
    }

    // Clear manually for proper transparency control
    this.renderer.clear(true, true, true);

    // Render in proper order for transparency
    // 1. Opaque objects first (with depth write)
    this.renderer.render(this.scene, this.camera);
    
    this.needsSort = false;
  }

  /**
   * Update camera aspect ratio and renderer size
   */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Update camera position
   */
  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get the scene
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Get the camera
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Get the Three.js renderer instance (for advanced usage)
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Clear tracking arrays
    this.opaqueObjects = [];
    this.transparentObjects = [];
    this.renderCache.clear();

    // Dispose scene objects
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry?.dispose();
        
        const materials = Array.isArray(object.material) 
          ? object.material 
          : [object.material];
        
        materials.forEach(mat => mat?.dispose());
      }
    });

    // Dispose renderer
    this.renderer.dispose();
    
    console.log('🗑️ FastRenderer disposed');
  }

  /**
   * Get performance stats
   */
  getStats(): { fps: number; triangles: number; drawCalls: number } {
    const info = this.renderer.info;
    const fps = 1000 / (performance.now() - this.lastFrameTime);
    
    return {
      fps: Math.round(fps),
      triangles: info.render.triangles,
      drawCalls: info.render.calls
    };
  }
}
