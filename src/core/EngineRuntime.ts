import { EngineFactory } from './EngineFactory';
import { IEngine } from './interfaces/IEngine';
import { engineServices } from './EngineServices';

export class EngineRuntime {
  private _engine: IEngine = EngineFactory.create();
  private _isInitialized: boolean = false;
  private _isRunning: boolean = false;
  private _isPaused: boolean = false;
  private _animId: number | null = null;

  /**
   * Retrieves the current engine instance.
   */
  public get engine(): IEngine {
    return this._engine;
  }

  /**
   * Getters for states
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  /**
   * Creates/initializes all runtime resources and initializes each subsystem.
   */
  public initialize(canvas: HTMLCanvasElement, container: HTMLElement): void {
    if (this._isInitialized) return;

    // Initializes ThreeSceneManager
    this._engine.threeSceneManager.initialize(canvas, container as HTMLDivElement);

    // Document/initialize other components
    // InputManager is configured and bound via SimulatorCanvas bind methods.
    // CameraController, CharacterController, and SimulationLoop are fully wired upon creation.

    this._isInitialized = true;
  }

  /**
   * Starts the requestAnimationFrame simulation/render loop.
   */
  public start(tick: (dt: number, isPaused: boolean) => void): void {
    if (!this._isInitialized) {
      throw new Error('EngineRuntime is not initialized. Call initialize() first.');
    }
    if (this._isRunning) return;

    this._isRunning = true;
    this._isPaused = false;

    let lastTime = engineServices.time.now();

    const animate = () => {
      if (!this._isRunning) return;
      this._animId = requestAnimationFrame(animate);

      const now = engineServices.time.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      tick(dt, this._isPaused);
    };

    this._animId = requestAnimationFrame(animate);
  }

  /**
   * Pauses the simulation updates.
   */
  public pause(): void {
    this._isPaused = true;
  }

  /**
   * Resumes the simulation updates.
   */
  public resume(): void {
    this._isPaused = false;
  }

  /**
   * Stops the requestAnimationFrame loop entirely.
   */
  public stop(): void {
    this._isRunning = false;
    if (this._animId !== null) {
      cancelAnimationFrame(this._animId);
      this._animId = null;
    }
  }

  /**
   * Releases all resources and unbinds events.
   */
  public dispose(): void {
    this.stop();
    if (this._engine) {
      this._engine.threeSceneManager.dispose();
      this._engine.inputManager.unbind();
    }
    this._isInitialized = false;
    this._engine = EngineFactory.create();
  }
}
