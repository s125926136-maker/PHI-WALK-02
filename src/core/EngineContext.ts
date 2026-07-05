/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlayerSettings, TelemetryData } from '../types';
import { IEngineServices } from './EngineServices';

export interface CharacterInputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  shift: boolean;
}

export interface CharacterPhysicsConfig {
  gravityEnabled: boolean;
  collisionEnabled: boolean;
  eyeHeight: number;
  bodyWidth: number;
  moveSpeed: number;
  jumpPower: number;
  posture: 'standing' | 'sitting' | 'crouching';
}

export interface SceneContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  cachedCollidableMeshes: { current: THREE.Object3D[] };
  currentModelGroup: THREE.Object3D | null;
  avatarGroup: THREE.Group | null;
  clearanceCylinder: THREE.Mesh | null;
  reachSphere: THREE.Mesh | null;
  fpArmGroup: THREE.Group | null;
  dynReachGroup: THREE.Group | null;
  sunGroup: THREE.Group | null;
  dirLight: THREE.DirectionalLight | null;
  ambientLight: THREE.AmbientLight | null;
  hemiLight: THREE.HemisphereLight | null;
  windGroup: THREE.Group | null;
  accessibilityGroup: THREE.Group | null;
  turningCircle: THREE.Mesh | null;
}

export interface PhysicsContext {
  characterController: any;
  cameraController: any;
  deltaTime: number;
  playerPos: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  cameraYaw: { current: number };
  cameraPitch: { current: number };
  avatarYaw: { current: number };
  currentEyeHeight: { current: number };
}

export interface InputContext {
  inputManager: any;
  activeKeys: Record<string, boolean>;
  isLocked: boolean;
  isTabCursorMode: boolean;
  showCharacterModal: boolean;
  showSetupConfirm: boolean;
  currentSpace: string;
}

export interface AnalysisContext {
  settings: PlayerSettings;
  analysisEyeLevelEnabled: boolean;
  analysisCeilingHeightEnabled: boolean;
  analysisWalkwayWidthEnabled: boolean;
  analysisWallDistanceEnabled: boolean;
  analysisEyeRayEnabled: boolean;
  analysisDimensionLabelsEnabled: boolean;
  analysisMeasureArrowEnabled: boolean;
  playerDirectionArrowEnabled: boolean;
  playerEnvelopeEnabled: boolean;
  sceneSunEnabled: boolean;
  sceneSunPathEnabled: boolean;
  sceneSkyEnabled: boolean;
  windSpeed: number;
  windAngle: number;
  isTimePlaying: boolean;
  timeSpeed: string;

  // Telemetry status & metrics
  shouldRunRaycasts: boolean;
  shouldUpdateSubTabs: boolean;
  shouldDispatchTelemetry: boolean;
  speedScale: number;
  walkwayWidth: number | null;
  closestWallDist: number | null;
  closestWallPoint: THREE.Vector3 | null;
  calculatedCeilingHeight: number | null;
  eyeLevelAboveGround: number;
  activeRoomName: string;
  consolidatedResults: any;

  // Callbacks & metrics setters
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  onTelemetryUpdate: (data: TelemetryData) => void;
  setPlayerHeading: (val: number) => void;
  setPlayerPitch: (val: number) => void;
  setSunAzimuthDeg: (val: number) => void;
  metricsCache: { current: any };
}

export interface RenderContext {
  frameCount: number;
  currentFps: number;
  performanceProfiler: {
    begin(name: string): void;
    end(name: string): void;
  };
}

/**
 * The unified execution and state context shared across all engine modules.
 * Segregated into smaller, highly focused domain contexts.
 */
export interface EngineContext {
  scene: SceneContext;
  physics: PhysicsContext;
  input: InputContext;
  analysis: AnalysisContext;
  render: RenderContext;
  services: IEngineServices;
}
