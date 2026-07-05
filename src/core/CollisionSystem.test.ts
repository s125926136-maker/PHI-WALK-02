import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CollisionSystem } from './CollisionSystem';
import { CharacterController } from './CharacterController';

describe('CollisionSystem Unit Tests', () => {
  let collisionSystem: CollisionSystem;
  let characterController: CharacterController;

  beforeEach(() => {
    collisionSystem = new CollisionSystem();
    characterController = new CharacterController(collisionSystem);
  });

  it('should not throw if there are no collidable meshes', () => {
    expect(() => {
      collisionSystem.resolve(characterController, 0, 0.6, []);
    }).not.toThrow();
  });

  it('should push player away from walls when they collide with one', () => {
    // Set position to (0, 0, 0)
    characterController.setPosition(0, 0, 0);

    // Create a thin wall mesh that is 0.25 units away in front of the player (facing Z+ direction)
    const boxGeometry = new THREE.BoxGeometry(10, 2, 0.1);
    const boxMaterial = new THREE.MeshBasicMaterial();
    const wallMesh = new THREE.Mesh(boxGeometry, boxMaterial);
    
    // Position wall at (0, 0.8, 0.25)
    // The player waist height is playerPos.y + 0.8 = 0.8.
    // The ray starts at (0, 0.8, 0) and points in cameraYaw direction.
    // Let's set yaw to 0, which corresponds to dirVec = (sin(0), 0, cos(0)) = (0, 0, 1).
    // The ray origin is (0, 0.8, 0) and direction is (0, 0, 1).
    // The near face of the wall is at 0.25 - 0.05 = 0.20, so the hit distance is 0.20.
    wallMesh.position.set(0, 0.8, 0.25);
    wallMesh.updateMatrixWorld();

    const bodyWidth = 0.6;
    collisionSystem.resolve(characterController, 0, bodyWidth, [wallMesh]);

    // Player position should be pushed backward along (0, 0, 1) direction
    // bodyWidth = 0.6 => cylinderRadius = 0.3. wallPushOffset = 0.05. Total required dist = 0.35.
    // Actual distance is 0.20. Overlap = 0.35 - 0.20 = 0.15.
    // So player should be pushed by (0, 0, -0.15).
    expect(characterController.position.z).toBeCloseTo(-0.15, 4);
  });
});
