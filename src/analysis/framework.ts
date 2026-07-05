/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PerformanceProfiler } from '../core/PerformanceProfiler';

/**
 * UpdatePolicy defines how and when an Analysis Engine's update loop is triggered.
 */
export enum UpdatePolicy {
  /** Updated every frame (e.g., Spatial Measurement, Player Tracking) */
  Always = 'always',
  
  /** Updated only when specific events or settings change (e.g., Solar Study when date/time changes) */
  EventDriven = 'event-driven',
  
  /** Updated at a throttle/throttle-like interval (e.g., Wind Analysis updating every 100ms for performance) */
  FixedInterval = 'fixed-interval',
  
  /** Updated only when explicitly called manually */
  Manual = 'manual'
}

/**
 * Metadata containing self-descriptive attributes of the analysis engine.
 */
export interface EngineMetadata {
  /** Unique identifier of the engine (e.g., 'solar-engine', 'measure-engine') */
  name: string;
  /** SemVer version of the engine (e.g., '1.0.0') */
  version: string;
  /** Classification of analysis */
  category: 'solar' | 'measure' | 'wind' | 'thermal' | 'acoustic' | 'accessibility' | 'other';
  /**
   * Execution priority. Lower numbers run earlier in the update cycle.
   * e.g., Player/Physics (10) -> Solar (20) -> Measure (30) -> Wind (40) -> HUD (50)
   */
  priority: number;
  /** The updating scheme of this engine */
  updatePolicy: UpdatePolicy;
  /** If updatePolicy is FixedInterval, defines the interval in milliseconds */
  updateIntervalMs?: number;
  /** Names of other engines that this engine expects to be initialized and run before it */
  dependencies: string[];
}

/**
 * Shared input context for all Analysis Engines.
 * This encapsulates all the spatial, environment, and state information
 * that any engine may need for its calculations.
 */
export interface AnalysisContext {
  /** Core spatial/rendering objects */
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;

  /** Player/Avatar spatial state */
  player: {
    position: THREE.Vector3;
    direction: THREE.Vector3;
    eyeHeight: number;
    yaw: number;
  };

  /** World physical structures for raycasting and collisions */
  colliders: THREE.Object3D[];

  /** General app-wide settings and presets */
  settings: any;

  /** Frame timing information */
  deltaTime: number;
  timestamp: number;

  /** Optional / Domain-specific simulation contexts */
  mouse?: { x: number; y: number };

  /** Continuous engine settings and active states (Single Source of Truth) */
  analysisSettings: {
    shouldRunRaycasts?: boolean;
    measure?: {
      eyeLevelEnabled: boolean;
      ceilingHeightEnabled: boolean;
      walkwayWidthEnabled: boolean;
      wallDistanceEnabled: boolean;
      eyeRayEnabled: boolean;
      dimensionLabelsEnabled: boolean;
      measureArrowEnabled: boolean;
    };
    solar?: {
      date: string;
      time: string;
      latitude: number;
      longitude: number;
      timezone: number;
      modelNorth: number;
    };
    wind?: {
      speed: number;
      angle: number;
    };
    thermal?: any;
    lighting?: any;
  };
}

/**
 * Standardized data format for all analysis outputs.
 * This ensures unified display in the UI and consistent event streaming.
 */
export interface AnalysisResult {
  /** Human-readable display label (e.g., 'Walkway Width') */
  name: string;
  /** The measured or calculated value */
  value: string | number | boolean;
  /** Optional unit of measurement (e.g., 'm', 'm/s', '%', '°') */
  unit?: string;
  /** Current status of the measurement */
  status: 'success' | 'warning' | 'error' | 'inactive';
  /** Optional descriptive warning message if status is 'warning' or 'error' */
  warning?: string;
  /** UNIX epoch millisecond or performance timestamp when this result was computed */
  timestamp: number;
  /** Additional custom metadata or coordinate data for advanced usages */
  extraData?: any;
}

/**
 * Interface that all PHI WALK Analysis Engines must implement.
 */
export interface AnalysisEngine {
  /** Self-describing metadata */
  readonly metadata: EngineMetadata;
  
  /** Active status of the engine */
  readonly isEnabled: boolean;

  /**
   * Initialize the engine with Three.js core objects.
   * Called once when the engine is registered or the canvas mounts.
   */
  initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void;

  /**
   * Called to update the engine state.
   * @param context Unified shared workspace context
   */
  update(context: AnalysisContext): void;

  /**
   * Triggered when the engine is activated.
   * Allocate resources, add helper meshes to the scene, or subscribe to events here.
   */
  onEnable(): void;

  /**
   * Triggered when the engine is deactivated.
   * Remove helper meshes from the scene, pause computation, or clear caches here.
   */
  onDisable(): void;

  /**
   * Responds to changes in general app/workspace settings.
   * Useful for engines with EventDriven policies.
   */
  onSettingsChanged(settings: any): void;

  /**
   * Clean up all allocated memory, geometries, materials, and textures.
   * Unsubscribe from all event listeners to prevent memory leaks.
   */
  dispose(): void;

  /**
   * Returns the current standardized results computed by this engine.
   */
  getResults(): Record<string, AnalysisResult>;
}

/**
 * Central Registry for managing and coordinating all Analysis Engines.
 */
export class EngineRegistry {
  private static instance: EngineRegistry;
  private engines: Map<string, AnalysisEngine> = new Map();
  private sortedEngines: AnalysisEngine[] = [];
  private lastUpdateTimes: Map<string, number> = new Map();
  private cachedScene: THREE.Scene | null = null;
  private cachedCamera: THREE.Camera | null = null;
  private cachedRenderer: THREE.WebGLRenderer | null = null;

  private constructor() {}

  public static getInstance(): EngineRegistry {
    if (!EngineRegistry.instance) {
      EngineRegistry.instance = new EngineRegistry();
    }
    return EngineRegistry.instance;
  }

  /**
   * Register a new Analysis Engine.
   */
  public register(engine: AnalysisEngine): void {
    if (this.engines.has(engine.metadata.name)) {
      console.warn(`Engine with name "${engine.metadata.name}" is already registered. Overwriting.`);
    }
    this.engines.set(engine.metadata.name, engine);
    this.rebuildSortedEngines();

    if (this.cachedScene && this.cachedCamera && this.cachedRenderer) {
      try {
        engine.initialize(this.cachedScene, this.cachedCamera, this.cachedRenderer);
      } catch (err) {
        console.error(`Failed to initialize registered engine "${engine.metadata.name}":`, err);
      }
    }
  }

  /**
   * Unregister an Analysis Engine and dispose of it.
   */
  public unregister(name: string): void {
    const engine = this.engines.get(name);
    if (engine) {
      engine.dispose();
      this.engines.delete(name);
      this.lastUpdateTimes.delete(name);
      this.rebuildSortedEngines();
    }
  }

  /**
   * Retrieve a registered engine by its name.
   */
  public getEngine<T extends AnalysisEngine>(name: string): T | undefined {
    return this.engines.get(name) as T;
  }

  /**
   * Get all currently registered engines.
   */
  public getAllEngines(): AnalysisEngine[] {
    return this.sortedEngines;
  }

  /**
   * Initialize all registered engines.
   */
  public initializeAll(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.cachedScene = scene;
    this.cachedCamera = camera;
    this.cachedRenderer = renderer;

    // Validate dependencies first
    this.validateDependencies();

    for (const engine of this.sortedEngines) {
      try {
        engine.initialize(scene, camera, renderer);
      } catch (err) {
        console.error(`Failed to initialize engine "${engine.metadata.name}":`, err);
      }
    }
  }

  /**
   * Update all active engines according to their priorities and update policies.
   */
  public updateAll(context: AnalysisContext): void {
    for (const engine of this.sortedEngines) {
      if (!engine.isEnabled) continue;

      const { updatePolicy, updateIntervalMs, name } = engine.metadata;

      let profilerName: string | null = null;
      if (name.includes('measure')) {
        profilerName = 'Measurement';
      } else if (name.includes('solar')) {
        profilerName = 'Solar';
      } else if (name.includes('wind')) {
        profilerName = 'Wind';
      }

      if (updatePolicy === UpdatePolicy.Always) {
        if (profilerName) PerformanceProfiler.begin(profilerName);
        engine.update(context);
        if (profilerName) PerformanceProfiler.end(profilerName);
      } else if (updatePolicy === UpdatePolicy.FixedInterval && updateIntervalMs) {
        const lastUpdate = this.lastUpdateTimes.get(name) || 0;
        if (context.timestamp - lastUpdate >= updateIntervalMs) {
          if (profilerName) PerformanceProfiler.begin(profilerName);
          engine.update(context);
          if (profilerName) PerformanceProfiler.end(profilerName);
          this.lastUpdateTimes.set(name, context.timestamp);
        }
      } else if (updatePolicy === UpdatePolicy.EventDriven || updatePolicy === UpdatePolicy.Manual) {
        // Event-driven or Manual engines can still be ticked if they choose to do passive updates.
      }
    }
  }

  /**
   * Broadcast settings change to all registered engines.
   */
  public broadcastSettingsChanged(settings: any): void {
    for (const engine of this.sortedEngines) {
      if (engine.isEnabled) {
        try {
          engine.onSettingsChanged(settings);
        } catch (err) {
          console.error(`Error broadcasing settings to "${engine.metadata.name}":`, err);
        }
      }
    }
  }

  /**
   * Fetch a consolidated snapshot of results from all enabled engines.
   */
  public getConsolidatedResults(): Record<string, AnalysisResult> {
    const consolidated: Record<string, AnalysisResult> = {};
    for (const engine of this.sortedEngines) {
      if (engine.isEnabled) {
        Object.assign(consolidated, engine.getResults());
      }
    }
    return consolidated;
  }

  /**
   * Dispose and clear all registered engines.
   */
  public disposeAll(): void {
    for (const engine of this.sortedEngines) {
      try {
        engine.dispose();
      } catch (err) {
        console.error(`Error disposing engine "${engine.metadata.name}":`, err);
      }
    }
    this.engines.clear();
    this.sortedEngines = [];
    this.lastUpdateTimes.clear();
  }

  private rebuildSortedEngines(): void {
    this.sortedEngines = Array.from(this.engines.values()).sort(
      (a, b) => a.metadata.priority - b.metadata.priority
    );
  }

  private validateDependencies(): void {
    for (const engine of this.sortedEngines) {
      for (const dep of engine.metadata.dependencies) {
        if (!this.engines.has(dep)) {
          console.warn(
            `Dependency Warning: Engine "${engine.metadata.name}" requires "${dep}" which is not currently registered.`
          );
        }
      }
    }
  }
}
