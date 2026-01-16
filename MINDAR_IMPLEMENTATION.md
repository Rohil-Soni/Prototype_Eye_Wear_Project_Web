# MindAR Implementation - Transparency Fix

## What Changed?

I've rebuilt your glasses try-on application using **MindAR with A-Frame**, which completely solves the transparency issue through proper WebGL rendering and material handling.

## Key Improvements

### 1. **Automatic Transparency Handling**
- A-Frame's renderer automatically handles transparency correctly
- No need for custom FastRenderer or complex material sorting
- Proper depth writing and blending out of the box

### 2. **Simplified Architecture**
```
Before: MediaPipe → Three.js → Custom Renderer → Manual material handling
After:  MindAR → A-Frame → Built-in Three.js integration → Automatic handling
```

### 3. **Face Tracking**
- Uses anchor point 168 (nose bridge area) for glasses placement
- MindAR provides 486 anchor points across the face
- Automatic scaling based on face size (face width = 1 unit)
- Automatic rotation based on face orientation

### 4. **Material Configuration**
The implementation now properly handles:
- **Opaque frame**: `transparent: false`, `depthWrite: true`
- **Transparent lenses**: `transparent: true`, `depthWrite: false`, `opacity: 0.15`
- Proper blending modes for realistic glass appearance

## How It Works

### HTML Structure (index.html)
```html
<a-scene mindar-face embedded renderer="alpha: true, sortObjects: true">
  <a-entity mindar-face-target="anchorIndex: 168">
    <a-entity gltf-model="#glassesModel"></a-entity>
  </a-entity>
</a-scene>
```

### Key Features
- **mindar-face**: Enables MindAR face tracking
- **embedded**: Embeds AR view in page (not fullscreen)
- **anchorIndex: 168**: Anchors glasses to nose bridge
- **renderer settings**: Ensures proper transparency and color management

### Controls
The UI provides real-time adjustment:
- Position X, Y, Z sliders
- Scale slider
- Save/Load presets via localStorage

## Why This Fixes Transparency

1. **Correct Render Order**: A-Frame automatically sorts objects for proper transparency rendering
2. **Depth Buffer Management**: Transparent objects don't write to depth buffer (`depthWrite: false`)
3. **Proper Blending**: Uses `NormalBlending` with correct blend factors
4. **Material Separation**: Frame and lenses are handled differently based on their transparency needs
5. **Color Management**: Proper sRGB color space handling

## Running the Application

```bash
npm run dev
```

Then open http://localhost:5173/ and allow camera access.

## Customization

### Adjust Anchor Point
Change `anchorIndex` in [index.html](index.html) to anchor glasses to different face positions:
- 168: Nose bridge (current)
- 1: Nose tip
- 33/263: Left/right eyes
- [Full anchor map](https://github.com/tensorflow/tfjs-models/blob/master/face-landmarks-detection/mesh_map.jpg)

### Modify Materials
Edit the material configuration in [src/main.ts](src/main.ts#L50-L77):
```typescript
// Frame: opaque, dark color
mat.transparent = false;
mat.color.setHex(0x1a1a1a);

// Lens: transparent, tinted
mat.transparent = true;
mat.opacity = 0.15;
mat.color.setHex(0x88ccff);
```

## Technical Notes

- **Face Width Scale**: MindAR normalizes face width to 1.0 units
- **Auto-rotation**: Face rotation automatically applied based on eye positions
- **Performance**: MindAR is highly optimized for real-time face tracking
- **Browser Support**: Works in all modern browsers with WebGL support

## Migration from Previous Implementation

### Removed
- Custom `FastRenderer` class
- Manual MediaPipe integration
- Complex skeleton/bone system
- Manual camera setup
- Custom lighting setup (now handled by A-Frame)

### Added
- MindAR face tracking (via CDN)
- A-Frame integration (via CDN)
- Simplified control system
- Automatic transparency handling

## Troubleshooting

**Glasses not appearing?**
- Check browser console for model loading errors
- Verify `/models/glasses.glb` path is correct
- Ensure camera permissions are granted

**Transparency still wrong?**
- Check material names in your GLTF model
- Adjust the material detection logic in main.ts
- Verify opacity values (0.0 = fully transparent, 1.0 = opaque)

**Tracking issues?**
- Ensure good lighting conditions
- Face the camera directly
- Try different anchor points

## References

- [MindAR Documentation](https://hiukim.github.io/mind-ar-js-doc/)
- [A-Frame Documentation](https://aframe.io/docs/)
- [Face Anchor Points Map](https://github.com/tensorflow/tfjs-models/blob/master/face-landmarks-detection/mesh_map.jpg)
