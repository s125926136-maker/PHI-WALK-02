/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { EngineContext } from '../EngineContext';
import { IEngineServices } from '../EngineServices';

export interface PluginContext {
  /** The root EngineContext for full-access back-compatibility */
  engineContext: EngineContext;
  
  /** Direct access to engine services */
  services: IEngineServices;
  
  /** ThreeJS scene reference */
  scene: THREE.Scene;
  
  /** ThreeJS camera reference */
  camera: THREE.Camera;
  
  /** WebGLRenderer reference */
  renderer: THREE.WebGLRenderer;
  
  /** Shared spatial properties for player/avatar */
  player: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    eyeHeight: number;
    yaw: number;
  };
  
  /** World objects available for physics queries/raycasts */
  colliders: THREE.Object3D[];
  
  /** Settings/parameters of the application */
  settings: any;
  
  /** Analysis/simulation-specific settings */
  analysisSettings: any;
}
