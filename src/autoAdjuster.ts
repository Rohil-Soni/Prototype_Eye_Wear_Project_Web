// src/autoAdjuster.ts - Automatic glasses size adjustment based on face measurements

import type { FaceMeasurements } from './faceMeasurement.ts';
import { FaceMeasurementSystem } from './faceMeasurement.ts';

export interface AdjustmentSettings {
  scale: number;
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
}

export class AutoAdjuster {
  private measurementSystem: FaceMeasurementSystem;
  private baseScale: number = 1.0;
  private isAutoAdjustEnabled: boolean = false;
  private adjustmentCallback?: (settings: AdjustmentSettings) => void;
  private updateInterval: number = 2000; // Update every 2 seconds
  private intervalId?: number;
  private adjustScaleAutomatically: boolean = false; // Control whether scale is auto-adjusted
  private lockedScale: number | null = null;

  // Reference measurements (average adult face)
  private readonly REFERENCE_FACE_WIDTH = 0.14; // ~14cm in MindAR units
  private readonly REFERENCE_EYE_DISTANCE = 0.063; // ~6.3cm
  
  constructor(measurementSystem: FaceMeasurementSystem) {
    this.measurementSystem = measurementSystem;
    console.log('🤖 Auto Adjuster initialized');
  }

  /**
   * Connect to measurement system for real-time updates
   * This enables automatic adjustments whenever measurements change
   */
  connectToMeasurementSystem() {
    this.measurementSystem.onMeasurementUpdate(() => {
      // When new measurements arrive and auto-adjust is enabled,
      // trigger an immediate adjustment update
      if (this.isAutoAdjustEnabled) {
        this.updateAdjustments();
      }
    });
    console.log('🔗 AutoAdjuster connected to measurement system');
  }
  
  /**
   * Enable automatic adjustment
   */
  enable(callback: (settings: AdjustmentSettings) => void) {
    this.isAutoAdjustEnabled = true;
    this.adjustmentCallback = callback;
    
    // Connect to measurement system for real-time updates
    this.connectToMeasurementSystem();
    
    // Also keep periodic updates as fallback (every 2 seconds)
    this.intervalId = window.setInterval(() => {
      this.updateAdjustments();
    }, this.updateInterval);

    console.log('✅ Auto-adjustment enabled');
  }

  /**
   * Disable automatic adjustment
   */
  disable() {
    this.isAutoAdjustEnabled = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('⏸️ Auto-adjustment disabled');
  }

  /**
   * Calculate optimal glasses scale based on face measurements
   */
  private calculateScale(measurements: FaceMeasurements): number {
    // Only calculate scale if auto-scale is enabled
    if (!this.adjustScaleAutomatically) {
      return this.baseScale; // Return base scale without adjustment
    }

    if (this.lockedScale !== null) {
      return this.lockedScale;
    }
    
    // Calculate scale based on face width (primary factor)
    const widthRatio = measurements.faceWidth / this.REFERENCE_FACE_WIDTH;
    
    // Calculate scale based on eye distance (secondary factor)
    const eyeRatio = measurements.eyeDistance / this.REFERENCE_EYE_DISTANCE;
    
    // Weighted average (70% face width, 30% eye distance)
    const scale = (widthRatio * 0.7 + eyeRatio * 0.3) * this.baseScale;
    
    // Clamp scale to reasonable range
    const locked = Math.max(0.5, Math.min(3.0, scale));
    this.lockedScale = locked;
    return locked;
  }

  /**
   * Calculate position adjustments based on face proportions
   */
  private calculatePositionAdjustments(measurements: FaceMeasurements): {
    posX: number;
    posY: number;
    posZ: number;
  } {
    return {
      posX: 0,
      posY: 0,
      posZ: 0,
    };
  }

  /**
   * Update adjustments based on current face measurements
   */
  private updateAdjustments() {
    if (!this.isAutoAdjustEnabled || !this.adjustmentCallback) {
      return;
    }

    // Prefer latest for responsiveness; fall back to average for startup stability.
    const measurements = this.measurementSystem.getLatestMeasurement() || this.measurementSystem.getAverageMeasurements();
    
    if (!measurements) {
      console.log('⏳ Waiting for face measurements...');
      return;
    }

    // Check confidence level
    if (measurements.confidence < 0.5) {
      console.log('⚠️ Low confidence in measurements, skipping adjustment');
      return;
    }

    // Calculate adjustments
    const scale = this.calculateScale(measurements);
    const position = this.calculatePositionAdjustments(measurements);

    const settings: AdjustmentSettings = {
      scale,
      ...position,
      rotX: 0,
      rotY: 0,
      rotZ: 0
    };

    console.log('🎯 Auto-adjustment applied:', {
      scale: scale.toFixed(2),
      faceWidth: measurements.faceWidth.toFixed(3),
      eyeDistance: measurements.eyeDistance.toFixed(3),
      confidence: (measurements.confidence * 100).toFixed(0) + '%'
    });

    // Apply adjustments via callback
    this.adjustmentCallback(settings);
  }

  /**
   * Manually trigger adjustment update
   */
  forceUpdate() {
    this.updateAdjustments();
  }

  /**
   * Set base scale for adjustments
   */
  setBaseScale(scale: number) {
    this.baseScale = scale;
    this.lockedScale = null;
    console.log('📐 Base scale set to:', scale);
  }

  /**
   * Clear the locked auto-scale so a new stable fit can be captured.
   */
  resetScaleLock() {
    this.lockedScale = null;
    console.log('🔄 Auto-scale lock cleared');
  }

  /**
   * Set whether scale should be automatically adjusted
   * @param enabled - If true, scale will be calculated based on face measurements
   *                  If false, only position will be adjusted (default: false)
   */
  setAutoScaleEnabled(enabled: boolean) {
    this.adjustScaleAutomatically = enabled;
    console.log(this.adjustScaleAutomatically ? '🎯 Auto-scale enabled' : '🔒 Auto-scale disabled (position only)');
  }

  /**
   * Get whether auto-scale is currently enabled
   */
  isAutoScaleEnabled(): boolean {
    return this.adjustScaleAutomatically;
  }

  /**
   * Get current auto-adjust status
   */
  isEnabled(): boolean {
    return this.isAutoAdjustEnabled;
  }

  /**
   * Get the currently locked scale, if any.
   */
  getLockedScale(): number | null {
    return this.lockedScale;
  }

  /**
   * Get recommended settings based on current measurements
   */
  getRecommendedSettings(): AdjustmentSettings | null {
    const measurements = this.measurementSystem.getAverageMeasurements();
    
    if (!measurements || measurements.confidence < 0.5) {
      return null;
    }

    const scale = this.calculateScale(measurements);
    const position = this.calculatePositionAdjustments(measurements);

    return {
      scale,
      ...position,
      rotX: 0,
      rotY: 0,
      rotZ: 0
    };
  }
}
