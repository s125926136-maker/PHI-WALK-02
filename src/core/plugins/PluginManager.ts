/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPlugin } from './IPlugin';
import { pluginRegistry } from './PluginRegistry';

export class PluginManager {
  private static instance: PluginManager | null = null;

  public static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Registers a new plugin with the system.
   */
  public register(plugin: IPlugin): void {
    pluginRegistry.register(plugin);
  }

  /**
   * Unregisters a plugin by its ID, running its dispose method.
   */
  public unregister(id: string): void {
    pluginRegistry.unregister(id);
  }

  /**
   * Enables a registered plugin.
   */
  public enable(id: string): void {
    pluginRegistry.enable(id);
  }

  /**
   * Disables a registered plugin.
   */
  public disable(id: string): void {
    pluginRegistry.disable(id);
  }

  /**
   * Retrieves all registered plugins.
   */
  public getPlugins(): IPlugin[] {
    return pluginRegistry.getPlugins();
  }

  /**
   * Checks if a specific plugin is enabled.
   */
  public isEnabled(id: string): boolean {
    return pluginRegistry.isEnabled(id);
  }

  /**
   * Utility to clear all plugins from the registry.
   */
  public clear(): void {
    pluginRegistry.clear();
  }
}

export const pluginManager = PluginManager.getInstance();
