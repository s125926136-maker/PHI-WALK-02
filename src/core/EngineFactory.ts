/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CollisionSystem } from './CollisionSystem';
import { CharacterController } from './CharacterController';
import { CameraController } from './CameraController';
import { InputManager } from './InputManager';
import { ThreeSceneManager } from './ThreeSceneManager';
import { SimulationLoop } from './SimulationLoop';
import { IEngine } from './interfaces/IEngine';
import { pluginRegistry } from './plugins/PluginRegistry';
import { TelemetryPluginAdapter } from './plugins/TelemetryPluginAdapter';
import { AccessibilityPlugin } from './plugins/AccessibilityPlugin';

export class EngineFactory {
  static create(): IEngine {
    const collisionSystem = new CollisionSystem();
    const characterController = new CharacterController(collisionSystem);
    const cameraController = new CameraController();
    const inputManager = new InputManager();
    const threeSceneManager = new ThreeSceneManager();
    const simulationLoop = new SimulationLoop();

    // Register plugins globally in PluginRegistry
    pluginRegistry.register(new TelemetryPluginAdapter());
    pluginRegistry.register(new AccessibilityPlugin());

    return {
      characterController,
      cameraController,
      collisionSystem,
      inputManager,
      threeSceneManager,
      simulationLoop
    };
  }
}
