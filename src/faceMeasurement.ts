// src/faceMeasurement.ts - Face measurement using MediaPipe landmarks

export interface FaceMeasurements {
  faceWidth: number;        // Distance between temples (234-454)
  eyeDistance: number;      // Distance between eyes (left-right)
  noseWidth: number;        // Width of nose bridge
  faceHeight: number;       // Forehead to chin
  confidence: number;       // Measurement confidence (0-1)
  timestamp: number;        // When measurement was taken
}

export interface LandmarkPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * MindAR Face Landmark Indices:
 * 10: Forehead center
 * 152: Chin center
 * 168: Nose bridge (glasses anchor)
 * 234: Left temple
 * 454: Right temple
 * 33: Left eye outer corner
 * 263: Right eye outer corner
 * 130: Left eye inner corner
 * 359: Right eye inner corner
 */

export class FaceMeasurementSystem {
  private measurements: FaceMeasurements[] = [];
  private mindarSystem: any = null;
  private measurementInterval: number = 1000; // Measure every 1 second
  private lastMeasurementTime: number = 0;

  /**
   * Initialize the face measurement system
   * @param mindarSystem - Reference to the MindAR face tracking system
   */
  initialize(mindarSystem: any) {
    this.mindarSystem = mindarSystem;
    console.log('📏 Face Measurement System initialized');
  }

  /**
   * Start continuous face measurements
   */
  startTracking() {
    console.log('🎯 Face tracking started');
  }

  /**
   * Stop continuous face measurements
   */
  stopTracking() {
    console.log('⏸️ Face tracking stopped');
  }

  /**
   * Calculate distance between two 3D points
   */
  private calculateDistance(p1: LandmarkPoint, p2: LandmarkPoint): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Get landmark position from MindAR
   */
  private getLandmark(index: number): LandmarkPoint | null {
    try {
      const anchor = this.mindarSystem?.getAnchor(index);
      if (anchor && anchor.position) {
        return {
          x: anchor.position.x,
          y: anchor.position.y,
          z: anchor.position.z
        };
      }
    } catch (e) {
      console.warn(`Failed to get landmark ${index}:`, e);
    }
    return null;
  }

  /**
   * Measure face dimensions using current landmarks
   */
  measureFace(): FaceMeasurements | null {
    const now = Date.now();
    
    // Throttle measurements
    if (now - this.lastMeasurementTime < this.measurementInterval) {
      return null;
    }

    try {
      // Get key landmarks
      const leftTemple = this.getLandmark(234);
      const rightTemple = this.getLandmark(454);
      const noseBridge = this.getLandmark(168);
      const forehead = this.getLandmark(10);
      const chin = this.getLandmark(152);
      const leftEyeOuter = this.getLandmark(33);
      const rightEyeOuter = this.getLandmark(263);
      const leftEyeInner = this.getLandmark(130);
      const rightEyeInner = this.getLandmark(359);

      // Check if we have enough landmarks
      const hasRequiredLandmarks = leftTemple && rightTemple && noseBridge;
      if (!hasRequiredLandmarks) {
        return null;
      }

      // Calculate measurements
      const faceWidth = this.calculateDistance(leftTemple!, rightTemple!);
      const eyeDistance = leftEyeOuter && rightEyeOuter 
        ? this.calculateDistance(leftEyeOuter, rightEyeOuter)
        : faceWidth * 0.6; // Estimate if not available
      
      const noseWidth = leftEyeInner && rightEyeInner
        ? this.calculateDistance(leftEyeInner, rightEyeInner)
        : faceWidth * 0.2; // Estimate if not available

      const faceHeight = forehead && chin
        ? this.calculateDistance(forehead, chin)
        : faceWidth * 1.3; // Estimate if not available

      // Calculate confidence based on landmark availability
      const availableLandmarks = [
        leftTemple, rightTemple, noseBridge, forehead, chin,
        leftEyeOuter, rightEyeOuter, leftEyeInner, rightEyeInner
      ].filter(l => l !== null).length;
      
      const confidence = availableLandmarks / 9;

      const measurement: FaceMeasurements = {
        faceWidth,
        eyeDistance,
        noseWidth,
        faceHeight,
        confidence,
        timestamp: now
      };

      // Store measurement
      this.measurements.push(measurement);
      
      // Keep only last 10 measurements
      if (this.measurements.length > 10) {
        this.measurements.shift();
      }

      this.lastMeasurementTime = now;

      console.log('📊 Face measured:', {
        width: faceWidth.toFixed(3),
        eyeDist: eyeDistance.toFixed(3),
        confidence: (confidence * 100).toFixed(0) + '%'
      });

      return measurement;
    } catch (error) {
      console.error('❌ Face measurement error:', error);
      return null;
    }
  }

  /**
   * Get average measurements from recent samples (for stability)
   */
  getAverageMeasurements(): FaceMeasurements | null {
    if (this.measurements.length === 0) {
      return null;
    }

    const count = this.measurements.length;
    const sum = this.measurements.reduce((acc, m) => ({
      faceWidth: acc.faceWidth + m.faceWidth,
      eyeDistance: acc.eyeDistance + m.eyeDistance,
      noseWidth: acc.noseWidth + m.noseWidth,
      faceHeight: acc.faceHeight + m.faceHeight,
      confidence: acc.confidence + m.confidence,
      timestamp: m.timestamp
    }), {
      faceWidth: 0,
      eyeDistance: 0,
      noseWidth: 0,
      faceHeight: 0,
      confidence: 0,
      timestamp: Date.now()
    });

    return {
      faceWidth: sum.faceWidth / count,
      eyeDistance: sum.eyeDistance / count,
      noseWidth: sum.noseWidth / count,
      faceHeight: sum.faceHeight / count,
      confidence: sum.confidence / count,
      timestamp: sum.timestamp
    };
  }

  /**
   * Get the most recent measurement
   */
  getLatestMeasurement(): FaceMeasurements | null {
    return this.measurements.length > 0 
      ? this.measurements[this.measurements.length - 1] 
      : null;
  }

  /**
   * Clear all stored measurements
   */
  clearMeasurements() {
    this.measurements = [];
    console.log('🗑️ Measurements cleared');
  }
}
