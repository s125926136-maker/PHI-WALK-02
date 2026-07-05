/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IModule } from './IModule';
import { EngineContext } from './EngineContext';
import { engineServices } from './EngineServices';

export class ModuleRegistry {
  private modules: Map<string, IModule> = new Map();
  private sortedModules: IModule[] = [];

  /**
   * Registers a new module.
   * Prevents duplicate registration.
   */
  public register(module: IModule): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Module with name "${module.name}" is already registered.`);
    }
    this.modules.set(module.name, module);
    this.sortModules();
  }

  /**
   * Unregisters a module by name.
   */
  public unregister(name: string): void {
    if (this.modules.has(name)) {
      const module = this.modules.get(name);
      if (module && typeof module.dispose === 'function') {
        try {
          module.dispose();
        } catch (e) {
          engineServices.logger.error(`Error disposing module "${name}":`, e);
        }
      }
      this.modules.delete(name);
      this.sortModules();
    }
  }

  /**
   * Clears all registered modules (equivalent to disposeAll).
   */
  public clear(): void {
    this.disposeAll();
  }

  /**
   * Disposes of all registered modules and clears the registry.
   */
  public disposeAll(): void {
    for (const module of this.modules.values()) {
      if (typeof module.dispose === 'function') {
        try {
          module.dispose();
        } catch (e) {
          engineServices.logger.error(`Error disposing module "${module.name}":`, e);
        }
      }
    }
    this.modules.clear();
    this.sortedModules = [];
  }

  /**
   * Initializes all registered modules.
   */
  public async initializeAll(context: EngineContext): Promise<void> {
    this.sortModules();
    for (const module of this.sortedModules) {
      if (typeof module.initialize === 'function') {
        try {
          await module.initialize(context);
        } catch (e) {
          engineServices.logger.error(`Error initializing module "${module.name}":`, e);
        }
      }
    }
  }

  /**
   * Retrieves a specific module by name.
   */
  public getModule<T extends IModule>(name: string): T | undefined {
    return this.modules.get(name) as T;
  }

  /**
   * Returns a read-only ordered list of modules.
   * Ordering is deterministic and stable, sorted by priority ascending.
   */
  public getModules(): readonly IModule[] {
    return this.sortedModules;
  }

  /**
   * Sorts the registered modules to maintain deterministic stable execution order.
   */
  public sortModules(): void {
    // Array.sort is stable in ES2019+
    // Sorting by priority ascending (lower values execute first).
    this.sortedModules = Array.from(this.modules.values()).sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Stable ordering based on name key comparison if priority is equal
      return a.name.localeCompare(b.name);
    });
  }
}

export const moduleRegistry = new ModuleRegistry();
