/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlayerSettings } from '../types';
import { eventBus } from './EventSystem';
import { IEngineServices } from './EngineServices';

/**
 * The standard execution and sharing context provided to all modules.
 * This encapsulates everything a sub-module needs to query, render, or manipulate.
 */
export interface ModuleContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  settings: PlayerSettings;
  eventBus: typeof eventBus;
  services: IEngineServices;
}

export enum ModuleUpdatePolicy {
  Always = 'Always',
  EventDriven = 'EventDriven',
  FixedInterval = 'FixedInterval',
  Manual = 'Manual',
}

/**
 * Standard module lifecycle interface.
 * All subsystem modules (HUD, Player, Solar, Physics, etc.) must implement this interface.
 */
export interface IModule {
  /** Unique identifier for the module */
  readonly id: string;

  /** Priority of execution (lower numbers execute first, e.g. Physics = 10, Player = 20, HUD = 100) */
  readonly priority: number;

  /** Update strategy defining when and how the module's update method is executed */
  readonly updatePolicy: ModuleUpdatePolicy;

  /** Update frequency interval in seconds. Only applicable when updatePolicy is FixedInterval */
  readonly updateInterval?: number;

  /**
   * Initializes the module.
   * Called once when the module is registered or when the core engine initializes.
   */
  initialize(context: ModuleContext): void | Promise<void>;

  /**
   * Update tick called once per frame (60 FPS loop).
   * @param deltaTime Elapsed time since the last frame in seconds.
   * @param context Current execution context.
   */
  update(deltaTime: number, context: ModuleContext): void;

  /**
   * Callback triggered whenever player settings or project preferences change.
   * @param settings The updated PlayerSettings object.
   */
  onSettingsChanged?(settings: PlayerSettings): void;

  /**
   * Cleans up all resources, meshes, listeners, and intervals created by this module.
   */
  dispose(): void;
}
