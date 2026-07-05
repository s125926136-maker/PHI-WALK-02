import * as THREE from 'three';
import { ICharacterController } from './interfaces/ICharacterController';
import { ICollisionSystem } from './interfaces/ICollisionSystem';

export class CollisionSystem implements ICollisionSystem {
  private _wallRay = new THREE.Raycaster();
  private _tempV1 = new THREE.Vector3();
  private _tempV2 = new THREE.Vector3();
  private _tempV3 = new THREE.Vector3();

  /**
   * Resolves wall collisions, pushing the player back if they intersect a collidable mesh,
   * and adjusting their velocity so they don't walk through walls.
   * 
   * @param characterController The controller representing the character
   * @param cameraYaw The current look yaw of the character (or camera)
   * @param bodyWidth The physical width of the character
   * @param collidableMeshes List of THREE.Mesh / THREE.Object3D objects to check against
   */
  public resolve(
    characterController: ICharacterController,
    cameraYaw: number,
    bodyWidth: number,
    collidableMeshes: THREE.Object3D[]
  ): void {
    if (collidableMeshes.length === 0) return;

    const playerPos = characterController.position;
    const waistY = playerPos.y + 0.8;
    const directionsCount = 8;
    const cylinderRadius = bodyWidth / 2;
    const wallPushOffset = 0.05;

    for (let i = 0; i < directionsCount; i++) {
      const angle = (i / directionsCount) * Math.PI * 2 + cameraYaw;
      const dirVec = this._tempV1.set(Math.sin(angle), 0, Math.cos(angle));
      
      const rayOrigin = this._tempV2.set(playerPos.x, waistY, playerPos.z);
      this._wallRay.set(rayOrigin, dirVec);

      const hits = this._wallRay.intersectObjects(collidableMeshes);
      if (hits.length > 0) {
        const hit = hits[0];
        const dist = hit.distance;

        // Push player back from wall along hit normal if colliding
        if (dist < cylinderRadius + wallPushOffset) {
          const overlap = (cylinderRadius + wallPushOffset) - dist;
          const push = this._tempV3.copy(dirVec).multiplyScalar(-overlap);
          characterController.translate(push);

          // Cancel velocity in the direction of collision (delegated to CharacterController)
          characterController.cancelVelocityAlongNormal(dirVec);
        }
      }
    }
  }
}
