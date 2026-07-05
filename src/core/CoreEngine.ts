/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlayerSettings } from '../types';
import { IModule, ModuleContext, ModuleUpdatePolicy } from './ModuleInterface';
import { eventBus } from './EventSystem';
import { engineServices } from './EngineServices';

/**
 * Core Engine orchestrates the lifecycle and update loop of all sub-modules.
 */
export class CoreEngine {
  private modules: Map<string, IModule> = new Map();
  private sortedModules: IModule[] = [];
  private accumulatedTimes: Map<string, number> = new Map();
  private context: ModuleContext | null = null;
  private isInitialized = false;

  /**
   * Rebuilds the sorted list of modules based on their priority.
   * Lower priority numbers are executed first (e.g. Physics = 10, Player = 20, HUD = 100).
   */
  private rebuildSortedModules(): void {
    this.sortedModules = Array.from(this.modules.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Sets or updates the active rendering context.
   */
  public setContext(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    settings: PlayerSettings
  ): void {
    if (this.context) {
      this.context.scene = scene;
      this.context.camera = camera;
      this.context.renderer = renderer;
      this.context.settings = settings;
    } else {
      this.context = {
        scene,
        camera,
        renderer,
        settings,
        eventBus,
        services: engineServices,
      };
    }
  }

  /**
   * Registers a new module. If the engine is already initialized,
   * the module is immediately initialized.
   */
  public registerModule(module: IModule): void {
    if (this.modules.has(module.id)) {
      engineServices.logger.warn(`Module with ID "${module.id}" is already registered.`);
      return;
    }

    this.modules.set(module.id, module);
    this.rebuildSortedModules();
    this.accumulatedTimes.set(module.id, 0);

    if (this.isInitialized && this.context) {
      try {
        const initResult = module.initialize(this.context);
        if (initResult instanceof Promise) {
          initResult.catch((err) => {
            engineServices.logger.error(`Async initialization failed for module "${module.id}":`, err);
          });
        }
      } catch (err) {
        engineServices.logger.error(`Initialization failed for module "${module.id}":`, err);
      }
    }
  }

  /**
   * Unregisters a module and disposes of its resources.
   */
  public unregisterModule(id: string): void {
    const module = this.modules.get(id);
    if (module) {
      try {
        module.dispose();
      } catch (err) {
        engineServices.logger.error(`Disposal failed for module "${id}":`, err);
      }
      this.modules.delete(id);
      this.rebuildSortedModules();
      this.accumulatedTimes.delete(id);
    }
  }

  /**
   * Initializes all registered modules.
   */
  public async initializeAll(): Promise<void> {
    if (!this.context) {
      throw new Error('CoreEngine context must be set prior to initializing modules.');
    }

    // Sort to guarantee initialization order matches execution priority
    this.rebuildSortedModules();

    for (const module of this.sortedModules) {
      try {
        await module.initialize(this.context);
      } catch (err) {
        engineServices.logger.error(`Initialization failed for module "${module.id}":`, err);
      }
    }

    this.isInitialized = true;
  }

  /**
   * Updates all registered modules on every frame tick according to priority and policy.
   * @param deltaTime The time elapsed since the last frame in seconds.
   */
  public update(deltaTime: number): void {
    if (!this.isInitialized || !this.context) return;

    for (const module of this.sortedModules) {
      try {
        switch (module.updatePolicy) {
          case ModuleUpdatePolicy.Always:
            module.update(deltaTime, this.context);
            break;

          case ModuleUpdatePolicy.FixedInterval: {
            const interval = module.updateInterval || 0.1; // Default to 100ms
            let acc = (this.accumulatedTimes.get(module.id) || 0) + deltaTime;
            if (acc >= interval) {
              module.update(acc, this.context);
              acc = acc % interval; // Retain remaining fractional time
            }
            this.accumulatedTimes.set(module.id, acc);
            break;
          }

          case ModuleUpdatePolicy.EventDriven:
          case ModuleUpdatePolicy.Manual:
            // EventDriven and Manual modules are skipped in the main frame tick loop
            break;
        }
      } catch (err) {
        engineServices.logger.error(`Error during update tick for module "${module.id}":`, err);
      }
    }
  }

  /**
   * Manually triggers an update for a specific module, bypassing its schedule policy.
   */
  public triggerModuleUpdate(id: string, deltaTime: number): void {
    const module = this.modules.get(id);
    if (module && this.context) {
      try {
        module.update(deltaTime, this.context);
      } catch (err) {
        engineServices.logger.error(`Error during explicit update for module "${id}":`, err);
      }
    }
  }

  /**
   * Disseminates updated player settings or preferences across all modules.
   * @param settings The updated PlayerSettings.
   */
  public updateSettings(settings: PlayerSettings): void {
    if (!this.context) return;
    this.context.settings = settings;

    for (const module of this.sortedModules) {
      if (module.onSettingsChanged) {
        try {
          module.onSettingsChanged(settings);
        } catch (err) {
          engineServices.logger.error(`Error updating settings for module "${module.id}":`, err);
        }
      }
    }
  }

  /**
   * Disposes of all registered modules and clears the engine context.
   */
  public disposeAll(): void {
    for (const module of this.sortedModules) {
      try {
        module.dispose();
      } catch (err) {
        engineServices.logger.error(`Disposal failed for module "${module.id}":`, err);
      }
    }
    this.modules.clear();
    this.sortedModules = [];
    this.accumulatedTimes.clear();
    this.isInitialized = false;
    this.context = null;
  }

  /**
   * Retrieves a registered module by its ID.
   */
  public getModule<T extends IModule>(id: string): T | undefined {
    return this.modules.get(id) as T | undefined;
  }
}

/** Global instance of the Core Engine */
export const coreEngine = new CoreEngine();
