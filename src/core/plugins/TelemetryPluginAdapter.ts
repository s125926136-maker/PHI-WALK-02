/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IPlugin } from './IPlugin';
import { PluginContext } from './PluginContext';
import { TelemetryModule } from '../modules/TelemetryModule';

export class TelemetryPluginAdapter implements IPlugin {
  public readonly id = 'telemetry-plugin';
  public readonly name = 'TelemetryPlugin';
  public readonly version = '1.0.0';
  public readonly priority = 100;
  private module: TelemetryModule;

  constructor() {
    this.module = new TelemetryModule();
  }

  public initialize(context: PluginContext): void {
    this.module.initialize(context.engineContext);
  }

  public update(dt: number, context: PluginContext): void {
    this.module.update(dt, context.engineContext);
  }

  public dispose(): void {
    this.module.dispose();
  }
}
