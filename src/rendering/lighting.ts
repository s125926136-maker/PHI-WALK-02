/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

/**
 * Calculates sky colors dynamically depending on solar altitude for building illumination studies
 * White: Light blue
 * Sunset: Orange
 * Twilight: Deep blue
 * Night: Near black
 */
export function getSkyColor(altitude: number): THREE.Color {
  const color = new THREE.Color();
  if (altitude >= 0.15) {
    if (altitude < 0.4) {
      const t = (altitude - 0.15) / (0.4 - 0.15);
      color.lerpColors(new THREE.Color(0xfbad40), new THREE.Color(0xb4d2ff), t); // Sunset Orange -> Sky Blue
    } else {
      color.setHex(0xb4d2ff); // Clean Light Blue
    }
  } else if (altitude >= 0.0) {
    const t = altitude / 0.15;
    color.lerpColors(new THREE.Color(0x1a2a6c), new THREE.Color(0xfbad40), t); // Twilight Blue -> Sunset Orange
  } else if (altitude > -0.15) {
    const t = (altitude + 0.15) / 0.15;
    color.lerpColors(new THREE.Color(0x030712), new THREE.Color(0x1a2a6c), t); // Near Black -> Twilight Blue
  } else {
    color.setHex(0x030712); // Near Black Night
  }
  return color;
}
