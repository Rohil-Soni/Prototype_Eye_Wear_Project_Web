/**
 * GlassesFitter.ts
 * 
 * Three.js integration for loading and scaling glasses models.
 * Handles mesh loading, part discovery, and safe scaling from centroids.
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three-stdlib'
import type {
  ScaleFactors,
  GlassesPartNames,
  FaceMeasurements,
  ModelDimensions,
} from './GlassesScaleFactors'
import { computeScaleFactors } from './computeScaleFactors'

export class GlassesFitter {
  private scene: THREE.Group
  private parts: Map<string, THREE.Object3D> = new Map()

  constructor(scene: THREE.Group) {
    this.scene = scene
    // Index all named objects for fast lookup
    this.indexParts()
  }

  /**
   * Load a GLTF/GLB file and wrap it in a GlassesFitter
   */
  static async fromURL(url: string): Promise<GlassesFitter> {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync(url)
    return new GlassesFitter(gltf.scene)
  }

  /**
   * Recursively index all named objects in the scene
   */
  private indexParts(): void {
    this.parts.clear()
    this.scene.traverse((obj) => {
      if (obj.name && obj.name.length > 0) {
        this.parts.set(obj.name, obj)
      }
    })
  }

  /**
   * Apply pre-computed scale factors to named mesh parts
   */
  applyScaleFactors(
    factors: ScaleFactors,
    names: GlassesPartNames = {},
  ): void {
    const {
      frame = 'Frame',
      bridge = 'Bridge',
      templeLeft = 'Temple_L',
      templeRight = 'Temple_R',
      nosePadLeft = 'NosePad_L',
      nosePadRight = 'NosePad_R',
    } = names

    // Apply frame (main scaling driver)
    this.scalePart(frame, factors.frame)

    // Scale bridge independently
    this.scalePart(bridge, factors.bridge)

    // Scale both temple arms with same factors
    this.scalePart(templeLeft, factors.temple)
    this.scalePart(templeRight, factors.temple)

    // Scale nose pads
    this.scalePart(nosePadLeft, factors.nosePad)
    this.scalePart(nosePadRight, factors.nosePad)
  }

  /**
   * Fit glasses to face in one call: compute factors then apply them
   */
  fitToFace(
    face: FaceMeasurements,
    model: ModelDimensions,
    names?: GlassesPartNames,
  ): ScaleFactors {
    const factors = computeScaleFactors(face, model)
    this.applyScaleFactors(factors, names)
    return factors
  }

  /**
   * Scale a part from its centroid, not world origin.
   * This prevents parts from drifting away when they're offset from origin.
   */
  private scalePart(
    name: string,
    scale: { x: number; y: number; z: number },
  ): void {
    const obj = this.parts.get(name)
    if (!obj) {
      console.warn(`[GlassesFitter] Part "${name}" not found in scene`)
      return
    }

    // Calculate the bounding box and centroid
    const box = new THREE.Box3().setFromObject(obj)
    const centroid = new THREE.Vector3()
    box.getCenter(centroid)

    // Move object so its centroid is at world origin
    obj.position.sub(centroid)

    // Apply the scale
    obj.scale.multiply(new THREE.Vector3(scale.x, scale.y, scale.z))

    // Move position back, scaled appropriately
    obj.position.add(centroid)
    obj.position.multiply(new THREE.Vector3(scale.x, scale.y, scale.z))
  }

  /**
   * Get the root scene group to add to your Three.js scene
   */
  getScene(): THREE.Group {
    return this.scene
  }

  /**
   * List all part names found in the loaded model
   * Useful for debugging; run this first to see what your GLB actually contains
   */
  listParts(): string[] {
    return Array.from(this.parts.keys()).sort()
  }

  /**
   * Check if a specific part exists in the model
   */
  hasPart(name: string): boolean {
    return this.parts.has(name)
  }

  /**
   * Get a specific part by name for direct manipulation
   */
  getPart(name: string): THREE.Object3D | undefined {
    return this.parts.get(name)
  }
}
