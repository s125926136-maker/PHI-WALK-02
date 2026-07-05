import { CharacterController, CharacterInputState } from './CharacterController';
import { CameraController } from './CameraController';
import { engineServices } from './EngineServices';

export interface InputManagerConfig {
  getSettings: () => any;
  getIsLocked: () => boolean;
  getIsTabCursorMode: () => boolean;
  getShowTimeControl: () => boolean;
  getShowCharacterModal: () => boolean;
  getShowSetupConfirm: () => boolean;
  getIsWorkspaceExpanded: () => boolean;
  getActiveWorkspaceTab: () => any;
  
  onActiveKeysChange: (activeKeys: Record<string, boolean>) => void;
  onLockChange: (isLocked: boolean) => void;
  onFullscreenChange: (isFullscreen: boolean) => void;
  onTabCursorModeChange: (isTabCursorMode: boolean) => void;
  onReach: () => void;
  onTimeControlToggle: (nextValue: boolean) => void;
  onSettingsChange: (settings: any) => void;
}

export class InputManager {
  private _canvas: HTMLCanvasElement | null = null;
  private _container: HTMLDivElement | null = null;
  private _characterController: CharacterController | null = null;
  private _cameraController: CameraController | null = null;
  private _config!: InputManagerConfig;
  private _activeKeys: Record<string, boolean> = {};

  // Compass dragging support
  private _panelCompassMoveCallback: ((clientX: number, clientY: number) => void) | null = null;
  private _panelCompassDragEndCallback: (() => void) | null = null;

  public updateConfig(config: InputManagerConfig): void {
    this._config = config;
  }

  public bind(
    canvas: HTMLCanvasElement,
    container: HTMLDivElement,
    characterController: CharacterController,
    cameraController: CameraController,
    config: InputManagerConfig
  ): void {
    this._canvas = canvas;
    this._container = container;
    this._characterController = characterController;
    this._cameraController = cameraController;
    this._config = config;

    // Register all event listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('wheel', this.handleWheel, { passive: false });
    window.addEventListener('mousemove', this.handleWindowMouseMove);
    window.addEventListener('mouseup', this.handleWindowMouseUp);
    
    document.addEventListener('pointerlockchange', this.handleLockChange);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('fullscreenchange', this.handleFullscreenChange);
  }

  public unbind(): void {
    // Unregister all event listeners
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('wheel', this.handleWheel);
    window.removeEventListener('mousemove', this.handleWindowMouseMove);
    window.removeEventListener('mouseup', this.handleWindowMouseUp);

    document.removeEventListener('pointerlockchange', this.handleLockChange);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('fullscreenchange', this.handleFullscreenChange);

    this._canvas = null;
    this._container = null;
    this._characterController = null;
    this._cameraController = null;
  }

  public update(): void {
    // Frame-by-frame updates (none required since inputs are event-driven, but kept for interface consistency)
  }

  public requestPointerLock(): void {
    const settings = this._config.getSettings();
    const isTabCursorMode = this._config.getIsTabCursorMode();
    const showTimeControl = this._config.getShowTimeControl();
    const showCharacterModal = this._config.getShowCharacterModal();
    const activeWorkspaceTab = this._config.getActiveWorkspaceTab();
    const isWorkspaceExpanded = this._config.getIsWorkspaceExpanded();
    
    if (isTabCursorMode || settings.showFloatingPanel || showTimeControl || showCharacterModal || (activeWorkspaceTab !== null && isWorkspaceExpanded)) {
      return;
    }
    if (this._canvas) {
      this._canvas.requestPointerLock();
    }
  }

  public toggleFullscreen(): void {
    if (!this._container) return;
    if (!document.fullscreenElement) {
      this._container.requestFullscreen().then(() => this._config.onFullscreenChange(true));
    } else {
      document.exitFullscreen().then(() => this._config.onFullscreenChange(false));
    }
  }

  public startPanelCompassDrag(
    clientX: number,
    clientY: number,
    onMove: (clientX: number, clientY: number) => void,
    onEnd: () => void
  ): void {
    this._panelCompassMoveCallback = onMove;
    this._panelCompassDragEndCallback = onEnd;
    onMove(clientX, clientY);
  }

  public clearActiveKeys(): void {
    this._activeKeys = {};
    this._config.onActiveKeysChange({});
  }

  private handleLockChange = () => {
    if (!this._canvas) return;
    const locked = document.pointerLockElement === this._canvas;
    this._config.onLockChange(locked);
    if (!locked) {
      this.clearActiveKeys();
    } else {
      this._config.onTabCursorModeChange(false);
    }
  };

  private handleFullscreenChange = () => {
    const isFullscreen = document.fullscreenElement === this._container;
    this._config.onFullscreenChange(isFullscreen);
  };

  private handleMouseMove = (e: MouseEvent) => {
    const isLocked = this._config.getIsLocked();
    if (!isLocked) return;

    const sensitivity = 0.0022;
    if (this._characterController) {
      this._characterController.handleLook(e.movementX, e.movementY, sensitivity);
    }
  };

  private handleWheel = (e: WheelEvent) => {
    const settings = this._config.getSettings();
    if (settings.viewMode !== 'third-person') return;

    const zoomSpeed = 0.003;
    const delta = e.deltaY * zoomSpeed;
    if (this._cameraController) {
      this._cameraController.adjustZoom(delta);
    }

    const isLocked = this._config.getIsLocked();
    if (isLocked || (this._container && this._container.contains(e.target as Node))) {
      e.preventDefault();
    }
  };

  private handleWindowMouseMove = (e: MouseEvent) => {
    if (this._panelCompassMoveCallback) {
      this._panelCompassMoveCallback(e.clientX, e.clientY);
    }
  };

  private handleWindowMouseUp = () => {
    if (this._panelCompassDragEndCallback) {
      this._panelCompassDragEndCallback();
      this._panelCompassMoveCallback = null;
      this._panelCompassDragEndCallback = null;
    }
  };

  private handleKeyDown = (e: KeyboardEvent) => {
    // 1. Camera / View Controls (1, 3)
    if (e.code === 'Digit1' || e.key === '1') {
      e.preventDefault();
      this._config.onSettingsChange({ viewMode: 'first-person' });
      return;
    }
    if (e.code === 'Digit3' || e.key === '3') {
      e.preventDefault();
      this._config.onSettingsChange({ viewMode: 'third-person' });
      return;
    }

    // 2. Mode Toggle (Tab) - FPS Mode <---> UI Mode
    if (e.key === 'Tab') {
      e.preventDefault();
      const pointerLocked = document.pointerLockElement === this._canvas;
      const isLocked = this._config.getIsLocked();
      if (isLocked || pointerLocked) {
        engineServices.logger.log("TAB pressed");
        engineServices.logger.log("Cursor Mode ON");
        if (pointerLocked) {
          document.exitPointerLock();
        }
        this._config.onLockChange(false);
        this._config.onTabCursorModeChange(true);
        this.clearActiveKeys();
      } else {
        engineServices.logger.log("TAB pressed");
        engineServices.logger.log("Cursor Mode OFF");
        this._config.onTabCursorModeChange(false);
        this.requestPointerLock();
      }
      return;
    }

    // 3. Pointer Lock Release / Control Pause (Escape) - FPS Mode -> Pointer Unlock
    if (e.key === 'Escape') {
      e.preventDefault();
      engineServices.logger.log("ESC pressed");
      engineServices.logger.log("Pointer Unlock");
      if (document.pointerLockElement === this._canvas) {
        document.exitPointerLock();
      }
      this._config.onLockChange(false);
      this._config.onTabCursorModeChange(false);
      this.clearActiveKeys();
      return;
    }

    // 4. Simulation Control (T)
    if (e.key === 't' || e.key === 'T') {
      e.preventDefault();
      const nextShowTimeControl = !this._config.getShowTimeControl();
      this._config.onTimeControlToggle(nextShowTimeControl);
      return;
    }

    const key = e.key.toLowerCase();
    const isLocked = this._config.getIsLocked();
    if (!isLocked) return;

    // Capture inputs: Movement, Character Posture, Analysis Mode toggles
    if (['w', 'a', 's', 'd', ' ', 'shift', 'control', 'c', 'e', 'm', 'o', 'n', 'b'].includes(key) || e.key === ' ') {
      e.preventDefault();

      const settings = this._config.getSettings();
      const isWheelchair = settings.presetId === 'wheelchair';
      if (isWheelchair && (key === ' ' || key === 'control' || key === 'c' || e.key === ' ')) {
        return;
      }

      if (e.key === ' ') {
        this._activeKeys[' '] = true;
      } else {
        this._activeKeys[key] = true;
      }
      this._config.onActiveKeysChange({ ...this._activeKeys });

      // 5. Character Posture & Interaction
      if (key === 'c') {
        this._config.onSettingsChange({ posture: settings.posture === 'sitting' ? 'standing' : 'sitting' });
      }
      if (key === 'control') {
        this._config.onSettingsChange({ posture: settings.posture === 'crouching' ? 'standing' : 'crouching' });
      }
      if (key === 'e') {
        this._config.onReach();
      }

      // 6. Analysis Mode toggles
      if (key === 'm') {
        this._config.onSettingsChange({ showMeasureVisualization: !settings.showMeasureVisualization });
      }
      if (key === 'o') {
        this._config.onSettingsChange({ showOrientationAnalysis: !settings.showOrientationAnalysis });
      }
      if (key === 'n') {
        this._config.onSettingsChange({ showNightVision: !settings.showNightVision });
      }
      if (key === 'b') {
        this._config.onSettingsChange({ showCompass: !settings.showCompass });
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', ' ', 'shift', 'control', 'c', 'e', 'm', 'o', 'n', 'b'].includes(key) || e.key === ' ') {
      const settings = this._config.getSettings();
      const isWheelchair = settings.presetId === 'wheelchair';
      if (isWheelchair && (key === ' ' || key === 'control' || key === 'c' || e.key === ' ')) {
        return;
      }

      if (e.key === ' ') {
        this._activeKeys[' '] = false;
      } else {
        this._activeKeys[key] = false;
      }
      this._config.onActiveKeysChange({ ...this._activeKeys });
    }
  };
}
