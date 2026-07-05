/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IModule } from '../IModule';
import { EngineContext } from '../EngineContext';
import { computeSolarPosition } from '../../utils/solarCalculator';
import { TelemetryData } from '../../types';

export class TelemetryModule implements IModule {
  readonly name = 'TelemetryModule';
  readonly priority = 100;

  private context: EngineContext | null = null;

  /**
   * Initializes the TelemetryModule with the unified EngineContext.
   */
  public initialize(context: EngineContext): void {
    this.context = context;
  }

  /**
   * Primary update step for the TelemetryModule.
   * Consumes EngineContext to retrieve state and dispatch telemetry.
   */
  public update(dt: number, context?: EngineContext): void {
    const activeContext = context || this.context;
    if (!activeContext) return;

    const normCeil = activeContext.analysis.calculatedCeilingHeight !== null ? activeContext.analysis.calculatedCeilingHeight : 2.5;
    const normWidth = activeContext.analysis.walkwayWidth !== null ? activeContext.analysis.walkwayWidth : 1.8;

    const heightPenalty = Math.max(0, Math.min(100, (2.6 - normCeil) * 55));
    const widthPenalty = Math.max(0, Math.min(100, (1.4 - normWidth) * 65));

    let oppressionIndex = heightPenalty * 0.45 + widthPenalty * 0.55;
    oppressionIndex = Math.max(0, Math.min(100, oppressionIndex));

    if (activeContext.analysis.settings.presetId === 'wheelchair') {
      oppressionIndex += 10;
    } else if (activeContext.analysis.settings.presetId === 'child') {
      oppressionIndex -= 12;
    }
    oppressionIndex = Math.max(3, Math.min(97, oppressionIndex));

    let level: TelemetryData['oppressionLevel'] = 'comfortable';
    if (oppressionIndex < 28) level = 'spacious';
    else if (oppressionIndex < 55) level = 'comfortable';
    else if (oppressionIndex < 78) level = 'cozy';
    else level = 'oppressive';

    const avatarYawDeg = (activeContext.physics.avatarYaw.current * 180 / Math.PI) % 360;
    let headingDeg = (180 - avatarYawDeg) % 360;
    if (headingDeg < 0) headingDeg += 360;
    activeContext.analysis.setPlayerHeading(Math.round(headingDeg));

    const roundedPitch = Math.round((activeContext.physics.cameraPitch.current * 180) / Math.PI);
    activeContext.analysis.setPlayerPitch(roundedPitch);

    try {
      const [year, month, day] = activeContext.analysis.settings.analysisDate.split('-').map(Number);
      const [hour, minute] = activeContext.analysis.settings.analysisTime.split(':').map(Number);
      const targetDate = new Date(Date.UTC(year, month - 1, day, hour - activeContext.analysis.settings.timezone, minute));
      const solar = computeSolarPosition(targetDate, activeContext.analysis.settings.latitude, activeContext.analysis.settings.longitude, activeContext.analysis.settings.timezone);
      const sunAzDeg = (solar.azimuth * 180 / Math.PI) % 360;
      activeContext.analysis.setSunAzimuthDeg(Math.round(sunAzDeg));
    } catch (err) {
      // Fallback silently
    }

    if (activeContext.analysis.shouldDispatchTelemetry) {
      setTimeout(() => {
        activeContext.analysis.onTelemetryUpdate({
          eyeHeight: activeContext.physics.currentEyeHeight.current,
          eyeLevelAboveGround: activeContext.analysis.eyeLevelAboveGround,
          ceilingHeight: activeContext.analysis.calculatedCeilingHeight,
          walkwayWidth: activeContext.analysis.walkwayWidth,
          nearestWall: activeContext.analysis.closestWallDist,
          nearestFurniture: null,
          currentRoom: activeContext.analysis.activeRoomName,
          oppressionIndex: oppressionIndex,
          oppressionLevel: level,
          isSafeForWheelchair: (activeContext.analysis.walkwayWidth !== null ? activeContext.analysis.walkwayWidth >= 0.90 : true),
          fps: activeContext.render.currentFps,
          consolidatedResults: activeContext.analysis.consolidatedResults,
        });
      }, 0);
    }
  }

  public dispose(): void {
    this.context = null;
  }
}
