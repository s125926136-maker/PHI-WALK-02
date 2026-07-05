/**
 * Performance Profiler
 * Built-in profiling system for the engine that measures execution time of major subsystems.
 * Design is strictly zero-allocation during profiling to prevent garbage collection overhead.
 */

export interface SubsystemMetric {
  name: string;
  totalTime: number;       // Accumulated total time in ms
  callCount: number;       // Number of times called
  lastFrameTime: number;   // Last execution time in ms
  maxTime: number;         // Maximum execution time in ms
  averageTime: number;     // Average execution time in ms
  startTime: number;       // Temporary start time for current call
}

export interface PerformanceSnapshot {
  FPS: number;
  frameTime: number;
  physicsTime: number;
  collisionTime: number;
  cameraTime: number;
  measurementTime: number;
  solarTime: number;
  windTime: number;
  telemetryTime: number;
  renderTime: number;

  // PascalCase versions for compatibility
  FrameTime?: number;
  PhysicsTime?: number;
  CollisionTime?: number;
  CameraTime?: number;
  MeasurementTime?: number;
  SolarTime?: number;
  WindTime?: number;
  TelemetryTime?: number;
  RenderTime?: number;
}

export type SubsystemName =
  | 'SimulationLoop'
  | 'Character'
  | 'Physics'
  | 'Collision'
  | 'Camera'
  | 'Measurement'
  | 'Solar'
  | 'Wind'
  | 'Telemetry'
  | 'Render';

export class PerformanceProfiler {
  private static enabled = true;
  private static metrics: Record<string, SubsystemMetric> = {};

  // Pre-allocated snapshot to ensure zero-allocation queries
  private static readonly snapshot: PerformanceSnapshot = {
    FPS: 0,
    frameTime: 0,
    physicsTime: 0,
    collisionTime: 0,
    cameraTime: 0,
    measurementTime: 0,
    solarTime: 0,
    windTime: 0,
    telemetryTime: 0,
    renderTime: 0,

    FrameTime: 0,
    PhysicsTime: 0,
    CollisionTime: 0,
    CameraTime: 0,
    MeasurementTime: 0,
    SolarTime: 0,
    WindTime: 0,
    TelemetryTime: 0,
    RenderTime: 0,
  };

  // FPS tracking state
  private static lastFpsTime = 0;
  private static fpsFrames = 0;
  private static currentFps = 0;

  // Subsystem stack to determine active subsystem for raycaster/resource attribution
  private static readonly activeSubsystemStack: string[] = [];

  public static getActiveSubsystem(): string | null {
    const len = PerformanceProfiler.activeSubsystemStack.length;
    return len > 0 ? PerformanceProfiler.activeSubsystemStack[len - 1] : null;
  }

  // Pre-initialize all expected subsystem metrics to prevent runtime lazy initialization allocations
  private static readonly EXPECTED_SUBSYSTEMS: SubsystemName[] = [
    'SimulationLoop',
    'Character',
    'Physics',
    'Collision',
    'Camera',
    'Measurement',
    'Solar',
    'Wind',
    'Telemetry',
    'Render'
  ];

  static {
    for (const name of PerformanceProfiler.EXPECTED_SUBSYSTEMS) {
      PerformanceProfiler.metrics[name] = {
        name,
        totalTime: 0,
        callCount: 0,
        lastFrameTime: 0,
        maxTime: 0,
        averageTime: 0,
        startTime: 0
      };
    }
  }

  /**
   * Enable the profiler
   */
  public static enable(): void {
    PerformanceProfiler.enabled = true;
  }

  /**
   * Disable the profiler
   */
  public static disable(): void {
    PerformanceProfiler.enabled = false;
  }

  /**
   * Check if the profiler is enabled
   */
  public static isEnabled(): boolean {
    return PerformanceProfiler.enabled;
  }

  /**
   * Reset all profiling metrics
   */
  public static reset(): void {
    for (const key in PerformanceProfiler.metrics) {
      if (Object.prototype.hasOwnProperty.call(PerformanceProfiler.metrics, key)) {
        const metric = PerformanceProfiler.metrics[key];
        metric.totalTime = 0;
        metric.callCount = 0;
        metric.lastFrameTime = 0;
        metric.maxTime = 0;
        metric.averageTime = 0;
        metric.startTime = 0;
      }
    }
    PerformanceProfiler.lastFpsTime = 0;
    PerformanceProfiler.fpsFrames = 0;
    PerformanceProfiler.currentFps = 0;
  }

  /**
   * Begin measuring a subsystem's execution time
   */
  public static begin(name: string): void {
    if (!PerformanceProfiler.enabled) return;

    // Track active subsystem
    PerformanceProfiler.activeSubsystemStack.push(name);

    let metric = PerformanceProfiler.metrics[name];
    if (!metric) {
      // Allocate only once if a dynamic/unregistered subsystem is used
      metric = {
        name,
        totalTime: 0,
        callCount: 0,
        lastFrameTime: 0,
        maxTime: 0,
        averageTime: 0,
        startTime: 0
      };
      PerformanceProfiler.metrics[name] = metric;
    }

    metric.startTime = performance.now();

    // If starting SimulationLoop, track frames for FPS calculation
    if (name === 'SimulationLoop') {
      PerformanceProfiler.fpsFrames++;
      const now = metric.startTime;
      if (PerformanceProfiler.lastFpsTime === 0) {
        PerformanceProfiler.lastFpsTime = now;
      } else if (now >= PerformanceProfiler.lastFpsTime + 1000) {
        PerformanceProfiler.currentFps = Math.round(
          (PerformanceProfiler.fpsFrames * 1000) / (now - PerformanceProfiler.lastFpsTime)
        );
        PerformanceProfiler.fpsFrames = 0;
        PerformanceProfiler.lastFpsTime = now;
      }
    }
  }

  /**
   * End measuring a subsystem's execution time
   */
  public static end(name: string): void {
    if (!PerformanceProfiler.enabled) return;

    // Remove from active subsystem stack
    const index = PerformanceProfiler.activeSubsystemStack.lastIndexOf(name);
    if (index !== -1) {
      PerformanceProfiler.activeSubsystemStack.splice(index, 1);
    }

    const metric = PerformanceProfiler.metrics[name];
    if (!metric || metric.startTime === 0) return;

    const duration = performance.now() - metric.startTime;
    metric.lastFrameTime = duration;
    metric.totalTime += duration;
    metric.callCount++;
    metric.averageTime = metric.totalTime / metric.callCount;
    if (duration > metric.maxTime) {
      metric.maxTime = duration;
    }
    metric.startTime = 0;
  }

  /**
   * Retrieve a specific subsystem's metric
   */
  public static getMetric(name: string): SubsystemMetric | undefined {
    return PerformanceProfiler.metrics[name];
  }

  /**
   * Retrieve all subsystem metrics
   */
  public static getAllMetrics(): Record<string, SubsystemMetric> {
    return PerformanceProfiler.metrics;
  }

  /**
   * Returns a zero-allocation update of the overlay snapshot structure
   */
  public static getSnapshot(): PerformanceSnapshot {
    const s = PerformanceProfiler.snapshot;
    s.FPS = PerformanceProfiler.currentFps || 60; // fallback to 60 if not ticked yet
    
    // Subsystems
    s.frameTime = PerformanceProfiler.metrics['SimulationLoop']?.lastFrameTime || 0;
    s.physicsTime = PerformanceProfiler.metrics['Physics']?.lastFrameTime || 0;
    s.collisionTime = PerformanceProfiler.metrics['Collision']?.lastFrameTime || 0;
    s.cameraTime = PerformanceProfiler.metrics['Camera']?.lastFrameTime || 0;
    s.measurementTime = PerformanceProfiler.metrics['Measurement']?.lastFrameTime || 0;
    s.solarTime = PerformanceProfiler.metrics['Solar']?.lastFrameTime || 0;
    s.windTime = PerformanceProfiler.metrics['Wind']?.lastFrameTime || 0;
    s.telemetryTime = PerformanceProfiler.metrics['Telemetry']?.lastFrameTime || 0;
    s.renderTime = PerformanceProfiler.metrics['Render']?.lastFrameTime || 0;

    // PascalCase compatibility mapping
    s.FrameTime = s.frameTime;
    s.PhysicsTime = s.physicsTime;
    s.CollisionTime = s.collisionTime;
    s.CameraTime = s.cameraTime;
    s.MeasurementTime = s.measurementTime;
    s.SolarTime = s.solarTime;
    s.WindTime = s.windTime;
    s.TelemetryTime = s.telemetryTime;
    s.RenderTime = s.renderTime;

    return s;
  }
}
