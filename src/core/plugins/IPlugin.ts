/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PluginContext } from './PluginContext';

export interface IPlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly priority?: number;

  initialize(context: PluginContext): void | Promise<void>;
  update(dt: number, context: PluginContext): void;
  dispose(): void;
}
