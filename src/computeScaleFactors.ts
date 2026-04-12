/**
 * computeScaleFactors.ts
 * 
 * Pure mathematical computation of scale factors.
 * No Three.js or DOM dependencies — easily testable in isolation.
 */

import type {
  FaceMeasurements,
  ModelDimensions,
  ScaleFactors,
  ComputedDimensions,
} from './GlassesScaleFactors'

const CLEARANCE_MM = 16 // 8mm each side; prevents frame from digging into temples

/**
 * Compute all scale factors needed to fit a 3D glasses model to a specific face.
 * 
 * @param face - Measured face dimensions
 * @param model - Reference 3D model dimensions
 * @returns ScaleFactors object with frame, bridge, temple, nosePad scaling
 */
export function computeScaleFactors(
  face: FaceMeasurements,
  model: ModelDimensions,
): ScaleFactors {
  // ─────────────────────────────────────────────────────────────────
  // PRIMARY: Frame width drives Sx and Sy (preserve aspect ratio)
  // ─────────────────────────────────────────────────────────────────
  // Account for clearance so glasses sit naturally on face
  const targetFrameWidth = face.faceWidth - CLEARANCE_MM
  const Sx = targetFrameWidth / model.frameWidth

  // Keep vertical scale proportional to maintain lens shape
  const Sy = Sx

  // Depth follows overall face width
  const Sz = face.faceWidth / model.frameWidth

  // ─────────────────────────────────────────────────────────────────
  // BRIDGE: Scale independently to match nose bridge width
  // ─────────────────────────────────────────────────────────────────
  const bridgeX = face.noseBridgeWidth / model.bridgeWidth
  const bridgeY = Sy
  const bridgeZ = Sz

  // ─────────────────────────────────────────────────────────────────
  // TEMPLE: Derived from ear-to-ear geometry
  // Temple must reach from edge of scaled frame to ear point
  // ─────────────────────────────────────────────────────────────────
  const scaledFrameHalf = (model.frameWidth * Sx) / 2
  const earHalfDistance = face.earToEar / 2
  const targetTempleLength = earHalfDistance - scaledFrameHalf

  // Prevent negative or zero temple length
  const safeTempleLength = Math.max(targetTempleLength, model.templeLength * 0.3)
  const templeX = safeTempleLength / model.templeLength
  const templeY = Sy
  const templeZ = Sz

  // ─────────────────────────────────────────────────────────────────
  // NOSE PAD: Scale height to match nose bridge height on face
  // ─────────────────────────────────────────────────────────────────
  const nosePadX = Sx
  const nosePadY = face.noseBridgeHeight / model.nosePadGap
  const nosePadZ = Sz

  return {
    frame: { x: Sx, y: Sy, z: Sz },
    bridge: { x: bridgeX, y: bridgeY, z: bridgeZ },
    temple: { x: templeX, y: templeY, z: templeZ },
    nosePad: { x: nosePadX, y: nosePadY, z: nosePadZ },
  }
}

/**
 * Compute what the final model dimensions will be after scaling.
 * Useful for validation and logging.
 */
export function computeScaledDimensions(
  model: ModelDimensions,
  factors: ScaleFactors,
): ComputedDimensions {
  return {
    frameWidth: model.frameWidth * factors.frame.x,
    bridgeWidth: model.bridgeWidth * factors.bridge.x,
    lensWidth: model.lensWidth * factors.frame.x,
    lensHeight: model.lensHeight * factors.frame.y,
    templeLength: model.templeLength * factors.temple.x,
    nosePadGap: model.nosePadGap * factors.nosePad.y,
  }
}

/**
 * Validate scale factors are in reasonable bounds
 */
export function validateScaleFactors(factors: ScaleFactors): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  const MIN_SCALE = 0.1
  const MAX_SCALE = 3.0

  const checkVector = (name: string, v: { x: number; y: number; z: number }) => {
    if (v.x < MIN_SCALE || v.x > MAX_SCALE)
      errors.push(`${name}.x out of bounds: ${v.x.toFixed(3)}`)
    if (v.y < MIN_SCALE || v.y > MAX_SCALE)
      errors.push(`${name}.y out of bounds: ${v.y.toFixed(3)}`)
    if (v.z < MIN_SCALE || v.z > MAX_SCALE)
      errors.push(`${name}.z out of bounds: ${v.z.toFixed(3)}`)
  }

  checkVector('frame', factors.frame)
  checkVector('bridge', factors.bridge)
  checkVector('temple', factors.temple)
  checkVector('nosePad', factors.nosePad)

  return {
    valid: errors.length === 0,
    errors,
  }
}
