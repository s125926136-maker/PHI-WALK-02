import { CharacterController } from '../CharacterController';
import { CameraController } from '../CameraController';
import { CollisionSystem } from '../CollisionSystem';
import { InputManager } from '../InputManager';
import { ThreeSceneManager } from '../ThreeSceneManager';
import { SimulationLoop } from '../SimulationLoop';

export interface IEngine {
  characterController: CharacterController;
  cameraController: CameraController;
  collisionSystem: CollisionSystem;
  inputManager: InputManager;
  threeSceneManager: ThreeSceneManager;
  simulationLoop: SimulationLoop;
}
