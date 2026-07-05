// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { ThreeSceneManager } from './ThreeSceneManager';

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

describe('ThreeSceneManager Unit Tests', () => {
  let manager: ThreeSceneManager;
  let mockCanvas: HTMLCanvasElement;
  let mockContainer: HTMLDivElement;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockContainer = document.createElement('div');
    // Mock getBoundingClientRect
    mockContainer.getBoundingClientRect = () => ({
      width: 800,
      height: 600,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    manager = new ThreeSceneManager();
  });

  it('should initialize successfully', () => {
    expect(() => {
      manager.initialize(mockCanvas, mockContainer);
    }).not.toThrow();

    expect(manager.scene).toBeInstanceOf(THREE.Scene);
    expect(manager.camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(manager.renderer).toBeDefined();
    expect(manager.ambientLight).toBeInstanceOf(THREE.AmbientLight);
    expect(manager.hemiLight).toBeInstanceOf(THREE.HemisphereLight);
    expect(manager.dirLight).toBeInstanceOf(THREE.DirectionalLight);
    expect(manager.groundMesh).toBeInstanceOf(THREE.Mesh);
  });

  it('should handle resizing correctly', () => {
    manager.initialize(mockCanvas, mockContainer);
    expect(() => {
      manager.resize(1024, 768);
    }).not.toThrow();

    if (manager.camera) {
      expect(manager.camera.aspect).toBe(1024 / 768);
    }
  });

  it('should set sky background color correctly', () => {
    manager.initialize(mockCanvas, mockContainer);
    const color = new THREE.Color(0xff0000);
    manager.setSkyColor(color);
    if (manager.scene && manager.scene.background) {
      expect((manager.scene.background as THREE.Color).getHexString()).toBe('ff0000');
    }
  });

  it('should handle environment and fog management correctly', () => {
    manager.initialize(mockCanvas, mockContainer);
    
    // Fog
    manager.setFog(0xff0000, 10, 500);
    if (manager.scene) {
      expect(manager.scene.fog).toBeInstanceOf(THREE.Fog);
      const fog = manager.scene.fog as THREE.Fog;
      expect(fog.color.getHexString()).toBe('ff0000');
      expect(fog.near).toBe(10);
      expect(fog.far).toBe(500);
    }

    manager.clearFog();
    if (manager.scene) {
      expect(manager.scene.fog).toBeNull();
    }
  });

  it('should dispose resources correctly', () => {
    manager.initialize(mockCanvas, mockContainer);
    expect(() => {
      manager.dispose();
    }).not.toThrow();

    expect(manager.scene).toBeNull();
    expect(manager.camera).toBeNull();
    expect(manager.renderer).toBeNull();
    expect(manager.ambientLight).toBeNull();
    expect(manager.hemiLight).toBeNull();
    expect(manager.dirLight).toBeNull();
    expect(manager.groundMesh).toBeNull();
  });
});
