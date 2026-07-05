/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type EventCallback = (...args: any[]) => void;

class EventBus {
  private listeners: Record<string, Set<EventCallback>> = {};

  on(event: string, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set();
    }
    this.listeners[event].add(callback);
    return () => this.off(event, callback);
  }

  off(event: string, callback: EventCallback) {
    if (this.listeners[event]) {
      this.listeners[event].delete(callback);
    }
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(...args);
        } catch (e) {
          console.error(`Error in event listener for ${event}:`, e);
        }
      });
    }
  }
}

export const eventBus = new EventBus();
