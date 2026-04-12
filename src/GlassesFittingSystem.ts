/**
 * GlassesFittingSystem.ts
 * 
 * Bridges MindAR face measurements to glasses scaling.
 * Converts MindAR landmark coordinates to millimeter measurements.
 */

import type { FaceMeasurements, ModelDimensions, ScaleFactors } from './GlassesScaleFactors'
import { computeScaleFactors, validateScaleFactors } from './computeScaleFactors'
import type { FaceMeasurementSystem } from './faceMeasurement'

/**
 * Pixel-to-millimeter conversion based on device DPI.
 * Default assumes ~96 DPI (typical desktop): 1 inch = 25.4mm = 96 pixels
 * Mobile devices vary; results may need empirical calibration.
 */
export class GlassesFittingSystem {
  private pixelsPerMM: number = 3.78 // Default: 96 DPI ≈ 3.78 px/mm
  private currentScaleFactors?: ScaleFactors

  constructor(
    _measurementSystem: FaceMeasurementSystem,
    pixelsPerMM?: number,
  ) {
    // _measurementSystem reserved for future use
    if (pixelsPerMM) this.pixelsPerMM = pixelsPerMM
  }

  /**
   * Set the conversion factor (pixels per millimeter)
   * Adjust based on your device's actual DPI
   */
  setPixelsPerMM(ppm: number) {
    this.pixelsPerMM = ppm
    console.log(`[GlassesFittingSystem] Set pixel density to ${ppm.toFixed(2)} px/mm`)
  }

  /**
   * Convert pixels to millimeters using the configured density
   */
  private pxToMM(pixels: number): number {
    return pixels / this.pixelsPerMM
  }

  /**
   * Convert MindAR face measurements to millimeter-based measurements.
   * MindAR gives pixel coordinates; this normalizes them to physical millimeters.
   */
  convertToMillimeters(faceMeasPx: any): FaceMeasurements {
    // Expecting faceMeasPx to have these properties (in pixels):
    // faceWidth, eyeDistance, noseWidth, faceHeight, etc.
    return {
      faceWidth: this.pxToMM(faceMeasPx.faceWidth ?? 400),
      pupillaryDist: this.pxToMM(faceMeasPx.eyeDistance ?? 120),
      noseBridgeWidth: this.pxToMM(faceMeasPx.noseWidth ?? 40),
      earToEar: this.pxToMM(faceMeasPx.faceWidth ?? 400) * 2.1, // Estimate from face width
      noseBridgeHeight: this.pxToMM(faceMeasPx.noseHeight ?? 50),
    }
  }

  /**
   * Compute scale factors from current measurements and model dimensions
   */
  computeFactors(model: ModelDimensions): ScaleFactors | null {
    // Get latest measurements from the measurement system
    // For now, we'll use default sample measurements
    // In practice, this would pull from faceMeasurement.getLatestMeasurement()

    const faceMeasPx = {
      faceWidth: 400, // pixels
      eyeDistance: 120,
      noseWidth: 40,
      faceHeight: 550,
      noseHeight: 50,
    }

    const faceMeasMM = this.convertToMillimeters(faceMeasPx)
    const factors = computeScaleFactors(faceMeasMM, model)

    // Validate the computed factors
    const validation = validateScaleFactors(factors)
    if (!validation.valid) {
      console.warn('[GlassesFittingSystem] Invalid scale factors computed:', validation.errors)
      return null
    }

    this.currentScaleFactors = factors
    return factors
  }

  /**
   * Get the most recently computed scale factors
   */
  getScaleFactors(): ScaleFactors | undefined {
    return this.currentScaleFactors
  }

  /**
   * Format factors for logging/debugging
   */
  formatFactors(factors: ScaleFactors): string {
    return `
Frame:   x=${factors.frame.x.toFixed(3)} y=${factors.frame.y.toFixed(3)} z=${factors.frame.z.toFixed(3)}
Bridge:  x=${factors.bridge.x.toFixed(3)} y=${factors.bridge.y.toFixed(3)} z=${factors.bridge.z.toFixed(3)}
Temple:  x=${factors.temple.x.toFixed(3)} y=${factors.temple.y.toFixed(3)} z=${factors.temple.z.toFixed(3)}
NosePad: x=${factors.nosePad.x.toFixed(3)} y=${factors.nosePad.y.toFixed(3)} z=${factors.nosePad.z.toFixed(3)}
    `.trim()
  }
}
