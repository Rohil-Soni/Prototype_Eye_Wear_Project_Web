# FastRenderer Documentation

## Overview
FastRenderer is a custom WebGL renderer built on top of Three.js, optimized for real-time AR glasses try-on applications. It solves transparency issues and provides better performance than standard Three.js setup.

## Key Features

### 🚀 Performance Optimizations
- **O(n) time complexity** for object addition (where n = number of meshes)
- **O(1) time complexity** for rendering
- Material caching to avoid redundant calculations
- Automatic separation of opaque and transparent objects
- Optimized render order for proper transparency
- High-performance renderer settings

### 🎨 Transparency Handling
- Automatic material optimization based on transparency needs
- Proper depth writing for opaque objects
- Correct blending modes for transparent objects
- Alpha-to-coverage for better transparency edges
- Double-sided rendering for transparent surfaces
- Front-side only rendering for opaque surfaces (performance boost)

### 💡 Smart Lighting
- Pre-configured 3-point lighting setup
- Optimized for glasses rendering
- Key, fill, and back lights for natural appearance

## Usage

### Basic Setup

```typescript
import { FastRenderer } from './renderer';

// Initialize renderer
const renderer = new FastRenderer({
  width: 1280,
  height: 720,
  alpha: true,          // Transparent background
  antialias: true,      // Smooth edges
  pixelRatio: window.devicePixelRatio,
  sortObjects: true     // Enable for transparency
});

// Get canvas and add to DOM
const canvas = renderer.getCanvas();
document.body.appendChild(canvas);

// Setup lighting
renderer.setupLighting();
```

### Adding 3D Models

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('model.glb', (gltf) => {
  // Configure materials
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      const materials = Array.isArray(child.material) 
        ? child.material 
        : [child.material];
      
      materials.forEach((mat) => {
        // For opaque parts (frame)
        if (mat.name.includes('frame')) {
          mat.transparent = false;
          mat.opacity = 1.0;
          mat.color.setHex(0x1a1a1a); // Black
        }
        // For transparent parts (lenses)
        else if (mat.name.includes('lens')) {
          mat.transparent = true;
          mat.opacity = 0.15; // Subtle tint
          mat.color.setHex(0x88ccff); // Light blue
        }
        
        mat.needsUpdate = true;
      });
    }
  });
  
  // Add to renderer (automatically optimizes)
  renderer.addObject(gltf.scene);
});
```

### Render Loop

```typescript
function animate() {
  // Your face tracking / positioning code here
  
  // Render scene
  renderer.render();
  
  requestAnimationFrame(animate);
}

animate();
```

### Cleanup

```typescript
// When done, dispose resources
renderer.dispose();
```

## API Reference

### Constructor

```typescript
new FastRenderer(config: RenderConfig)
```

**RenderConfig:**
- `width: number` - Canvas width in pixels
- `height: number` - Canvas height in pixels
- `alpha?: boolean` - Enable transparent background (default: true)
- `antialias?: boolean` - Enable antialiasing (default: true)
- `pixelRatio?: number` - Device pixel ratio (default: window.devicePixelRatio)
- `sortObjects?: boolean` - Sort objects for transparency (default: true)

### Methods

#### `addObject(object: THREE.Object3D): void`
Adds a 3D object to the scene with automatic material optimization.
- Separates opaque and transparent meshes
- Configures proper render order
- Sets optimal material properties
- **Time Complexity:** O(n) where n = number of child meshes

#### `removeObject(object: THREE.Object3D): void`
Removes a 3D object from the scene.
- **Time Complexity:** O(n) where n = number of child meshes

#### `render(): void`
Renders the current scene.
- Proper transparency layering
- Logs FPS every 60 frames (debug)
- **Time Complexity:** O(1) - GPU handles mesh processing

#### `setupLighting(): void`
Configures optimized 3-point lighting for glasses.

#### `resize(width: number, height: number): void`
Updates canvas size and camera aspect ratio.

#### `setCameraPosition(x: number, y: number, z: number): void`
Updates camera position and makes it look at origin.

#### `getCanvas(): HTMLCanvasElement`
Returns the canvas element.

#### `getScene(): THREE.Scene`
Returns the Three.js scene.

#### `getCamera(): THREE.PerspectiveCamera`
Returns the Three.js camera.

#### `getRenderer(): THREE.WebGLRenderer`
Returns the underlying Three.js renderer (for advanced usage).

#### `getStats(): { fps: number; triangles: number; drawCalls: number }`
Returns performance statistics.

#### `dispose(): void`
Cleans up all resources (geometries, materials, renderer).

## Performance Tips

1. **Material Naming Convention:** Name materials descriptively (e.g., "frame", "lens") so the renderer can optimize them automatically.

2. **Pixel Ratio:** Limit pixel ratio to 2 maximum for balance between quality and performance:
   ```typescript
   pixelRatio: Math.min(window.devicePixelRatio, 2)
   ```

3. **Object Hierarchy:** Keep object hierarchy shallow for faster traversal.

4. **Texture Size:** Use power-of-two textures (256, 512, 1024) for better GPU performance.

5. **Polygon Count:** Keep glasses model under 10k triangles for real-time performance.

## Transparency Best Practices

1. **Opaque Materials:**
   - Set `transparent = false`
   - Set `depthWrite = true`
   - Use `THREE.FrontSide` for culling

2. **Transparent Materials:**
   - Set `transparent = true`
   - Set `depthWrite = false` (CRITICAL!)
   - Use `THREE.DoubleSide` to avoid culling issues
   - Set `alphaTest` to discard fully transparent pixels
   - Keep opacity > 0.1 for visibility

3. **Render Order:**
   - Opaque objects render first (automatic)
   - Transparent objects render after (automatic)

## Troubleshooting

### Transparency looks wrong
- Ensure `depthWrite = false` for transparent materials
- Check that `sortObjects = true` in config
- Verify materials are marked as `transparent = true`

### Performance issues
- Reduce pixel ratio to 1
- Lower polygon count of model
- Disable antialias if needed
- Check FPS with `getStats()`

### Objects not visible
- Check camera position with `setCameraPosition()`
- Verify objects are added with `addObject()`
- Check object scale and position
- Ensure materials have `opacity > 0`

## Example: Complete Integration

See [main.ts](src/main.ts) for a complete working example with MediaPipe face tracking.
