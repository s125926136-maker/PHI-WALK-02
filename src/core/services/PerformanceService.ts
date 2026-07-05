/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PerformanceProfiler, PerformanceSnapshot, SubsystemMetric } from '../PerformanceProfiler';

export interface IPerformanceService {
  begin(name: string): void;
  end(name: string): void;
  getMetric(name: string): SubsystemMetric | undefined;
  getAllMetrics(): Record<string, SubsystemMetric>;
  getSnapshot(): PerformanceSnapshot;
  reset(): void;
  enable(): void;
  disable(): void;
  isEnabled(): boolean;
}

export class PerformanceService implements IPerformanceService {
  public begin(name: string): void {
    PerformanceProfiler.begin(name);
  }

  public end(name: string): void {
    PerformanceProfiler.end(name);
  }

  public getMetric(name: string): SubsystemMetric | undefined {
    return PerformanceProfiler.getMetric(name);
  }

  public getAllMetrics(): Record<string, SubsystemMetric> {
    return PerformanceProfiler.getAllMetrics();
  }

  public getSnapshot(): PerformanceSnapshot {
    return PerformanceProfiler.getSnapshot();
  }

  public reset(): void {
    PerformanceProfiler.reset();
  }

  public enable(): void {
    PerformanceProfiler.enable();
  }

  public disable(): void {
    PerformanceProfiler.disable();
  }

  public isEnabled(): boolean {
    return PerformanceProfiler.isEnabled();
  }
}
