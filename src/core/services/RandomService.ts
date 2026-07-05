/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface IRandomService {
  random(): number;
  range(min: number, max: number): number;
  intRange(min: number, max: number): number;
}

export class RandomService implements IRandomService {
  public random(): number {
    return Math.random();
  }

  public range(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  public intRange(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
  }
}
