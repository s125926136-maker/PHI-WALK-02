/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { AnalysisEngine, EngineMetadata, UpdatePolicy, AnalysisResult, AnalysisContext } from './framework';

/**
 * FPSMonitorEngine is a lightweight, completely decoupled dummy engine
 * designed to test the plug-and-play architecture of the PHI WALK workspace.
 */
export class FPSMonitorEngine implements AnalysisEngine {
  public readonly metadata: EngineMetadata = {
    name: 'fps-monitor-engine',
    version: '1.0.0',
    category: 'other',
    priority: 100, // Low priority
    updatePolicy: UpdatePolicy.Always,
    dependencies: []
  };

  private _isEnabled: boolean = false;
  private results: Record<string, AnalysisResult> = {};
  private lastTime: number = 0;
  private frameCount: number = 0;
  private fpsValue: number = 0;

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  public initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    console.log('[FPSMonitorEngine] Initialized inside the workspace');
  }

  public update(context: AnalysisContext): void {
    if (!this._isEnabled) return;

    this.frameCount++;
    const now = context.timestamp;
    if (this.lastTime === 0) {
      this.lastTime = now;
    }

    const elapsed = now - this.lastTime;
    if (elapsed >= 1000) {
      this.fpsValue = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastTime = now;

      // Update standard analysis results
      this.results['fps-monitor-value'] = {
        name: '引擎心跳 (Engine Tick)',
        value: `${this.fpsValue} FPS`,
        status: this.fpsValue >= 55 ? 'success' : 'warning',
        timestamp: now
      };
    }
  }

  public onEnable(): void {
    this._isEnabled = true;
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.results['fps-monitor-value'] = {
      name: '引擎心跳 (Engine Tick)',
      value: 'Measuring...',
      status: 'success',
      timestamp: performance.now()
    };
    console.log('[FPSMonitorEngine] Enabled and running');
  }

  public onDisable(): void {
    this._isEnabled = false;
    this.results = {};
    console.log('[FPSMonitorEngine] Disabled');
  }

  public onSettingsChanged(settings: any): void {
    // No-op
  }

  public dispose(): void {
    this.onDisable();
    console.log('[FPSMonitorEngine] Disposed');
  }

  public getResults(): Record<string, AnalysisResult> {
    return this.results;
  }
}
