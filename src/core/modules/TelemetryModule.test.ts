/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TelemetryModule } from './TelemetryModule';
import { EngineContext } from '../EngineContext';

describe('TelemetryModule Unit Tests', () => {
  let telemetryModule: TelemetryModule;
  let mockEngineContext: any;

  beforeEach(() => {
    telemetryModule = new TelemetryModule();

    // Create a mock EngineContext aligned with the segmented structure
    mockEngineContext = {
      scene: {},
      physics: {
        avatarYaw: { current: 0 },
        cameraPitch: { current: 0.1 },
        currentEyeHeight: { current: 1.65 },
      },
      input: {},
      analysis: {
        settings: {
          presetId: 'standing',
          analysisDate: '2026-07-04',
          analysisTime: '12:00',
          latitude: 25.0330,
          longitude: 121.5654,
          timezone: 8,
          modelNorth: 0,
        },
        calculatedCeilingHeight: 3.0,
        walkwayWidth: 1.5,
        closestWallDist: 1.2,
        eyeLevelAboveGround: 1.65,
        activeRoomName: 'Room A',
        consolidatedResults: {},
        shouldDispatchTelemetry: true,
        setPlayerHeading: vi.fn(),
        setPlayerPitch: vi.fn(),
        setSunAzimuthDeg: vi.fn(),
        onTelemetryUpdate: vi.fn(),
      },
      render: {
        currentFps: 60,
      }
    };

    vi.useFakeTimers();
  });

  it('should initialize and hold correct name and default priority', () => {
    expect(telemetryModule.name).toBe('TelemetryModule');
    expect(telemetryModule.priority).toBe(100);
  });

  it('should process, calculate oppression index, and set player states correctly', () => {
    telemetryModule.initialize(mockEngineContext as unknown as EngineContext);
    telemetryModule.update(0.1);

    // Test player states calculation
    expect(mockEngineContext.analysis.setPlayerHeading).toHaveBeenCalled();
    expect(mockEngineContext.analysis.setPlayerPitch).toHaveBeenCalled();
    expect(mockEngineContext.analysis.setSunAzimuthDeg).toHaveBeenCalled();

    // Fast-forward setTimeouts
    vi.runAllTimers();

    // Expect telemetry update to be published
    expect(mockEngineContext.analysis.onTelemetryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        eyeHeight: 1.65,
        ceilingHeight: 3.0,
        walkwayWidth: 1.5,
        nearestWall: 1.2,
        currentRoom: 'Room A',
        fps: 60,
      })
    );
  });

  it('should adjust oppression index based on wheelchair preset', () => {
    mockEngineContext.analysis.settings.presetId = 'wheelchair';
    telemetryModule.initialize(mockEngineContext as unknown as EngineContext);
    telemetryModule.update(0.1);

    vi.runAllTimers();

    expect(mockEngineContext.analysis.onTelemetryUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        oppressionIndex: expect.any(Number),
      })
    );
  });

  it('should respect shouldDispatchTelemetry flag', () => {
    mockEngineContext.analysis.shouldDispatchTelemetry = false;
    telemetryModule.initialize(mockEngineContext as unknown as EngineContext);
    telemetryModule.update(0.1);

    vi.runAllTimers();

    expect(mockEngineContext.analysis.onTelemetryUpdate).not.toHaveBeenCalled();
  });

  it('should clean up references on dispose', () => {
    telemetryModule.initialize(mockEngineContext as unknown as EngineContext);
    telemetryModule.dispose();

    // Update should do nothing after dispose
    telemetryModule.update(0.1);
    vi.runAllTimers();
    expect(mockEngineContext.analysis.onTelemetryUpdate).not.toHaveBeenCalled();
  });
});
