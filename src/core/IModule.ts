/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EngineContext } from './EngineContext';

/**
 * Minimal interface defining a unified engine module.
 * This establishes the foundation for future engine integration and orchestration.
 */
export interface IModule {
  readonly name: string;
  readonly priority: number;

  initialize?(context: EngineContext): void | Promise<void>;
  update(dt: number, context?: EngineContext): void;
  dispose?(): void;
}
