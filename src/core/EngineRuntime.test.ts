// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { EngineRuntime } from './EngineRuntime';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(function() {
      return {
        setSize: vi.fn(),
        dispose: vi.fn(),
        shadowMap: { enabled: false, type: 0 },
      };
    }),
  };
});

describe('EngineRuntime Unit Tests', () => {
  let runtime: EngineRuntime;

  beforeEach(() => {
    runtime = new EngineRuntime();
  });

  it('should initialize and hold an engine instance', () => {
    expect(runtime.isInitialized).toBe(false);
    expect(runtime.engine).toBeDefined();

    const mockCanvas = document.createElement('canvas');
    const mockContainer = document.createElement('div');
    
    // Mock the initialize of ThreeSceneManager
    vi.spyOn(runtime.engine.threeSceneManager, 'initialize').mockImplementation(() => {});

    runtime.initialize(mockCanvas, mockContainer);
    expect(runtime.isInitialized).toBe(true);
    expect(runtime.engine.threeSceneManager.initialize).toHaveBeenCalledWith(mockCanvas, mockContainer);
  });

  it('should toggle running and paused state on start, pause, resume, and stop', () => {
    const mockCanvas = document.createElement('canvas');
    const mockContainer = document.createElement('div');
    vi.spyOn(runtime.engine.threeSceneManager, 'initialize').mockImplementation(() => {});

    runtime.initialize(mockCanvas, mockContainer);

    expect(runtime.isRunning).toBe(false);
    expect(runtime.isPaused).toBe(false);

    const tick = vi.fn();
    
    // Mock requestAnimationFrame
    const originalRaf = global.requestAnimationFrame;
    const originalCaf = global.cancelAnimationFrame;
    global.requestAnimationFrame = vi.fn().mockReturnValue(123) as any;
    global.cancelAnimationFrame = vi.fn() as any;

    runtime.start(tick);
    expect(runtime.isRunning).toBe(true);
    expect(global.requestAnimationFrame).toHaveBeenCalled();

    runtime.pause();
    expect(runtime.isPaused).toBe(true);

    runtime.resume();
    expect(runtime.isPaused).toBe(false);

    runtime.stop();
    expect(runtime.isRunning).toBe(false);
    expect(global.cancelAnimationFrame).toHaveBeenCalledWith(123);

    // Clean up globals
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCaf;
  });

  it('should call unbind and dispose on dispose', () => {
    const mockCanvas = document.createElement('canvas');
    const mockContainer = document.createElement('div');
    
    const originalEngine = runtime.engine;
    const disposeSpy = vi.spyOn(originalEngine.threeSceneManager, 'dispose').mockImplementation(() => {});
    const unbindSpy = vi.spyOn(originalEngine.inputManager, 'unbind').mockImplementation(() => {});

    runtime.initialize(mockCanvas, mockContainer);
    runtime.dispose();

    expect(runtime.isInitialized).toBe(false);
    expect(disposeSpy).toHaveBeenCalled();
    expect(unbindSpy).toHaveBeenCalled();
  });
});
