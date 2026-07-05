import * as THREE from 'three';
import { ICharacterController } from './ICharacterController';

export interface ICollisionSystem {
  resolve(
    characterController: ICharacterController,
    cameraYaw: number,
    bodyWidth: number,
    collidableMeshes: THREE.Object3D[]
  ): void;
}
