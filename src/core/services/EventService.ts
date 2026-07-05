/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { eventBus } from '../EventSystem';

export interface IEventService {
  on(event: string, callback: (...args: any[]) => void): () => void;
  off(event: string, callback: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export class EventService implements IEventService {
  public on(event: string, callback: (...args: any[]) => void): () => void {
    return eventBus.on(event, callback);
  }

  public off(event: string, callback: (...args: any[]) => void): void {
    eventBus.off(event, callback);
  }

  public emit(event: string, ...args: any[]): void {
    eventBus.emit(event, ...args);
  }
}
