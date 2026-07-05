import * as THREE from 'three';

export interface ICharacterController {
  position: THREE.Vector3;
  cameraYaw: number;
  translate(offset: THREE.Vector3): void;
  cancelVelocityAlongNormal(normal: THREE.Vector3): void;
}
