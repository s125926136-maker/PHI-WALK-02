import * as THREE from 'three';
import { CharacterController } from './CharacterController';

export class CameraController {
  private _zoomTarget: number = 3.0;
  private _zoomCurrent: number = 3.0;
  private _transitionFactor: number = 0.0;
  private _bobTimer: number = 0;

  // Temp variables to avoid garbage collection overhead
  private _tempV1 = new THREE.Vector3();
  private _tempV2 = new THREE.Vector3();
  private _tempV3 = new THREE.Vector3();
  private _tempEuler = new THREE.Euler();
  private _cameraRay = new THREE.Raycaster();

  constructor(initialViewMode: 'first-person' | 'third-person' = 'first-person') {
    this._transitionFactor = initialViewMode === 'first-person' ? 0.0 : 1.0;
  }

  public get zoomTarget(): number {
    return this._zoomTarget;
  }

  public get zoomCurrent(): number {
    return this._zoomCurrent;
  }

  public get transitionFactor(): number {
    return this._transitionFactor;
  }

  public adjustZoom(delta: number): void {
    this._zoomTarget = Math.max(1.5, Math.min(8.0, this._zoomTarget + delta));
  }

  public update(
    dt: number,
    camera: THREE.PerspectiveCamera,
    playerPos: THREE.Vector3,
    currentEyeHeight: number,
    cameraYaw: number,
    cameraPitch: number,
    isMovingHorizontal: boolean,
    isArchitect: boolean,
    speedScale: number,
    posture: string,
    viewMode: 'first-person' | 'third-person',
    collidableMeshes: THREE.Object3D[],
    characterController: CharacterController
  ): void {
    // 1. First-person head bobbing calculation
    let bobY = 0;
    let bobX = 0;
    
    if (isMovingHorizontal && viewMode === 'first-person') {
      const bobSpeed = posture === 'crouching' ? 4 : 8;
      this._bobTimer += dt * bobSpeed;
      const bobMultiplier = isArchitect ? 0.6 : 1.0; // 40% softer head bob for smooth architectural walk
      bobY = Math.sin(this._bobTimer) * 0.016 * speedScale * bobMultiplier;
      bobX = Math.cos(this._bobTimer) * 0.008 * speedScale * bobMultiplier;
    }

    // Set head position
    const headPos = this._tempV1.set(
      playerPos.x + bobX,
      playerPos.y + currentEyeHeight + bobY,
      playerPos.z
    );

    // 2. View Mode Transition Factor Lerping
    const targetFactor = viewMode === 'first-person' ? 0.0 : 1.0;
    const transitionSpeed = 4.0; // 0.25s duration
    if (this._transitionFactor !== targetFactor) {
      if (this._transitionFactor < targetFactor) {
        this._transitionFactor = Math.min(targetFactor, this._transitionFactor + transitionSpeed * dt);
      } else {
        this._transitionFactor = Math.max(targetFactor, this._transitionFactor - transitionSpeed * dt);
      }
    }

    // 3. Camera Pitch Clamp
    // If we are more than halfway to third-person, apply tighter vertical pitch limit for stable orbit observation
    if (this._transitionFactor > 0.5) {
      characterController.clampPitch(-0.25, 0.55);
    }

    // 4. Camera Rotation (Setup orientation via Pitch/Yaw)
    const euler = this._tempEuler.set(cameraPitch, cameraYaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // 5. Follow Camera Parameter updates (Orbital Zoom)
    this._zoomCurrent += (this._zoomTarget - this._zoomCurrent) * 0.12;
    const followDist = this._zoomCurrent;
    const forwardDir = this._tempV2.set(0, 0, -1).applyEuler(euler);
    const anchorPos = this._tempV3.set(
      playerPos.x,
      playerPos.y + currentEyeHeight * 0.95,
      playerPos.z
    );

    // Compute ideal third-person camera position
    let targetCamPos = anchorPos.clone().sub(forwardDir.clone().multiplyScalar(followDist));

    // Avoid camera going below ground
    const minCamHeight = playerPos.y + 0.3;
    if (targetCamPos.y < minCamHeight) {
      targetCamPos.y = minCamHeight;
    }

    // 6. Camera Collision detection
    if (collidableMeshes.length > 0) {
      const rayDirection = new THREE.Vector3().subVectors(targetCamPos, anchorPos);
      const rayLength = rayDirection.length();
      if (rayLength > 0.01) {
        rayDirection.normalize();
        this._cameraRay.set(anchorPos, rayDirection);
        const cameraHits = this._cameraRay.intersectObjects(collidableMeshes);
        if (cameraHits.length > 0) {
          const closestHit = cameraHits[0];
          const safeDist = Math.max(0.1, closestHit.distance - 0.15);
          targetCamPos.copy(anchorPos).add(rayDirection.clone().multiplyScalar(safeDist));
        }
      }
    }

    // 7. Blend positions: lerp between Head Position (1st person) and Target Cam Position (3rd person)
    const interpolatedCamPos = new THREE.Vector3().lerpVectors(headPos, targetCamPos, this._transitionFactor);
    camera.position.copy(interpolatedCamPos);
  }
}
