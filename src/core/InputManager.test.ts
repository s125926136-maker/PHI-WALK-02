// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager, InputManagerConfig } from './InputManager';
import { CharacterController } from './CharacterController';
import { CameraController } from './CameraController';
import { CollisionSystem } from './CollisionSystem';

describe('InputManager Unit Tests', () => {
  let inputManager: InputManager;
  let mockCanvas: any;
  let mockContainer: any;
  let characterController: CharacterController;
  let cameraController: CameraController;
  let mockConfig: InputManagerConfig;
  let lastActiveKeys: Record<string, boolean> = {};
  let lastSettings: any = {};

  beforeEach(() => {
    lastActiveKeys = {};
    lastSettings = {
      viewMode: 'first-person',
      posture: 'standing',
      presetId: 'explorer',
      showMeasureVisualization: false,
      showOrientationAnalysis: false,
      showNightVision: false,
      showCompass: false,
      showFloatingPanel: false,
    };

    mockCanvas = {
      requestPointerLock: vi.fn(),
    } as any;

    mockContainer = {
      requestFullscreen: vi.fn().mockResolvedValue(undefined),
    } as any;

    characterController = new CharacterController(new CollisionSystem());
    cameraController = new CameraController('first-person');

    mockConfig = {
      getSettings: () => lastSettings,
      getIsLocked: () => false,
      getIsTabCursorMode: () => false,
      getShowTimeControl: () => false,
      getShowCharacterModal: () => false,
      getShowSetupConfirm: () => false,
      getIsWorkspaceExpanded: () => false,
      getActiveWorkspaceTab: () => null,
      onActiveKeysChange: (keys) => { lastActiveKeys = keys; },
      onLockChange: vi.fn(),
      onFullscreenChange: vi.fn(),
      onTabCursorModeChange: vi.fn(),
      onReach: vi.fn(),
      onTimeControlToggle: vi.fn(),
      onSettingsChange: (settings) => { lastSettings = { ...lastSettings, ...settings }; },
    };

    inputManager = new InputManager();
  });

  it('should bind and unbind event listeners without crash', () => {
    expect(() => {
      inputManager.bind(mockCanvas, mockContainer, characterController, cameraController, mockConfig);
    }).not.toThrow();

    expect(() => {
      inputManager.unbind();
    }).not.toThrow();
  });

  it('should request pointer lock under suitable conditions', () => {
    inputManager.bind(mockCanvas, mockContainer, characterController, cameraController, mockConfig);
    inputManager.requestPointerLock();
    expect(mockCanvas.requestPointerLock).toHaveBeenCalled();
  });

  it('should clear active keys correctly', () => {
    inputManager.bind(mockCanvas, mockContainer, characterController, cameraController, mockConfig);
    inputManager.clearActiveKeys();
    expect(lastActiveKeys).toEqual({});
  });
});
