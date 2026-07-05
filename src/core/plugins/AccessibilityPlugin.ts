/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { IPlugin } from './IPlugin';
import { PluginContext } from './PluginContext';

export class AccessibilityPlugin implements IPlugin {
  public readonly id = 'accessibility-plugin';
  public readonly name = 'AccessibilityPlugin';
  public readonly version = '1.0.0';
  public readonly priority = 45; // Execute right after core analysis engines

  public initialize(context: PluginContext): void {}

  public update(dt: number, context: PluginContext): void {
    const engineCtx = context.engineContext;
    if (engineCtx.scene.accessibilityGroup) {
      if (engineCtx.analysis.settings.showAccessibilityAnalysis) {
        engineCtx.scene.accessibilityGroup.visible = true;
        engineCtx.scene.accessibilityGroup.children.forEach((child) => {
          child.position.set(engineCtx.physics.playerPos.x, child.position.y, engineCtx.physics.playerPos.z);
        });

        const walkwayWidth = engineCtx.analysis.walkwayWidth;
        const closestWallDist = engineCtx.analysis.closestWallDist;

        const isNarrow = (walkwayWidth !== null && walkwayWidth < 0.9) || 
                          (closestWallDist !== null && closestWallDist < 0.45);
        engineCtx.scene.accessibilityGroup.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.color.setHex(isNarrow ? 0xef4444 : 0x06b6d4);
          }
        });
      } else {
        engineCtx.scene.accessibilityGroup.visible = false;
      }
    }
  }

  public dispose(): void {}
}
