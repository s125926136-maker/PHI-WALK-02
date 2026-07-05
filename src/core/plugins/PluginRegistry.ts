/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPlugin } from './IPlugin';
import { PluginContext } from './PluginContext';

export class PluginRegistry {
  private static instance: PluginRegistry | null = null;
  private plugins: Map<string, IPlugin> = new Map();
  private enabledStates: Map<string, boolean> = new Map();
  private sortedPlugins: IPlugin[] = [];

  public static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }

  /**
   * Registers a plugin.
   */
  public register(plugin: IPlugin): void {
    this.plugins.set(plugin.id, plugin);
    // By default, a newly registered plugin is enabled.
    if (!this.enabledStates.has(plugin.id)) {
      this.enabledStates.set(plugin.id, true);
    }
    this.rebuildSortedPlugins();
  }

  /**
   * Unregisters a plugin and disposes of it.
   */
  public unregister(id: string): void {
    const plugin = this.plugins.get(id);
    if (plugin) {
      try {
        plugin.dispose();
      } catch (err) {
        console.error(`Error disposing plugin "${id}" during unregistration:`, err);
      }
      this.plugins.delete(id);
      this.enabledStates.delete(id);
      this.rebuildSortedPlugins();
    }
  }

  /**
   * Enables a registered plugin.
   */
  public enable(id: string): void {
    if (this.plugins.has(id)) {
      this.enabledStates.set(id, true);
      this.rebuildSortedPlugins();
    }
  }

  /**
   * Disables a registered plugin.
   */
  public disable(id: string): void {
    if (this.plugins.has(id)) {
      this.enabledStates.set(id, false);
      this.rebuildSortedPlugins();
    }
  }

  /**
   * Gets all registered plugins.
   */
  public getPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets the active, enabled plugins in deterministic execution order.
   * Priority (ascending), then alphabetically by id as a tie-breaker.
   */
  public getEnabledPlugins(): IPlugin[] {
    return this.sortedPlugins;
  }

  /**
   * Check if a plugin is currently enabled.
   */
  public isEnabled(id: string): boolean {
    return !!this.enabledStates.get(id);
  }

  /**
   * Clears the registry.
   */
  public clear(): void {
    for (const plugin of this.plugins.values()) {
      try {
        plugin.dispose();
      } catch (err) {
        // Suppress errors during clear
      }
    }
    this.plugins.clear();
    this.enabledStates.clear();
    this.sortedPlugins = [];
  }

  private rebuildSortedPlugins(): void {
    const enabledPlugins = Array.from(this.plugins.values()).filter(p => this.enabledStates.get(p.id) === true);
    
    this.sortedPlugins = enabledPlugins.sort((a, b) => {
      const priorityA = a.priority ?? 100;
      const priorityB = b.priority ?? 100;
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // Deterministic fallback/tie-breaker using alphabetical ID sorting
      return a.id.localeCompare(b.id);
    });
  }
}

export const pluginRegistry = PluginRegistry.getInstance();
