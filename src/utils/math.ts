/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ModelUnit } from '../types';

export const UNIT_FACTORS: Record<ModelUnit, number> = {
  m: 1.0,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  inch: 0.0254,
};

export function formatDistance(meters: number, unit: ModelUnit): string {
  const factor = UNIT_FACTORS[unit] || 1.0;
  const value = meters / factor;
  return `${value.toFixed(2)} ${unit}`;
}

export function lerpAngle(current: number, target: number, step: number): number {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * step;
}
