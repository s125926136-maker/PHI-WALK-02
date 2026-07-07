// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { AnalysisEngine, EngineRegistry, UpdatePolicy } from './framework';

function createMockEngine(name: string): AnalysisEngine {
  return {
    metadata: {
      name,
      version: '1.0.0',
      category: 'other',
      priority: 10,
      updatePolicy: UpdatePolicy.Always,
      dependencies: [],
    },
    isEnabled: true,
    initialize: vi.fn(),
    update: vi.fn(),
    onEnable: vi.fn(),
    onDisable: vi.fn(),
    onSettingsChanged: vi.fn(),
    dispose: vi.fn(),
    getResults: vi.fn(() => ({})),
  };
}

describe('EngineRegistry lifecycle ownership', () => {
  it('initializes and disposes each registered analysis engine exactly once', () => {
    const registry = EngineRegistry.getInstance();
    registry.disposeAll();

    const engine = createMockEngine('test-analysis-engine');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderer = {} as THREE.WebGLRenderer;

    registry.register(engine);
    registry.initializeAll(scene, camera, renderer);
    registry.initializeAll(scene, camera, renderer);

    expect(engine.initialize).toHaveBeenCalledOnce();
    expect(engine.initialize).toHaveBeenCalledWith(scene, camera, renderer);
    expect(engine.onEnable).toHaveBeenCalledOnce();

    registry.unregister('test-analysis-engine');
    registry.unregister('test-analysis-engine');

    expect(engine.onDisable).toHaveBeenCalledOnce();
    expect(engine.dispose).toHaveBeenCalledOnce();
  });
});
