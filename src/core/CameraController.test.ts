import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { CameraController } from './CameraController';
import { CharacterController } from './CharacterController';
import { CollisionSystem } from './CollisionSystem';

describe('CameraController Unit Tests', () => {
  let cameraController: CameraController;
  let characterController: CharacterController;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    cameraController = new CameraController('first-person');
    characterController = new CharacterController(new CollisionSystem());
    camera = new THREE.PerspectiveCamera(72, 1, 0.05, 1000);
  });

  it('should initialize with correct transition factor depending on view mode', () => {
    const fpsCam = new CameraController('first-person');
    expect(fpsCam.transitionFactor).toBe(0.0);

    const tpsCam = new CameraController('third-person');
    expect(tpsCam.transitionFactor).toBe(1.0);
  });

  it('should adjust zoom within correct bounds [1.5, 8.0]', () => {
    expect(cameraController.zoomTarget).toBe(3.0);

    // Zoom in
    cameraController.adjustZoom(-1.0);
    expect(cameraController.zoomTarget).toBe(2.0);

    // Zoom out extreme
    cameraController.adjustZoom(10.0);
    expect(cameraController.zoomTarget).toBe(8.0);

    // Zoom in extreme
    cameraController.adjustZoom(-20.0);
    expect(cameraController.zoomTarget).toBe(1.5);
  });

  it('should calculate camera positions and follow player', () => {
    const playerPos = new THREE.Vector3(10, 5, -10);
    const eyeHeight = 1.65;
    const yaw = 0; // facing Z-
    const pitch = 0;

    cameraController.update(
      0.1,
      camera,
      playerPos,
      eyeHeight,
      yaw,
      pitch,
      false, // isMovingHorizontal
      false, // isArchitect
      1.0,   // speedScale
      'standing',
      'first-person',
      [], // collidableMeshes
      characterController
    );

    // In first person, camera position should be exactly headPos:
    // headPos = playerPos + (0, eyeHeight, 0)
    expect(camera.position.x).toBeCloseTo(10, 4);
    expect(camera.position.y).toBeCloseTo(6.65, 4);
    expect(camera.position.z).toBeCloseTo(-10, 4);
  });

  it('should interpolate view transition factor towards 1.0 when switching to third-person', () => {
    expect(cameraController.transitionFactor).toBe(0.0);

    // Update with dt=0.05. transitionSpeed is 4.0, so factor should increase by 4.0 * 0.05 = 0.2
    const playerPos = new THREE.Vector3(0, 0, 0);
    cameraController.update(
      0.05,
      camera,
      playerPos,
      1.65,
      0,
      0,
      false,
      false,
      1.0,
      'standing',
      'third-person',
      [],
      characterController
    );

    expect(cameraController.transitionFactor).toBeCloseTo(0.2, 4);
  });
});
