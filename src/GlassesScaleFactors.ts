/**
 * GlassesScaleFactors.ts
 * 
 * Type definitions for glasses scaling pipeline.
 * Measurements are in millimeters throughout.
 */

export interface FaceMeasurements {
  faceWidth: number;         // temple to temple distance (mm)
  pupillaryDist: number;     // PD - pupil to pupil distance (mm)
  noseBridgeWidth: number;   // width of nose bridge (mm)
  earToEar: number;          // ear to ear over the top of head (mm)
  noseBridgeHeight: number;  // height of nose bridge (mm)
}

export interface ModelDimensions {
  frameWidth: number;   // overall frame width (mm)
  bridgeWidth: number;  // bridge/nose piece width (mm)
  lensWidth: number;    // individual lens width (mm)
  lensHeight: number;   // individual lens height (mm)
  templeLength: number; // temple arm length (mm)
  nosePadGap: number;   // nose pad/gap height (mm)
}

export interface ScaleVector {
  x: number;
  y: number;
  z: number;
}

export interface ScaleFactors {
  frame: ScaleVector;    // overall frame scaling [x, y, z]
  bridge: ScaleVector;   // bridge piece scaling
  temple: ScaleVector;   // temple arms scaling (both L/R use same values)
  nosePad: ScaleVector;  // nose pad scaling
}

export interface GlassesPartNames {
  frame?: string;            // Root frame mesh
  bridge?: string;           // Bridge/nose piece
  templeLeft?: string;       // Left temple arm
  templeRight?: string;      // Right temple arm
  nosePadLeft?: string;      // Left nose pad
  nosePadRight?: string;     // Right nose pad
  glassesRoot?: string;      // Alternative: single root for all
}

/**
 * Computed dimensions after scaling (for reference/logging)
 */
export interface ComputedDimensions {
  frameWidth: number;
  bridgeWidth: number;
  lensWidth: number;
  lensHeight: number;
  templeLength: number;
  nosePadGap: number;
}
