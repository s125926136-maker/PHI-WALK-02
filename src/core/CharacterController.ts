/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ICharacterController } from './interfaces/ICharacterController';
import { ICollisionSystem } from './interfaces/ICollisionSystem';
import { PerformanceProfiler } from './PerformanceProfiler';

/**
 * Interface representing the keyboard and action inputs for character movement.
 */
export interface CharacterInputState {
  forward: boolean;   // e.g., 'w' or 'ArrowUp'
  backward: boolean;  // e.g., 's' or 'ArrowDown'
  left: boolean;      // e.g., 'a' or 'ArrowLeft'
  right: boolean;     // e.g., 'd' or 'ArrowRight'
  jump: boolean;      // e.g., ' ' (Space)
  shift: boolean;     // Sprint modifier
}

/**
 * Interface representing the physical configuration and properties of the character.
 */
export interface CharacterPhysicsConfig {
  gravityEnabled: boolean;
  collisionEnabled: boolean;
  eyeHeight: number;
  bodyWidth: number;
  moveSpeed: number;
  jumpPower: number;
  posture: 'standing' | 'sitting' | 'crouching';
}

/**
 * CharacterController
 * Stub class representing the player character physical movement, collision response,
 * and gravity solver. Currently in Phase 1 (Stub Creation), behavior logic remains 
 * in SimulatorCanvas to avoid any breaking changes or functional regressions.
 */
export class CharacterController implements ICharacterController {
  // Core player transform properties
  private _position: THREE.Vector3 = new THREE.Vector3(0, 1.65, 0);
  private _velocity: THREE.Vector3 = new THREE.Vector3();
  private _collisionSystem: ICollisionSystem;

  constructor(collisionSystem: ICollisionSystem) {
    this._collisionSystem = collisionSystem;
  }
  
  // Custom camera orientation and dimensions state tracking
  private _cameraYaw: number = 0;
  private _cameraPitch: number = 0;
  private _avatarYaw: number = Math.PI; // default face Z-
  private _currentEyeHeight: number = 1.65;
  private _grounded: boolean = true;
  private _bobTimer: number = 0;
  private _activeRoom: string = '通用外部空間 (Exterior Area)';

  // Reusable objects to support Zero Allocation performance guidelines
  private _scratchWaistPos: THREE.Vector3 = new THREE.Vector3();
  private _scratchDownDir: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  private _downRay: THREE.Raycaster = new THREE.Raycaster();

  /**
   * Getter for active room name
   */
  public get activeRoom(): string {
    return this._activeRoom;
  }

  /**
   * Getter for the current player position.
   */
  public get position(): THREE.Vector3 {
    return this._position;
  }

  /**
   * Getter for the current player velocity.
   */
  public get velocity(): THREE.Vector3 {
    return this._velocity;
  }

  /**
   * Getter for Camera Orientation Yaw (in radians)
   */
  public get cameraYaw(): number {
    return this._cameraYaw;
  }

  /**
   * Getter for Camera Orientation Pitch (in radians)
   */
  public get cameraPitch(): number {
    return this._cameraPitch;
  }

  /**
   * Getter for Avatar Yaw (in radians)
   */
  public get avatarYaw(): number {
    return this._avatarYaw;
  }

  /**
   * Sets the Avatar Yaw (in radians)
   */
  public setAvatarYaw(val: number): void {
    this._avatarYaw = val;
  }

  /**
   * Getter for the current interpolated eye height.
   */
  public get currentEyeHeight(): number {
    return this._currentEyeHeight;
  }

  /**
   * Getter for whether character is grounded.
   */
  public get grounded(): boolean {
    return this._grounded;
  }

  /**
   * Sets the character position directly in 3D space.
   * @param x X coordinate or full Vector3
   * @param y Y coordinate (optional)
   * @param z Z coordinate (optional)
   */
  public setPosition(x: number | THREE.Vector3, y?: number, z?: number): void {
    if (x instanceof THREE.Vector3) {
      this._position.copy(x);
    } else if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
      this._position.set(x, y, z);
    }
  }

  /**
   * Translates the character's position by a Vector3 offset.
   */
  public translate(offset: THREE.Vector3): void {
    this._position.add(offset);
  }

  /**
   * Adds horizontal movement velocity components.
   */
  public addHorizontalMovement(vx: number, vz: number, dt: number): void {
    this._position.x += vx * dt;
    this._position.z += vz * dt;
  }

  /**
   * Resets the player's movement velocity vector back to zero.
   */
  public resetVelocity(): void {
    this._velocity.set(0, 0, 0);
  }

  /**
   * Applies friction/damping and active input acceleration to horizontal velocity components.
   */
  public applyFrictionAndAcceleration(moveVector: THREE.Vector3, finalSpeed: number, damping: number, dt: number): void {
    this._velocity.x -= this._velocity.x * damping * dt;
    this._velocity.z -= this._velocity.z * damping * dt;

    if (moveVector.lengthSq() > 0) {
      this._velocity.x += moveVector.x * finalSpeed * damping * dt;
      this._velocity.z += moveVector.z * finalSpeed * damping * dt;
    }
  }

  /**
   * Cancels player velocity components projected along a collision normal vector.
   */
  public cancelVelocityAlongNormal(normal: THREE.Vector3): void {
    const dot = this._velocity.dot(normal);
    if (dot > 0) {
      this._velocity.x -= normal.x * dot;
      this._velocity.z -= normal.z * dot;
    }
  }

  /**
   * Updates the interpolated eye height based on posture, base eye height, and delta time.
   */
  public updateEyeHeight(dt: number, posture: string, baseEyeHeight: number): void {
    let targetHeight = baseEyeHeight;
    if (posture === 'crouching') {
      targetHeight = baseEyeHeight * 0.72; // crouching lowers 28%
    } else if (posture === 'sitting') {
      targetHeight = baseEyeHeight * 0.55; // sitting lowers 45%
    }
    this._currentEyeHeight = THREE.MathUtils.lerp(this._currentEyeHeight, targetHeight, 10 * dt);
  }

  /**
   * Updates camera looking yaw and pitch based on raw mouse movement deltas.
   * @param deltaX Mouse movement on X axis (movementX)
   * @param deltaY Mouse movement on Y axis (movementY)
   * @param sensitivity Look speed multiplier
   */
  public handleLook(deltaX: number, deltaY: number, sensitivity: number = 0.0022): void {
    this._cameraYaw -= deltaX * sensitivity;
    this._cameraPitch -= deltaY * sensitivity;

    // Cap vertical pitch to avoid flipping over
    const limit = Math.PI / 2.05;
    this._cameraPitch = Math.max(-limit, Math.min(limit, this._cameraPitch));
  }

  /**
   * Sets the camera rotation angles directly.
   */
  public setCameraRotation(yaw: number, pitch: number): void {
    this._cameraYaw = yaw;
    this._cameraPitch = pitch;
  }

  /**
   * Clamps the camera pitch between minimum and maximum limits.
   */
  public clampPitch(min: number, max: number): void {
    this._cameraPitch = Math.max(min, Math.min(max, this._cameraPitch));
  }

  /**
   * Updates character physics, gravity, and wall collisions.
   * Currently implements gravity, jumping, and floor snap/downwards raycasting.
   * 
   * @param deltaTime Elapsed frame time in seconds
   * @param input State of user movement keys
   * @param config Physics characteristics and posture configurations
   * @param collidableMeshes Scene geometries to check for wall/floor collisions
   */
  public update(
    deltaTime: number,
    input: CharacterInputState,
    config: CharacterPhysicsConfig,
    collidableMeshes: THREE.Object3D[]
  ): void {
    // ----------------------------------------------------
    // JUMP LOGIC (Vertical Velocity Trigger)
    // ----------------------------------------------------
    // If gravity is enabled and player is grounded (velocity.y is 0), they can jump
    if (config.gravityEnabled && this._velocity.y === 0 && input.jump) {
      this._velocity.y = config.jumpPower;
    }

    // ----------------------------------------------------
    // GRAVITY & FLOOR COLLISION (Downwards Raycast)
    // ----------------------------------------------------
    // Re-use pre-allocated vectors to avoid memory allocation (Zero Allocation)
    this._scratchWaistPos.set(this._position.x, this._position.y + 0.8, this._position.z);
    this._downRay.set(this._scratchWaistPos, this._scratchDownDir);

    const downHits = this._downRay.intersectObjects(collidableMeshes);
    let floorHeight = 0;
    this._activeRoom = '通用外部空間 (Exterior Area)';

    // Filter only floor elements without closure/iterator allocations
    let floorHit: THREE.Intersection | null = null;
    for (let i = 0; i < downHits.length; i++) {
      if (downHits[i].object.userData.type === 'floor') {
        floorHit = downHits[i];
        break;
      }
    }

    if (floorHit) {
      floorHeight = floorHit.point.y;
      if (floorHit.object.userData.roomName) {
        this._activeRoom = floorHit.object.userData.roomName;
      }
    } else if (downHits.length > 0) {
      // Fallback to closest hit below waist
      const closestHit = downHits[0];
      floorHeight = closestHit.point.y;
      if (closestHit.object.userData.roomName) {
        this._activeRoom = closestHit.object.userData.roomName;
      }
    }

    // Apply vertical movement and floor mechanics via helper
    this._resolveGravityAndSnapping(deltaTime, config, floorHeight);

    // Apply horizontal velocity movement
    this.addHorizontalMovement(this._velocity.x, this._velocity.z, deltaTime);

    // Resolve wall collisions
    if (config.collisionEnabled) {
      PerformanceProfiler.begin('Collision');
      this._collisionSystem.resolve(this, this._cameraYaw, config.bodyWidth, collidableMeshes);
      PerformanceProfiler.end('Collision');
    }
  }

  /**
   * Dedicated helper to resolve gravity acceleration, floor snap, and grounded state.
   */
  private _resolveGravityAndSnapping(
    deltaTime: number,
    config: CharacterPhysicsConfig,
    floorHeight: number
  ): void {
    if (config.gravityEnabled) {
      // Gravity acceleration
      this._velocity.y -= 9.8 * deltaTime;
      this._position.y += this._velocity.y * deltaTime;

      // Snap to floor
      if (this._position.y <= floorHeight) {
        this._position.y = floorHeight;
        this._velocity.y = 0;
        this._grounded = true;
      } else {
        this._grounded = false;
      }
    } else {
      // Smooth snap to floor
      this._position.y = THREE.MathUtils.lerp(this._position.y, floorHeight, 15 * deltaTime);
      this._velocity.y = 0;
      this._grounded = true;
    }
  }
}
