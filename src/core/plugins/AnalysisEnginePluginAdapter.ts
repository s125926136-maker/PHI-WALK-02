/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPlugin } from './IPlugin';
import { PluginContext } from './PluginContext';
import { AnalysisEngine, AnalysisContext } from '../../analysis/framework';

export class AnalysisEnginePluginAdapter implements IPlugin {
  public readonly id: string;
  public readonly name: string;
  public readonly version: string;
  public readonly priority: number;
  private engine: AnalysisEngine;

  constructor(engine: AnalysisEngine) {
    this.engine = engine;
    this.id = engine.metadata.name;
    this.name = engine.metadata.name;
    this.version = engine.metadata.version;
    this.priority = engine.metadata.priority;
  }

  public initialize(context: PluginContext): void {
    this.engine.initialize(context.scene, context.camera, context.renderer);
    this.engine.onEnable();
  }

  public update(dt: number, context: PluginContext): void {
    if (!this.engine.isEnabled) return;

    const analysisContext: AnalysisContext = {
      scene: context.scene,
      camera: context.camera,
      renderer: context.renderer,
      player: context.player,
      colliders: context.colliders,
      settings: context.settings,
      deltaTime: dt,
      timestamp: context.services.time.now(),
      analysisSettings: context.analysisSettings,
    };

    this.engine.update(analysisContext);
  }

  public dispose(): void {
    this.engine.onDisable();
    this.engine.dispose();
  }
}
