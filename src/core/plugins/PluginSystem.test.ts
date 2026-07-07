/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { PluginRegistry } from './PluginRegistry';
import { PluginManager } from './PluginManager';
import { IPlugin } from './IPlugin';
import { PluginContext } from './PluginContext';
import { AnalysisEnginePluginAdapter } from './AnalysisEnginePluginAdapter';
import { AnalysisEngine, AnalysisResult, AnalysisContext, UpdatePolicy } from '../../analysis/framework';
import { IEngineServices } from '../EngineServices';
import { EngineContext } from '../EngineContext';

describe('Plugin System', () => {
  let registry: PluginRegistry;
  let manager: PluginManager;
  let mockContext: PluginContext;

  beforeEach(() => {
    registry = new PluginRegistry();
    // Reset singleton or test custom instance
    registry.clear();

    manager = new PluginManager();
    // Direct tests on manager will target the registry singleton,
    // so we can clear/reset singleton state.
    PluginRegistry.getInstance().clear();

    const mockServices = {
      time: { now: () => 123456 },
      logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
    } as unknown as IEngineServices;

    const mockEngineContext = {
      services: mockServices,
      analysis: {
        settings: {},
        metricsCache: { current: {} }
      }
    } as unknown as EngineContext;

    mockContext = {
      engineContext: mockEngineContext,
      services: mockServices,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      renderer: {} as THREE.WebGLRenderer,
      player: {
        position: new THREE.Vector3(),
        direction: new THREE.Vector3(0, 0, -1),
        eyeHeight: 1.65,
        yaw: 0
      },
      colliders: [],
      settings: {},
      analysisSettings: {}
    };
  });

  describe('PluginRegistry', () => {
    it('should register and retrieve plugins', () => {
      const p: IPlugin = {
        id: 'test-p',
        name: 'Test Plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      registry.register(p);
      expect(registry.getPlugins()).toContain(p);
      expect(registry.getEnabledPlugins()).toContain(p);
    });

    it('should reject duplicate plugin IDs without disposing the existing plugin', () => {
      const existingDispose = vi.fn();
      const duplicateDispose = vi.fn();
      const existing: IPlugin = {
        id: 'test-p',
        name: 'Existing Plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: existingDispose
      };
      const duplicate: IPlugin = {
        id: 'test-p',
        name: 'Duplicate Plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: duplicateDispose
      };

      registry.register(existing);

      expect(() => registry.register(duplicate)).toThrowError(
        'Plugin with id "test-p" is already registered.'
      );
      expect(registry.getPlugins()).toContain(existing);
      expect(registry.getPlugins()).not.toContain(duplicate);
      expect(registry.getEnabledPlugins()).toContain(existing);
      expect(existingDispose).not.toHaveBeenCalled();
      expect(duplicateDispose).not.toHaveBeenCalled();
    });

    it('should maintain deterministic execution order based on priority', () => {
      const pLow: IPlugin = {
        id: 'z-low',
        name: 'Low Priority',
        version: '1.0.0',
        priority: 150,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      const pHigh: IPlugin = {
        id: 'a-high',
        name: 'High Priority',
        version: '1.0.0',
        priority: 10,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      const pMid: IPlugin = {
        id: 'm-mid',
        name: 'Mid Priority',
        version: '1.0.0',
        priority: 50,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      registry.register(pLow);
      registry.register(pHigh);
      registry.register(pMid);

      const sorted = registry.getEnabledPlugins();
      expect(sorted[0]).toBe(pHigh);
      expect(sorted[1]).toBe(pMid);
      expect(sorted[2]).toBe(pLow);
    });

    it('should fallback to alphabetical sorting when priorities are equal', () => {
      const pB: IPlugin = {
        id: 'plugin-b',
        name: 'Plugin B',
        version: '1.0.0',
        priority: 50,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      const pA: IPlugin = {
        id: 'plugin-a',
        name: 'Plugin A',
        version: '1.0.0',
        priority: 50,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      const pC: IPlugin = {
        id: 'plugin-c',
        name: 'Plugin C',
        version: '1.0.0',
        priority: 50,
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      registry.register(pC);
      registry.register(pB);
      registry.register(pA);

      const sorted = registry.getEnabledPlugins();
      expect(sorted[0]).toBe(pA);
      expect(sorted[1]).toBe(pB);
      expect(sorted[2]).toBe(pC);
    });

    it('should support enabling and disabling plugins', () => {
      const p: IPlugin = {
        id: 'test-p',
        name: 'Test Plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      registry.register(p);
      expect(registry.getEnabledPlugins()).toContain(p);

      registry.disable('test-p');
      expect(registry.getEnabledPlugins()).not.toContain(p);
      expect(registry.getPlugins()).toContain(p);

      registry.enable('test-p');
      expect(registry.getEnabledPlugins()).toContain(p);
    });

    it('should dispose and remove plugins on unregister', () => {
      const disposeSpy = vi.fn();
      const p: IPlugin = {
        id: 'test-p',
        name: 'Test Plugin',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: disposeSpy
      };

      registry.register(p);
      registry.unregister('test-p');

      expect(registry.getPlugins()).not.toContain(p);
      expect(disposeSpy).toHaveBeenCalledOnce();
    });
  });

  describe('PluginManager Singleton Integration', () => {
    it('should execute through singleton Manager', () => {
      const p: IPlugin = {
        id: 'singleton-p',
        name: 'Singleton Test',
        version: '1.0.0',
        initialize: vi.fn(),
        update: vi.fn(),
        dispose: vi.fn()
      };

      manager.register(p);
      expect(manager.getPlugins()).toContain(p);

      manager.disable('singleton-p');
      expect(manager.isEnabled('singleton-p')).toBe(false);

      manager.enable('singleton-p');
      expect(manager.isEnabled('singleton-p')).toBe(true);

      const disposeSpy = vi.spyOn(p, 'dispose');
      manager.unregister('singleton-p');
      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('AnalysisEnginePluginAdapter', () => {
    it('should correctly adapt an AnalysisEngine', () => {
      const mockEngineUpdate = vi.fn();
      const mockEngineInitialize = vi.fn();
      const mockEngineOnEnable = vi.fn();
      const mockEngineOnDisable = vi.fn();
      const mockEngineDispose = vi.fn();

      const mockEngine: AnalysisEngine = {
        metadata: {
          name: 'mock-engine-id',
          version: '1.2.3',
          category: 'other',
          priority: 42,
          updatePolicy: UpdatePolicy.FixedInterval,
          dependencies: []
        },
        isEnabled: true,
        initialize: mockEngineInitialize,
        update: mockEngineUpdate,
        onEnable: mockEngineOnEnable,
        onDisable: mockEngineOnDisable,
        onSettingsChanged: vi.fn(),
        dispose: mockEngineDispose,
        getResults: () => ({})
      };

      const adapter = new AnalysisEnginePluginAdapter(mockEngine);

      expect(adapter.id).toBe('mock-engine-id');
      expect(adapter.name).toBe('mock-engine-id');
      expect(adapter.version).toBe('1.2.3');
      expect(adapter.priority).toBe(42);

      // Initialize
      adapter.initialize(mockContext);
      expect(mockEngineInitialize).toHaveBeenCalledWith(mockContext.scene, mockContext.camera, mockContext.renderer);
      expect(mockEngineOnEnable).toHaveBeenCalled();

      // Update
      adapter.update(0.016, mockContext);
      expect(mockEngineUpdate).toHaveBeenCalledWith(expect.objectContaining({
        scene: mockContext.scene,
        camera: mockContext.camera,
        renderer: mockContext.renderer, // WebGLRenderer mock passed in
        deltaTime: 0.016,
        timestamp: 123456
      }));

      // Dispose
      adapter.dispose();
      expect(mockEngineOnDisable).toHaveBeenCalled();
      expect(mockEngineDispose).toHaveBeenCalled();
    });
  });
});
