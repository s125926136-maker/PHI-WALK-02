# PHI WALK Analysis Engine Development Guideline

This document defines the architectural standards, performance limits, and lifecycle protocols for writing and integrating Simulation & Analysis modules within the PHI WALK application.

---

## 1. Core Architecture Pattern

All simulation modules (Solar Study, Spatial Measurement, Wind flow, Thermal comfort, Acoustics, etc.) **must** be designed as self-contained engines implementing the `AnalysisEngine` interface and registering themselves with the global `EngineRegistry` singleton.

### Architectural Layout:

```
                  ┌────────────────────────┐
                  │     SimulatorCanvas    │ (Core Canvas & Modules Orchestrator)
                  └───────────┬────────────┘
                              │
                    (Initializes / Ticks)
                              ▼
                  ┌────────────────────────┐
                  │     EngineRegistry     │ (Singleton Manager)
                  └───────────┬────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐┌──────────────────┐┌──────────────────┐
│   SolarEngine    ││  MeasureEngine   ││    WindEngine    │ (Implements AnalysisEngine)
└──────────────────┘└──────────────────┘└──────────────────┘
```

---

## 2. Update Policies

An engine's `UpdatePolicy` dictates how and when it should execute calculations. Choose the policy that minimizes CPU/GPU cycles while keeping data accurate:

| Engine | Update Policy | Rationale |
| :--- | :--- | :--- |
| **Player / Physics** | `Always` | Requires frame-by-frame collision detection and movement updates. |
| **Spatial Measurement** | `Always` | Needs immediate real-time feedback as the player character is actively moving around, dragging dimension lines, and pointing beams. |
| **Solar Study** | `EventDriven` | The sun position only changes when the date/time settings or geographical coordinates are modified. There is zero reason to compute solar angles on every frame if settings are static. |
| **Wind (Microclimate)** | `FixedInterval` | Fluid flow simulations are mathematically heavy. Running them every frame is wasteful. Throttling updates to once every `100ms` (10Hz) provides fluid visual updates while saving 80%+ of computation power. |
| **HUD / Telemetry** | `Always` | Updates overlay drawings and data readouts. It consumes the results of other engines and must react immediately. |

---

## 3. Priority Rules (Update Order)

When the `EngineRegistry` processes updates, engines are sorted ascendingly by their `priority` field:

```
Priority: 10 (Player/Physics) ──> 20 (Solar Study) ──> 30 (Spatial Measurement) ──> 40 (Wind) ──> 50 (HUD/UI)
```

### Why this order matters:
1. **Player/Physics (10)**: The player's physical position must be calculated first, as all spatial measurements and viewpoint-based calculations are dependent on where the player is currently standing.
2. **Solar Study (20)**: Computes the solar orientation and shadows. The resulting light directions and shadow planes form the environment context.
3. **Spatial Measurement (30)**: Executes raycasting from the player's updated eyes/camera position to the physical surroundings.
4. **Wind (40)**: Calculates local aerodynamic speeds relative to the physical corridors and player.
5. **HUD / UI (50)**: Always runs last. The HUD acts as a pure consumer of information, rendering textual data or overlays *after* all engines have completed their physical and mathematical computations for the frame. This avoids visual jittering and off-by-one-frame lag.

---

## 4. Engine Dependency & Coupling Rules

To maintain high code health, engines must be loosely coupled:

* **No direct UI or DOM manipulation**: An `AnalysisEngine` is strictly prohibited from holding references to React components, HTML elements, CSS variables, or the HUD.
* **Pure Data Communication**:
  * **Input**: State changes are delivered to engines via `onSettingsChanged(settings)` or registered global `eventBus` triggers.
  * **Output**: Results must be returned as standardized `AnalysisResult` objects through `getResults()`. This allows the UI (like `WorkspacePanels` or floating HUDs) to poll or subscribe to results without knowing Three.js implementation details.
* **Three.js Isolation**: All Three.js objects (meshes, helper lines, textures) created by the engine must be added to the `scene` during `onEnable()` (or `initialize()`) and **MUST** be cleanly removed from the `scene` and disposed of during `onDisable()` or `dispose()`.

---

## 5. Performance & Memory Management Rules

1. **Strict Object Recycler Pattern (No New allocations in `update`!)**:
   * **Never** do `new THREE.Vector3()`, `new THREE.Matrix4()`, or `new THREE.Raycaster()` inside the `update(deltaTime)` loop.
   * Allocate all necessary math helper variables *once* in the class scope or constructor, and reuse them via `.copy()`, `.set()`, or `.subVectors()`.
   * *Violation of this rule will trigger high Garbage Collector (GC) pressure, causing micro-stuttering and frame drops.*
2. **Raycast Throttling and Caching**:
   * If an engine needs to raycast, limit the number of checks. Do not raycast 100 times per frame.
   * Cache physical collider references. Only search the scene graph when the scene structure has mutated.
3. **Lazy Evaluation / Early Exits**:
   * Always check `if (!this.isEnabled) return;` at the start of your update routine.
   * If the player is stationary, bypass static measurements (e.g., if velocity is zero and settings haven't changed, reuse the cached `AnalysisResult`).
4. **GPU / RAM Disposal**:
   * Any custom geometry, material, or texture initialized by your engine **MUST** call `.dispose()` when the engine is disabled or disposed.

---

## 6. Standard Code Template

Every new Analysis Engine should follow this boilerplate structure:

```typescript
import * as THREE from 'three';
import { AnalysisEngine, EngineMetadata, UpdatePolicy, AnalysisResult } from './framework';

export class ThermalEngine implements AnalysisEngine {
  public readonly metadata: EngineMetadata = {
    name: 'thermal-engine',
    version: '1.0.0',
    category: 'thermal',
    priority: 35, // After Solar (20), before Wind (40)
    updatePolicy: UpdatePolicy.FixedInterval,
    updateIntervalMs: 250, // Runs 4 times a second (highly performant!)
    dependencies: ['solar-engine'] // depends on solar thermal context
  };

  private _isEnabled: boolean = false;
  private scene!: THREE.Scene;
  private results: Record<string, AnalysisResult> = {};

  // Performance cache variables (Pre-allocate)
  private tempPos = new THREE.Vector3();

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  public initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.scene = scene;
    // Create visual assets, but do not add to scene yet
  }

  public onEnable(): void {
    this._isEnabled = true;
    // Add helpers/visuals to Three.js scene
    console.log(`${this.metadata.name} enabled.`);
  }

  public onDisable(): void {
    this._isEnabled = false;
    // Remove helpers/visuals from Three.js scene
    console.log(`${this.metadata.name} disabled.`);
  }

  public update(deltaTime: number, timestamp: number): void {
    if (!this._isEnabled) return;

    // 1. Perform complex calculations using pre-allocated math objects
    const heatIndex = this.calculateHeatIndex();

    // 2. Set result in standardized format
    this.results['heat-index'] = {
      name: 'Thermal Heat Index',
      value: heatIndex.toFixed(1),
      unit: '°C',
      status: heatIndex > 35 ? 'warning' : 'success',
      warning: heatIndex > 35 ? 'High extreme temperature corridor' : undefined,
      timestamp
    };
  }

  public onSettingsChanged(settings: any): void {
    // React to ambient changes if event-driven or interval-driven
  }

  public dispose(): void {
    this.onDisable();
    // Dispose geometries & materials
    // Unsubscribe event listeners
  }

  public getResults(): Record<string, AnalysisResult> {
    return this.results;
  }

  private calculateHeatIndex(): number {
    // Mock or real math calculation
    return 27.5;
  }
}
```
