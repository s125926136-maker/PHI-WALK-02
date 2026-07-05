/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ModuleRegistry } from './ModuleRegistry';
import { IModule } from './IModule';
import { EngineContext } from './EngineContext';

describe('ModuleRegistry Unit Tests', () => {
  let registry: ModuleRegistry;
  let mockEngineContext: any;

  beforeEach(() => {
    registry = new ModuleRegistry();
    mockEngineContext = {};
  });

  it('should successfully register and retrieve a module by name', () => {
    const mockModule: IModule = {
      name: 'TestModule',
      priority: 50,
      update: vi.fn(),
    };

    registry.register(mockModule);
    expect(registry.getModule('TestModule')).toBe(mockModule);
    expect(registry.getModules().length).toBe(1);
    expect(registry.getModules()[0]).toBe(mockModule);
  });

  it('should prevent duplicate registration of the same module name', () => {
    const mockModule1: IModule = {
      name: 'DuplicateModule',
      priority: 50,
      update: vi.fn(),
    };

    const mockModule2: IModule = {
      name: 'DuplicateModule',
      priority: 100,
      update: vi.fn(),
    };

    registry.register(mockModule1);
    expect(() => registry.register(mockModule2)).toThrowError(
      'Module with name "DuplicateModule" is already registered.'
    );
  });

  it('should unregister a module and call its dispose method if it exists', () => {
    const disposeSpy = vi.fn();
    const mockModule: IModule = {
      name: 'DisposableModule',
      priority: 50,
      update: vi.fn(),
      dispose: disposeSpy,
    };

    registry.register(mockModule);
    expect(registry.getModule('DisposableModule')).toBe(mockModule);

    registry.unregister('DisposableModule');
    expect(registry.getModule('DisposableModule')).toBeUndefined();
    expect(disposeSpy).toHaveBeenCalledTimes(1);
  });

  it('should return read-only module array sorted strictly by priority ascending', () => {
    const lowPriorityModule: IModule = {
      name: 'LowPriority',
      priority: 10,
      update: vi.fn(),
    };

    const highPriorityModule: IModule = {
      name: 'HighPriority',
      priority: 100,
      update: vi.fn(),
    };

    const midPriorityModule: IModule = {
      name: 'MidPriority',
      priority: 50,
      update: vi.fn(),
    };

    // Register out of order
    registry.register(highPriorityModule);
    registry.register(lowPriorityModule);
    registry.register(midPriorityModule);

    const sortedModules = registry.getModules();
    expect(sortedModules.length).toBe(3);
    expect(sortedModules[0].name).toBe('LowPriority');
    expect(sortedModules[1].name).toBe('MidPriority');
    expect(sortedModules[2].name).toBe('HighPriority');
  });

  it('should fall back to stable lexicographical sorting when priorities are equal', () => {
    const moduleB: IModule = {
      name: 'ModuleB',
      priority: 50,
      update: vi.fn(),
    };

    const moduleA: IModule = {
      name: 'ModuleA',
      priority: 50,
      update: vi.fn(),
    };

    registry.register(moduleB);
    registry.register(moduleA);

    const sortedModules = registry.getModules();
    expect(sortedModules[0].name).toBe('ModuleA');
    expect(sortedModules[1].name).toBe('ModuleB');
  });

  it('should dispose all modules when clear or disposeAll is invoked', () => {
    const disposeSpy1 = vi.fn();
    const disposeSpy2 = vi.fn();

    registry.register({
      name: 'Mod1',
      priority: 10,
      update: vi.fn(),
      dispose: disposeSpy1,
    });

    registry.register({
      name: 'Mod2',
      priority: 20,
      update: vi.fn(),
      dispose: disposeSpy2,
    });

    registry.disposeAll();
    expect(registry.getModules().length).toBe(0);
    expect(disposeSpy1).toHaveBeenCalledTimes(1);
    expect(disposeSpy2).toHaveBeenCalledTimes(1);
  });

  it('should initialize all modules when initializeAll is called', async () => {
    const initSpy1 = vi.fn();
    const initSpy2 = vi.fn();

    registry.register({
      name: 'Mod1',
      priority: 10,
      update: vi.fn(),
      initialize: initSpy1,
    });

    registry.register({
      name: 'Mod2',
      priority: 20,
      update: vi.fn(),
      initialize: initSpy2,
    });

    await registry.initializeAll(mockEngineContext as EngineContext);
    expect(initSpy1).toHaveBeenCalledWith(mockEngineContext);
    expect(initSpy2).toHaveBeenCalledWith(mockEngineContext);
  });

  it('should support manual sortModules triggering', () => {
    const mB: IModule = { name: 'B', priority: 10, update: vi.fn() };
    const mA: IModule = { name: 'A', priority: 10, update: vi.fn() };

    // Bypass standard registration ordering for testing sortModules directly if needed
    registry.register(mB);
    registry.register(mA);

    registry.sortModules();
    const sorted = registry.getModules();
    expect(sorted[0].name).toBe('A');
    expect(sorted[1].name).toBe('B');
  });
});
