/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ITimeService {
  now(): number;
  epoch(): number;
}

export class TimeService implements ITimeService {
  public now(): number {
    return performance.now();
  }

  public epoch(): number {
    return Date.now();
  }
}
