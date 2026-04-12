/**
 * GlassesFittingIntegration.ts
 * 
 * Shows how to integrate the glasses fitting system into your existing MindAR setup.
 * 
 * USAGE EXAMPLE:
 * 
 * 1. Load glasses and faces:
 *    const fitting = new GlassesFittingIntegration(faceMeasurementSystem, scene, camera)
 *    await fitting.loadGlasesModel('/models/glasses.glb')
 * 
 * 2. When face measurements update, call:
 *    fitting.updateFromMeasurements(newMeasurements)
 * 
 * 3. This automatically scales the glasses in the Three.js scene
 */

import * as THREE from 'three'
import { GlassesFitter } from './GlassesFitter'
import type { ModelDimensions, GlassesPartNames } from './GlassesScaleFactors'
import type { FaceMeasurementSystem } from './faceMeasurement'
import { GlassesFittingSystem } from './GlassesFittingSystem'

/**
 * Reference dimensions of the 3D glasses model.
 * These should match your actual GLB file dimensions.
 * Measure in your 3D software or get from model metadata.
 */
export const GLASSES_MODEL_DIMENSIONS: ModelDimensions = {
  frameWidth: 140,   // mm
  bridgeWidth: 18,   // mm
  lensWidth: 52,     // mm
  lensHeight: 40,    // mm
  templeLength: 145, // mm
  nosePadGap: 12,    // mm
}

/**
 * Default part names in the GLB file.
 * If your model uses different names, override these.
 */
export const DEFAULT_PART_NAMES: GlassesPartNames = {
  frame: 'Frame',
  bridge: 'Bridge',
  templeLeft: 'Temple_L',
  templeRight: 'Temple_R',
  nosePadLeft: 'NosePad_L',
  nosePadRight: 'NosePad_R',
}

export class GlassesFittingIntegration {
  private fitter?: GlassesFitter
  private fittingSystem: GlassesFittingSystem
  private scene: THREE.Scene | THREE.Group
  private glassesModel?: THREE.Object3D
  private isReady = false

  constructor(
    measurementSystem: FaceMeasurementSystem,
    scene: THREE.Scene | THREE.Group,
    _camera: THREE.Camera,
    pixelsPerMM?: number,
  ) {
    this.scene = scene
    this.fittingSystem = new GlassesFittingSystem(measurementSystem, pixelsPerMM)
  }

  /**
   * Load the glasses GLB model from a URL
   */
  async loadGlassesModel(url: string): Promise<void> {
    try {
      this.fitter = await GlassesFitter.fromURL(url)
      this.glassesModel = this.fitter.getScene()

      // Add to scene
      this.scene.add(this.glassesModel)

      this.isReady = true

      // Debug: log available mesh names
      const parts = this.fitter.listParts()
      console.log('[GlassesFittingIntegration] Loaded glasses model with parts:', parts)

      return
    } catch (err) {
      console.error('[GlassesFittingIntegration] Failed to load glasses model:', err)
      throw err
    }
  }

  /**
   * Update glasses scaling based on face measurements.
   * Call this whenever measurements change.
   */
  updateFromMeasurements(
    _faceMeasurementPx: any,
    partNames: GlassesPartNames = DEFAULT_PART_NAMES,
  ): void {
    if (!this.isReady || !this.fitter) {
      console.warn('[GlassesFittingIntegration] Not ready yet; call loadGlassesModel first')
      return
    }

    // Compute scale factors (measurements converted internally)
    const factors = this.fittingSystem.computeFactors(GLASSES_MODEL_DIMENSIONS)
    if (!factors) {
      console.warn('[GlassesFittingIntegration] Could not compute scale factors')
      return
    }

    // Apply to the Three.js model
    this.fitter.applyScaleFactors(factors, partNames)

    // Log for debugging
    console.log('[GlassesFittingIntegration] Applied scale factors:\n' + this.fittingSystem.formatFactors(factors))
  }

  /**
   * Get the part names available in the currently loaded model
   */
  getAvailableParts(): string[] {
    if (!this.fitter) return []
    return this.fitter.listParts()
  }

  /**
   * Check if a specific part exists
   */
  hasPart(name: string): boolean {
    if (!this.fitter) return false
    return this.fitter.hasPart(name)
  }

  /**
   * Get a specific part for direct manipulation
   */
  getPart(name: string): THREE.Object3D | undefined {
    if (!this.fitter) return undefined
    return this.fitter.getPart(name)
  }

  /**
   * Set the pixel-to-millimeter conversion factor
   * (for device DPI calibration)
   */
  setPixelDensity(pixelsPerMM: number): void {
    this.fittingSystem.setPixelsPerMM(pixelsPerMM)
  }

  /**
   * Get the underlying GlassesFitter for advanced operations
   */
  getFitter(): GlassesFitter | undefined {
    return this.fitter
  }

  /**
   * Get the underlying fitting system for advanced operations
   */
  getFittingSystem(): GlassesFittingSystem {
    return this.fittingSystem
  }
}
