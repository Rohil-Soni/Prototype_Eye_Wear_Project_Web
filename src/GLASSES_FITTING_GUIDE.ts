/**
 * GLASSES FITTING INTEGRATION GUIDE
 * ═════════════════════════════════════════════════════════════════
 * 
 * This document explains how to integrate the glasses scaling system
 * into your existing MindAR AR.js setup.
 * 
 * FILES CREATED:
 * ─────────────────────────────────────────────────────────────────
 * 
 * 1. GlassesScaleFactors.ts
 *    └─ Type definitions for all measurements and scale factors
 * 
 * 2. computeScaleFactors.ts
 *    └─ Pure math: face measurements → scale factors
 *    └─ No dependencies; safe for testing in isolation
 * 
 * 3. GlassesFitter.ts
 *    └─ Three.js integration for loading GLB and applying scales
 *    └─ Handles mesh discovery and safe scaling from centroids
 * 
 * 4. GlassesFittingSystem.ts
 *    └─ Bridges MindAR measurements to glasses scaling
 *    └─ Converts pixel coordinates to millimeters
 * 
 * 5. GlassesFittingIntegration.ts
 *    └─ High-level wrapper for easy integration
 *    └─ Use this for simplest path to get started
 * 
 * 
 * QUICK START
 * ═════════════════════════════════════════════════════════════════
 * 
 * Step 1: Import the integration class
 * ─────────────────────────────────────────────────────────────────
 * 
 * import { GlassesFittingIntegration } from './GlassesFittingIntegration'
 * import { FaceMeasurementSystem } from './faceMeasurement'
 * 
 * 
 * Step 2: Initialize in your MindAR setup
 * ─────────────────────────────────────────────────────────────────
 * 
 * const faceMeasurement = new FaceMeasurementSystem()
 * let fittingIntegration: GlassesFittingIntegration
 * 
 * // After Three.js scene is created:
 * fittingIntegration = new GlassesFittingIntegration(
 *   faceMeasurement,
 *   scene,  // Your Three.js scene
 *   camera, // Your camera
 * )
 * 
 * // Load the glasses model
 * await fittingIntegration.loadGlassesModel('/models/glasses.glb')
 * 
 * // (Optional) Print available part names for debugging:
 * console.log(fittingIntegration.getAvailableParts())
 * 
 * 
 * Step 3: Update when face measurements change
 * ─────────────────────────────────────────────────────────────────
 * 
 * // Register a measurement callback in your faceMeasurement.ts:
 * 
 * onMeasurementUpdate(callback: (measurement: FaceMeasurements) => void) {
 *   this.measurementCallback = callback
 * }
 * 
 * // Then in main.ts, when creating the face measurement system:
 * 
 * faceMeasurement.onMeasurementUpdate((measurement) => {
 *   // Convert to pixel measurements (from your MindAR landmarks)
 *   const faceMeasPx = {
 *     faceWidth: measurement.faceWidth * 1000 / someScale,  // convert to pixels
 *     eyeDistance: measurement.eyeDistance * 1000 / someScale,
 *     noseWidth: measurement.noseWidth * 1000 / someScale,
 *     faceHeight: measurement.faceHeight * 1000 / someScale,
 *     noseHeight: measurement.noseBridgeHeight * 1000 / someScale,
 *   }
 *   
 *   // Update glasses
 *   fittingIntegration.updateFromMeasurements(faceMeasPx)
 * })
 * 
 * 
 * CALIBRATION
 * ═════════════════════════════════════════════════════════════════
 * 
 * The system converts pixel measurements to millimeters using a
 * pixel density (px/mm) value. By default: 3.78 px/mm (96 DPI).
 * 
 * For your specific device/camera, you may need to calibrate:
 * 
 * // Override pixel density for your device:
 * fittingIntegration.setPixelDensity(4.0) // adjust as needed
 * 
 * To calibrate:
 * 1. Measure a known object (e.g., credit card: 85.6 × 53.98 mm)
 * 2. Have MindAR detect and measure it
 * 3. Compare: pixelsPerMM = measured_pixels / known_mm
 * 
 * 
 * REFERENCE: MODEL DIMENSIONS
 * ═════════════════════════════════════════════════════════════════
 * 
 * These are the reference dimensions of the 3D glasses model.
 * Ensure these match your actual GLB file!
 * 
 * If your model has different dimensions, update:
 * GlassesFittingIntegration.ts → GLASSES_MODEL_DIMENSIONS
 * 
 * Dimensions you need to measure:
 * ─────────────────────────────────────────────────────────────────
 * 
 * frameWidth          140 mm   Total frame width (temple to temple)
 * bridgeWidth          18 mm   Bridge/nose piece width
 * lensWidth            52 mm   Individual lens width
 * lensHeight           40 mm   Individual lens height
 * templeLength        145 mm   Temple arm length
 * nosePadGap           12 mm   Nose pad height/gap
 * 
 * How to measure:
 * - In your 3D software, use the measurement tool
 * - Or calculate from vertex coordinates if you have the model data
 * - Ensure consistent units (all mm recommended)
 * 
 * 
 * MATHEMATHICAL FOUNDATION
 * ═════════════════════════════════════════════════════════════════
 * 
 * The scaling accounts for:
 * 
 * 1. FRAME WIDTH (Sx, Sy)
 *    ─────────────────────
 *    Primary scale driver. Scales proportionally to maintain lens shape.
 *    
 *    Sx = (face_width - 16mm clearance) / model_frame_width
 *    Sy = Sx  // keep aspect ratio
 * 
 * 
 * 2. DEPTH (Sz)
 *    ──────────
 *    How much the frame protrudes. Follows face width.
 *    
 *    Sz = face_width / model_frame_width
 * 
 * 
 * 3. BRIDGE
 *    ──────
 *    Scales to match the user's actual nose bridge width.
 *    
 *    bridge_scale = nose_bridge_face / model_bridge_width
 * 
 * 
 * 4. TEMPLES
 *    ───────
 *    Derived geometrically from ear-to-ear measurement.
 *    Ensures arms wrap properly from frame edge to ear.
 *    
 *    temple_target = (ear_to_ear / 2) - (scaled_frame_width / 2)
 *    temple_scale = temple_target / model_temple_length
 * 
 * 
 * 5. NOSE PAD
 *    ────────
 *    Scales height to match nose bridge height on face.
 *    
 *    nosePad_scale = nose_bridge_height_face / model_nosePad_gap
 * 
 * 
 * DEBUGGING
 * ═════════════════════════════════════════════════════════════════
 * 
 * 1. Check available mesh names:
 * 
 *    const parts = fittingIntegration.getAvailableParts()
 *    console.log('Parts:', parts)
 *    
 *    Update GlassesPartNames if your model uses different names.
 * 
 * 
 * 2. Verify loaded model:
 * 
 *    if (!fittingIntegration.hasPart('Frame')) {
 *      console.warn('Frame mesh not found!')
 *    }
 * 
 * 
 * 3. Check computed scale factors:
 * 
 *    // Browser console will log scale factors when updating:
 *    console.log('[GlassesFittingIntegration] Applied scale factors...')
 * 
 * 
 * 4. Inspect individual parts:
 * 
 *    const frameMesh = fittingIntegration.getPart('Frame')
 *    console.log('Frame scale:', frameMesh?.scale)
 * 
 * 
 * TESTING (Standalone Unit Tests)
 * ═════════════════════════════════════════════════════════════════
 * 
 * The computeScaleFactors() function is pure and testable:
 * 
 * import { computeScaleFactors } from './computeScaleFactors'
 * 
 * const face = {
 *   faceWidth: 152,
 *   pupillaryDist: 64,
 *   noseBridgeWidth: 20,
 *   earToEar: 320,
 *   noseBridgeHeight: 22,
 * }
 * 
 * const model = {
 *   frameWidth: 140,
 *   bridgeWidth: 18,
 *   lensWidth: 52,
 *   lensHeight: 40,
 *   templeLength: 145,
 *   nosePadGap: 12,
 * }
 * 
 * const factors = computeScaleFactors(face, model)
 * console.log(factors.frame.x) // Should be ~0.9714
 * 
 * 
 * INTEGRATION WITH AUTOAJUSTER
 * ═════════════════════════════════════════════════════════════════
 * 
 * If using autoAdjuster.ts, you can couple it:
 * 
 * autoAdjuster.enable((settings) => {
 *   // Apply auto-adjusted scale to glasses
 *   fittingIntegration.updateFromMeasurements({...})
 * })
 * 
 * 
 * TROUBLESHOOTING
 * ═════════════════════════════════════════════════════════════════
 * 
 * Issue: "Part 'Frame' not found in scene"
 * ─────────────────────────────────────────
 * Solution: Call getAvailableParts() and update GlassesPartNames
 *           with the actual mesh names from your GLB.
 * 
 * 
 * Issue: Glasses too big or too small
 * ────────────────────────────────────
 * Solution: Check GLASSES_MODEL_DIMENSIONS match your actual model.
 *           Calibrate pixel density: setPixelDensity(...)
 * 
 * 
 * Issue: Glasses distorted (wrong aspect)
 * ───────────────────────────────────────
 * Solution: Ensure Sy stays proportional to Sx (it does by default).
 *           Check model is correctly constructed in 3D software.
 * 
 * 
 * Issue: Scale factors invalid
 * ────────────────────────────
 * Solution: Check face measurements are reasonable (not zero/NaN).
 *           Validation logs will show what went wrong.
 */

// Export everything for user convenience
export { GlassesFitter } from './GlassesFitter'
export { GlassesFittingIntegration } from './GlassesFittingIntegration'
export { GlassesFittingSystem } from './GlassesFittingSystem'
export { computeScaleFactors, computeScaledDimensions, validateScaleFactors } from './computeScaleFactors'
export type {
  FaceMeasurements,
  ModelDimensions,
  ScaleFactors,
  GlassesPartNames,
} from './GlassesScaleFactors'
