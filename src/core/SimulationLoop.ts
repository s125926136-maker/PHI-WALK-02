/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { PlayerSettings, TelemetryData } from '../types';
import { computeSolarPosition } from '../utils/solarCalculator';
import { EngineRegistry, AnalysisContext } from '../analysis/framework';
import { EngineContext, CharacterInputState, CharacterPhysicsConfig } from './EngineContext';
import { moduleRegistry } from './ModuleRegistry';
import { engineServices } from './EngineServices';
import { pluginRegistry } from './plugins/PluginRegistry';
import { PluginContext } from './plugins/PluginContext';

const _tempV1 = new THREE.Vector3();
const _tempV2 = new THREE.Vector3();
const _tempV3 = new THREE.Vector3();

export function lerpAngle(current: number, target: number, step: number): number {
  let diff = target - current;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return current + diff * step;
}

export function getSkyColor(altitude: number): THREE.Color {
  const color = new THREE.Color();
  if (altitude >= 0.15) {
    if (altitude < 0.4) {
      const t = (altitude - 0.15) / (0.4 - 0.15);
      color.lerpColors(new THREE.Color(0xfbad40), new THREE.Color(0xb4d2ff), t);
    } else {
      color.setHex(0xb4d2ff);
    }
  } else if (altitude >= 0.0) {
    const t = altitude / 0.15;
    color.lerpColors(new THREE.Color(0x1a2a6c), new THREE.Color(0xfbad40), t);
  } else if (altitude > -0.15) {
    const t = (altitude + 0.15) / 0.15;
    color.lerpColors(new THREE.Color(0x030712), new THREE.Color(0x1a2a6c), t);
  } else {
    color.setHex(0x030712);
  }
  return color;
}

export interface SimulationContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  settings: PlayerSettings;
  activeKeys: Record<string, boolean>;
  isLocked: boolean;
  isTabCursorMode: boolean;
  showCharacterModal: boolean;
  showSetupConfirm: boolean;
  currentSpace: string;
  
  // Refs (mutable objects/values)
  playerPos: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  cameraYaw: { current: number };
  cameraPitch: { current: number };
  avatarYaw: { current: number };
  currentEyeHeight: { current: number };
  
  // Controllers
  characterController: any;
  cameraController: any;
  inputManager: any;
  
  // Cache and groups
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
  
  // Analysis settings and inputs
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
  
  // Callbacks & metrics
  onSettingsChange: (settings: Partial<PlayerSettings>) => void;
  onTelemetryUpdate: (data: TelemetryData) => void;
  setPlayerHeading: (val: number) => void;
  setPlayerPitch: (val: number) => void;
  setSunAzimuthDeg: (val: number) => void;
  metricsCache: { current: any };
  performanceProfiler: any;
}

export class SimulationLoop {
  public frameCount = 0;
  public lastTime = engineServices.time.now();
  private fpsFrames = 0;
  private fpsLastTime = engineServices.time.now();
  public currentFps = 60;
  private timeAccumulator = 0;
  private reachAnimTimer = -1;
  private dynReachFadeTimer = -1;
  private lastSolarParams: any = {};
  private shadowLogCounter = 0;
  private shadowSpamTimer = 0;
  private debugLogFrameCounter = 0;

  // Schedulers triggers inside step
  public shouldRunRaycasts = false;
  public shouldUpdateSubTabs = false;
  public shouldDispatchTelemetry = false;
  public speedScale = 1.0;
  public walkwayWidth: number | null = null;
  public closestWallDist: number | null = null;
  public closestWallPoint: THREE.Vector3 | null = null;
  public calculatedCeilingHeight: number | null = null;
  public eyeLevelAboveGround = 1.65;
  public activeRoomName = '';
  public consolidatedResults: any = {};

  public engineContext!: EngineContext;

  private initEngineContext(ctx: SimulationContext, profiler: any): void {
    this.engineContext = {
      scene: {
        scene: ctx.scene,
        camera: ctx.camera,
        renderer: ctx.renderer,
        cachedCollidableMeshes: ctx.cachedCollidableMeshes,
        currentModelGroup: ctx.currentModelGroup,
        avatarGroup: ctx.avatarGroup,
        clearanceCylinder: ctx.clearanceCylinder,
        reachSphere: ctx.reachSphere,
        fpArmGroup: ctx.fpArmGroup,
        dynReachGroup: ctx.dynReachGroup,
        sunGroup: ctx.sunGroup,
        dirLight: ctx.dirLight,
        ambientLight: ctx.ambientLight,
        hemiLight: ctx.hemiLight,
        windGroup: ctx.windGroup,
        accessibilityGroup: ctx.accessibilityGroup,
        turningCircle: ctx.turningCircle,
      },
      physics: {
        characterController: ctx.characterController,
        cameraController: ctx.cameraController,
        deltaTime: 0,
        playerPos: ctx.playerPos,
        playerVelocity: ctx.playerVelocity,
        cameraYaw: ctx.cameraYaw,
        cameraPitch: ctx.cameraPitch,
        avatarYaw: ctx.avatarYaw,
        currentEyeHeight: ctx.currentEyeHeight,
      },
      input: {
        inputManager: ctx.inputManager,
        activeKeys: ctx.activeKeys,
        isLocked: ctx.isLocked,
        isTabCursorMode: ctx.isTabCursorMode,
        showCharacterModal: ctx.showCharacterModal,
        showSetupConfirm: ctx.showSetupConfirm,
        currentSpace: ctx.currentSpace,
      },
      analysis: {
        settings: ctx.settings,
        analysisEyeLevelEnabled: ctx.analysisEyeLevelEnabled,
        analysisCeilingHeightEnabled: ctx.analysisCeilingHeightEnabled,
        analysisWalkwayWidthEnabled: ctx.analysisWalkwayWidthEnabled,
        analysisWallDistanceEnabled: ctx.analysisWallDistanceEnabled,
        analysisEyeRayEnabled: ctx.analysisEyeRayEnabled,
        analysisDimensionLabelsEnabled: ctx.analysisDimensionLabelsEnabled,
        analysisMeasureArrowEnabled: ctx.analysisMeasureArrowEnabled,
        playerDirectionArrowEnabled: ctx.playerDirectionArrowEnabled,
        playerEnvelopeEnabled: ctx.playerEnvelopeEnabled,
        sceneSunEnabled: ctx.sceneSunEnabled,
        sceneSunPathEnabled: ctx.sceneSunPathEnabled,
        sceneSkyEnabled: ctx.sceneSkyEnabled,
        windSpeed: ctx.windSpeed,
        windAngle: ctx.windAngle,
        isTimePlaying: ctx.isTimePlaying,
        timeSpeed: ctx.timeSpeed,

        shouldRunRaycasts: this.shouldRunRaycasts,
        shouldUpdateSubTabs: this.shouldUpdateSubTabs,
        shouldDispatchTelemetry: this.shouldDispatchTelemetry,
        speedScale: this.speedScale,
        walkwayWidth: this.walkwayWidth,
        closestWallDist: this.closestWallDist,
        closestWallPoint: this.closestWallPoint,
        calculatedCeilingHeight: this.calculatedCeilingHeight,
        eyeLevelAboveGround: this.eyeLevelAboveGround,
        activeRoomName: this.activeRoomName,
        consolidatedResults: this.consolidatedResults,

        onSettingsChange: ctx.onSettingsChange,
        onTelemetryUpdate: ctx.onTelemetryUpdate,
        setPlayerHeading: ctx.setPlayerHeading,
        setPlayerPitch: ctx.setPlayerPitch,
        setSunAzimuthDeg: ctx.setSunAzimuthDeg,
        metricsCache: ctx.metricsCache,
      },
      render: {
        frameCount: this.frameCount,
        currentFps: this.currentFps,
        performanceProfiler: profiler,
      },
      services: engineServices,
    };
  }

  private updateEngineContext(dt: number, ctx: SimulationContext): void {
    // update scene context references that can change
    this.engineContext.scene.currentModelGroup = ctx.currentModelGroup;
    this.engineContext.scene.avatarGroup = ctx.avatarGroup;
    this.engineContext.scene.clearanceCylinder = ctx.clearanceCylinder;
    this.engineContext.scene.reachSphere = ctx.reachSphere;
    this.engineContext.scene.fpArmGroup = ctx.fpArmGroup;
    this.engineContext.scene.dynReachGroup = ctx.dynReachGroup;
    this.engineContext.scene.sunGroup = ctx.sunGroup;
    this.engineContext.scene.dirLight = ctx.dirLight;
    this.engineContext.scene.ambientLight = ctx.ambientLight;
    this.engineContext.scene.hemiLight = ctx.hemiLight;
    this.engineContext.scene.windGroup = ctx.windGroup;
    this.engineContext.scene.accessibilityGroup = ctx.accessibilityGroup;
    this.engineContext.scene.turningCircle = ctx.turningCircle;

    // update physics
    this.engineContext.physics.deltaTime = dt;

    // update input
    this.engineContext.input.activeKeys = ctx.activeKeys;
    this.engineContext.input.isLocked = ctx.isLocked;
    this.engineContext.input.isTabCursorMode = ctx.isTabCursorMode;
    this.engineContext.input.showCharacterModal = ctx.showCharacterModal;
    this.engineContext.input.showSetupConfirm = ctx.showSetupConfirm;
    this.engineContext.input.currentSpace = ctx.currentSpace;

    // update analysis
    this.engineContext.analysis.settings = ctx.settings;
    this.engineContext.analysis.analysisEyeLevelEnabled = ctx.analysisEyeLevelEnabled;
    this.engineContext.analysis.analysisCeilingHeightEnabled = ctx.analysisCeilingHeightEnabled;
    this.engineContext.analysis.analysisWalkwayWidthEnabled = ctx.analysisWalkwayWidthEnabled;
    this.engineContext.analysis.analysisWallDistanceEnabled = ctx.analysisWallDistanceEnabled;
    this.engineContext.analysis.analysisEyeRayEnabled = ctx.analysisEyeRayEnabled;
    this.engineContext.analysis.analysisDimensionLabelsEnabled = ctx.analysisDimensionLabelsEnabled;
    this.engineContext.analysis.analysisMeasureArrowEnabled = ctx.analysisMeasureArrowEnabled;
    this.engineContext.analysis.playerDirectionArrowEnabled = ctx.playerDirectionArrowEnabled;
    this.engineContext.analysis.playerEnvelopeEnabled = ctx.playerEnvelopeEnabled;
    this.engineContext.analysis.sceneSunEnabled = ctx.sceneSunEnabled;
    this.engineContext.analysis.sceneSunPathEnabled = ctx.sceneSunPathEnabled;
    this.engineContext.analysis.sceneSkyEnabled = ctx.sceneSkyEnabled;
    this.engineContext.analysis.windSpeed = ctx.windSpeed;
    this.engineContext.analysis.windAngle = ctx.windAngle;
    this.engineContext.analysis.isTimePlaying = ctx.isTimePlaying;
    this.engineContext.analysis.timeSpeed = ctx.timeSpeed;

    this.engineContext.analysis.shouldRunRaycasts = this.shouldRunRaycasts;
    this.engineContext.analysis.shouldUpdateSubTabs = this.shouldUpdateSubTabs;
    this.engineContext.analysis.shouldDispatchTelemetry = this.shouldDispatchTelemetry;
    this.engineContext.analysis.speedScale = this.speedScale;
    this.engineContext.analysis.walkwayWidth = this.walkwayWidth;
    this.engineContext.analysis.closestWallDist = this.closestWallDist;
    this.engineContext.analysis.closestWallPoint = this.closestWallPoint;
    this.engineContext.analysis.calculatedCeilingHeight = this.calculatedCeilingHeight;
    this.engineContext.analysis.eyeLevelAboveGround = this.eyeLevelAboveGround;
    this.engineContext.analysis.activeRoomName = this.activeRoomName;
    this.engineContext.analysis.consolidatedResults = this.consolidatedResults;

    // update render
    this.engineContext.render.frameCount = this.frameCount;
    this.engineContext.render.currentFps = this.currentFps;
  }

  constructor() {
    // Clear registry to avoid duplicate registrations across hot-reloads/test instances
    moduleRegistry.clear();

    // Register local/anonymous modules inside ModuleRegistry.
    // This handles simulation steps without migrating them to external files.
    moduleRegistry.register({
      name: '01_SchedulerTimeModule',
      priority: 10,
      update: (dt, context) => {
        this.updateScheduler(dt, context!);
        this.updateTime(dt, context!);
      }
    });

    moduleRegistry.register({
      name: '02_CharacterModule',
      priority: 20,
      update: (dt, context) => {
        context!.render.performanceProfiler.begin('Character');
        this.updateCharacter(dt, context!);
        context!.render.performanceProfiler.end('Character');
      }
    });

    moduleRegistry.register({
      name: '03_PhysicsModule',
      priority: 30,
      update: (dt, context) => {
        context!.render.performanceProfiler.begin('Physics');
        this.updatePhysics(dt, context!);
        context!.render.performanceProfiler.end('Physics');
      }
    });

    moduleRegistry.register({
      name: '04_AnalysisModule',
      priority: 40,
      update: (dt, context) => {
        this.updateAnalysis(dt, context!);
      }
    });

    moduleRegistry.register({
      name: '05_ShadowDiagnosticsModule',
      priority: 50,
      update: (dt, context) => {
        this.updateShadowDiagnostics(dt, context!);
      }
    });

    // TelemetryModule is registered externally (in EngineFactory.ts) with priority 100.

    moduleRegistry.register({
      name: '06_RenderingModule',
      priority: 110,
      update: (dt, context) => {
        context!.render.performanceProfiler.begin('Render');
        this.renderFrame(context!);
        context!.render.performanceProfiler.end('Render');
      }
    });
  }

  private buildPluginContext(dt: number): PluginContext {
    return {
      engineContext: this.engineContext!,
      services: this.engineContext!.services,
      scene: this.engineContext!.scene.scene,
      camera: this.engineContext!.scene.camera,
      renderer: this.engineContext!.scene.renderer,
      player: {
        position: this.engineContext!.physics.playerPos,
        direction: new THREE.Vector3(0, 0, -1).applyQuaternion(this.engineContext!.scene.camera.quaternion).normalize(),
        eyeHeight: this.engineContext!.physics.currentEyeHeight.current,
        yaw: this.engineContext!.physics.avatarYaw.current,
      },
      colliders: this.engineContext!.scene.cachedCollidableMeshes.current,
      settings: this.engineContext!.analysis.settings,
      analysisSettings: {
        shouldRunRaycasts: this.shouldRunRaycasts,
        measure: {
          eyeLevelEnabled: this.engineContext!.analysis.analysisEyeLevelEnabled,
          ceilingHeightEnabled: this.engineContext!.analysis.analysisCeilingHeightEnabled,
          walkwayWidthEnabled: this.engineContext!.analysis.analysisWalkwayWidthEnabled,
          wallDistanceEnabled: this.engineContext!.analysis.analysisWallDistanceEnabled,
          eyeRayEnabled: this.engineContext!.analysis.analysisEyeRayEnabled,
          dimensionLabelsEnabled: this.engineContext!.analysis.analysisDimensionLabelsEnabled,
          measureArrowEnabled: this.engineContext!.analysis.analysisMeasureArrowEnabled,
        },
        solar: {
          date: this.engineContext!.analysis.settings.analysisDate,
          time: this.engineContext!.analysis.settings.analysisTime,
          latitude: this.engineContext!.analysis.settings.latitude,
          longitude: this.engineContext!.analysis.settings.longitude,
          timezone: this.engineContext!.analysis.settings.timezone,
          modelNorth: this.engineContext!.analysis.settings.modelNorth || 0
        },
        wind: {
          speed: this.engineContext!.analysis.windSpeed,
          angle: this.engineContext!.analysis.windAngle
        }
      }
    };
  }

  /**
   * Main update entry point. Strictly under 150 lines.
   */
  public update(dt: number, ctx: SimulationContext): void {
    if (!this.engineContext) {
      this.initEngineContext(ctx, ctx.performanceProfiler);
      moduleRegistry.initializeAll(this.engineContext);

      const pCtx = this.buildPluginContext(dt);
      for (const plugin of pluginRegistry.getEnabledPlugins()) {
        try {
          const initRes = plugin.initialize(pCtx);
          if (initRes instanceof Promise) {
            initRes.catch((err) => {
              this.engineContext!.services.logger.error(`Async plugin initialize error for ${plugin.id}:`, err);
            });
          }
        } catch (err) {
          this.engineContext!.services.logger.error(`Plugin initialize error for ${plugin.id}:`, err);
        }
      }
    }

    this.updateEngineContext(dt, ctx);

    this.engineContext.render.performanceProfiler.begin('SimulationLoop');

    this.engineContext.physics.deltaTime = dt;

    // 1. Execute ModuleRegistry
    for (const module of moduleRegistry.getModules()) {
      module.update(dt, this.engineContext);
    }

    // 2. Execute PluginRegistry
    const pluginContext = this.buildPluginContext(dt);
    const measureStartTime = this.engineContext!.services.time.now();
    for (const plugin of pluginRegistry.getEnabledPlugins()) {
      try {
        plugin.update(dt, pluginContext);
      } catch (err) {
        this.engineContext!.services.logger.error(`Plugin update error for ${plugin.id}:`, err);
      }
    }
    this.engineContext!.analysis.metricsCache.current.measureTime = this.engineContext!.services.time.now() - measureStartTime;

    // Retrieve consolidated results from EngineRegistry
    this.consolidatedResults = EngineRegistry.getInstance().getConsolidatedResults();
    
    const eyeLevelResult = this.consolidatedResults['eye-level-above-ground'];
    this.eyeLevelAboveGround = (eyeLevelResult && typeof eyeLevelResult.value === 'number') ? eyeLevelResult.value : 1.65;

    const ceilingResult = this.consolidatedResults['ceiling-height'];
    this.calculatedCeilingHeight = (ceilingResult && typeof ceilingResult.value === 'number') ? ceilingResult.value : null;

    const walkwayResult = this.consolidatedResults['walkway-width'];
    this.walkwayWidth = (walkwayResult && typeof walkwayResult.value === 'number') ? walkwayResult.value : null;

    const wallResult = this.consolidatedResults['wall-distance'];
    this.closestWallDist = (wallResult && typeof wallResult.value === 'number') ? wallResult.value : null;
    this.closestWallPoint = (wallResult && wallResult.extraData?.closestWallPoint) ? wallResult.extraData.closestWallPoint : null;

    // Sync back to engineContext immediately for other parts of the frame/UI
    this.engineContext!.analysis.walkwayWidth = this.walkwayWidth;
    this.engineContext!.analysis.closestWallDist = this.closestWallDist;
    this.engineContext!.analysis.closestWallPoint = this.closestWallPoint;
    this.engineContext!.analysis.calculatedCeilingHeight = this.calculatedCeilingHeight;
    this.engineContext!.analysis.eyeLevelAboveGround = this.eyeLevelAboveGround;
    this.engineContext!.analysis.consolidatedResults = this.consolidatedResults;

    this.engineContext!.render.performanceProfiler.end('SimulationLoop');
  }

  private updateScheduler(dt: number, context: EngineContext): void {
    const frameStart = context.services.time.now();
    this.frameCount++;

    this.shouldRunRaycasts = this.frameCount % 8 === 0;
    this.shouldUpdateSubTabs = this.frameCount % 4 === 0;
    this.shouldDispatchTelemetry = this.frameCount % 12 === 0;

    // Calculate FPS
    this.fpsFrames++;
    if (frameStart > this.fpsLastTime + 1000) {
      this.currentFps = Math.round((this.fpsFrames * 1000) / (frameStart - this.fpsLastTime));
      this.fpsFrames = 0;
      this.fpsLastTime = frameStart;
    }
  }

  private updateTime(dt: number, context: EngineContext): void {
    if (context.analysis.isTimePlaying && context.analysis.timeSpeed !== '0x') {
      let minsPerSec = 0;
      if (context.analysis.timeSpeed === '1x') minsPerSec = 2;
      else if (context.analysis.timeSpeed === '2x') minsPerSec = 10;
      else if (context.analysis.timeSpeed === '5x') minsPerSec = 30;
      else if (context.analysis.timeSpeed === '10x') minsPerSec = 60;

      this.timeAccumulator += minsPerSec * dt;
      if (this.timeAccumulator >= 1.0) {
        const minsToAdd = Math.floor(this.timeAccumulator);
        this.timeAccumulator -= minsToAdd;

        const timeParts = context.analysis.settings.analysisTime.split(':');
        if (timeParts.length === 2) {
          const currH = parseInt(timeParts[0], 10);
          const currM = parseInt(timeParts[1], 10);
          if (!isNaN(currH) && !isNaN(currM)) {
            let totalMins = currH * 60 + currM + minsToAdd;
            totalMins = ((totalMins % 1440) + 1440) % 1440;
            const nextH = Math.floor(totalMins / 60);
            const nextM = totalMins % 60;
            const nextTimeStr = `${nextH.toString().padStart(2, '0')}:${nextM.toString().padStart(2, '0')}`;
            
            context.analysis.onSettingsChange({ analysisTime: nextTimeStr });
          }
        }
      }
    }
  }

  private updateCharacter(dt: number, context: EngineContext): void {
    const isArchitect = context.analysis.settings.movementMode === 'architect' || !context.analysis.settings.movementMode;
    const moveSpeed = isArchitect ? 1.45 : context.analysis.settings.currentMoveSpeed;
    this.speedScale = 1.0;

    if (context.analysis.settings.posture === 'crouching') {
      this.speedScale = 0.5;
    } else if (context.analysis.settings.posture === 'sitting') {
      this.speedScale = 0.15;
    }

    if (context.input.activeKeys['shift']) {
      if (isArchitect) {
        this.speedScale *= 1.15;
      } else {
        this.speedScale *= 1.8;
      }
    }

    const finalSpeed = moveSpeed * this.speedScale;
    const moveVector = _tempV1.set(0, 0, 0);
    const forward = _tempV2.set(-Math.sin(context.physics.cameraYaw.current), 0, -Math.cos(context.physics.cameraYaw.current));
    const right = _tempV3.set(Math.cos(context.physics.cameraYaw.current), 0, -Math.sin(context.physics.cameraYaw.current));

    const isMovementEnabled = context.input.isLocked && !context.input.showCharacterModal && !context.input.showSetupConfirm;

    if (isMovementEnabled) {
      if (context.input.activeKeys['w']) moveVector.add(forward);
      if (context.input.activeKeys['s']) moveVector.sub(forward);
      if (context.input.activeKeys['a']) moveVector.sub(right);
      if (context.input.activeKeys['d']) moveVector.add(right);
    }

    this.debugLogFrameCounter = (this.debugLogFrameCounter + 1) % 30;
    if (this.debugLogFrameCounter === 0) {
      console.log(`[Character Controller Debug]
- Input: W=${!!context.input.activeKeys['w']}, A=${!!context.input.activeKeys['a']}, S=${!!context.input.activeKeys['s']}, D=${!!context.input.activeKeys['d']}
- Movement Enabled: ${isMovementEnabled}
- Velocity: (${context.physics.playerVelocity.x.toFixed(3)}, ${context.physics.playerVelocity.y.toFixed(3)}, ${context.physics.playerVelocity.z.toFixed(3)})
- Position: (${context.physics.playerPos.x.toFixed(3)}, ${context.physics.playerPos.y.toFixed(3)}, ${context.physics.playerPos.z.toFixed(3)})
- Pointer Lock: ${context.input.isLocked}
- UI Mode: ${context.input.isTabCursorMode}`);
    }

    moveVector.normalize();
    const damping = 12.0;
    context.physics.characterController.applyFrictionAndAcceleration(moveVector, finalSpeed, damping, dt);

    if (moveVector.lengthSq() > 0) {
      if (context.analysis.settings.viewMode === 'third-person') {
        const targetAvatarYaw = Math.atan2(moveVector.x, moveVector.z);
        const rotSpeed = Math.min(1.0, dt / 0.18);
        context.physics.avatarYaw.current = lerpAngle(context.physics.avatarYaw.current, targetAvatarYaw, rotSpeed);
      }
    }

    if (context.analysis.settings.viewMode === 'first-person') {
      context.physics.avatarYaw.current = context.physics.cameraYaw.current + Math.PI;
    }

    if (context.input.inputManager) {
      context.input.inputManager.update();
    }
  }

  private updatePhysics(dt: number, context: EngineContext): void {
    if (context.scene.cachedCollidableMeshes.current.length === 0 && context.scene.currentModelGroup) {
      const meshes: THREE.Object3D[] = [];
      context.scene.currentModelGroup.traverse((node) => {
        if (node instanceof THREE.Mesh) meshes.push(node);
      });
      context.scene.cachedCollidableMeshes.current = meshes;
    }
    const collidableMeshes = context.scene.cachedCollidableMeshes.current;

    const isArchitect = context.analysis.settings.movementMode === 'architect' || !context.analysis.settings.movementMode;
    const isMovementEnabled = context.input.isLocked && !context.input.showCharacterModal && !context.input.showSetupConfirm;

    const charInput: CharacterInputState = {
      forward: !!(context.input.activeKeys['w'] || context.input.activeKeys['ArrowUp']),
      backward: !!(context.input.activeKeys['s'] || context.input.activeKeys['ArrowDown']),
      left: !!(context.input.activeKeys['a'] || context.input.activeKeys['ArrowLeft']),
      right: !!(context.input.activeKeys['d'] || context.input.activeKeys['ArrowRight']),
      jump: !!(context.input.activeKeys[' '] && isMovementEnabled && context.analysis.settings.presetId !== 'wheelchair'),
      shift: !!context.input.activeKeys['Shift']
    };

    const charConfig: CharacterPhysicsConfig = {
      gravityEnabled: !!context.analysis.settings.gravityEnabled,
      collisionEnabled: !!context.analysis.settings.collisionEnabled,
      eyeHeight: context.analysis.settings.eyeHeight,
      bodyWidth: context.analysis.settings.bodyWidth,
      moveSpeed: context.analysis.settings.currentMoveSpeed,
      jumpPower: isArchitect ? 1.0 : (context.analysis.settings.jumpPower !== undefined ? context.analysis.settings.jumpPower : 4.2),
      posture: 'standing'
    };

    context.render.performanceProfiler.begin('Physics');
    context.physics.characterController.update(dt, charInput, charConfig, collidableMeshes);
    this.activeRoomName = context.physics.characterController.activeRoom;

    context.physics.characterController.updateEyeHeight(dt, context.analysis.settings.posture, context.analysis.settings.eyeHeight);
    context.render.performanceProfiler.end('Physics');

    const isMovingHorizontal = Math.abs(context.physics.playerVelocity.x) > 0.1 || Math.abs(context.physics.playerVelocity.z) > 0.1;

    context.render.performanceProfiler.begin('Camera');
    context.physics.cameraController.update(
      dt,
      context.scene.camera,
      context.physics.playerPos,
      context.physics.currentEyeHeight.current,
      context.physics.cameraYaw.current,
      context.physics.cameraPitch.current,
      isMovingHorizontal,
      isArchitect,
      this.speedScale,
      context.analysis.settings.posture,
      context.analysis.settings.viewMode,
      collidableMeshes,
      context.physics.characterController
    );
    context.render.performanceProfiler.end('Camera');

    const avatar = context.scene.avatarGroup;
    if (avatar) {
      if (context.physics.cameraController.transitionFactor < 0.05) {
        avatar.visible = false;
      } else {
        avatar.visible = true;
        avatar.position.copy(context.physics.playerPos);
        avatar.rotation.y = context.physics.avatarYaw.current;

        const hNode = avatar.getObjectByName('mannequin_head');
        const tNode = avatar.getObjectByName('mannequin_torso');
        const sNode = avatar.getObjectByName('mannequin_shoulders');
        const caNode = avatar.getObjectByName('mannequin_chest_arrow');
        const faNode = avatar.getObjectByName('mannequin_floor_arrow');
        const wcNode = avatar.getObjectByName('wheelchair_chassis');
        const llNode = avatar.getObjectByName('mannequin_left_leg');
        const rlNode = avatar.getObjectByName('mannequin_right_leg');
        const fpNode = avatar.getObjectByName('mannequin_footprint');
        const scNode = avatar.getObjectByName('mannequin_standing_circle');

        const isWheelchair = context.analysis.settings.presetId === 'wheelchair';

        if (hNode) hNode.position.y = context.physics.currentEyeHeight.current + 0.08;
        if (tNode) {
          tNode.position.y = context.physics.currentEyeHeight.current / 2;
          tNode.scale.y = context.physics.currentEyeHeight.current / 1.65;
        }
        if (sNode) {
          sNode.position.set(0, context.physics.currentEyeHeight.current - 0.12, 0);
          sNode.scale.x = (context.analysis.settings.bodyWidth || 0.55) / 0.55;
        }
        if (caNode) {
          caNode.position.set(0, context.physics.currentEyeHeight.current - 0.25, 0);
          caNode.visible = context.analysis.playerDirectionArrowEnabled;
        }
        if (faNode) {
          faNode.position.y = 0.01;
          faNode.visible = context.analysis.playerDirectionArrowEnabled;
        }
        if (llNode) {
          llNode.visible = !isWheelchair;
          if (!isWheelchair) {
            const bottomOfTorso = context.physics.currentEyeHeight.current * 0.258;
            llNode.position.set(-0.08, bottomOfTorso / 2, 0);
            llNode.scale.set(1, bottomOfTorso / 0.425, 1);
          }
        }
        if (rlNode) {
          rlNode.visible = !isWheelchair;
          if (!isWheelchair) {
            const bottomOfTorso = context.physics.currentEyeHeight.current * 0.258;
            rlNode.position.set(0.08, bottomOfTorso / 2, 0);
            rlNode.scale.set(1, bottomOfTorso / 0.425, 1);
          }
        }
        if (fpNode) fpNode.visible = !isWheelchair;
        if (scNode) scNode.visible = !isWheelchair;
        if (wcNode) wcNode.visible = isWheelchair;
      }
    }

    const cyl = context.scene.clearanceCylinder;
    if (cyl) {
      if (context.physics.cameraController.transitionFactor < 0.05 || !context.analysis.playerEnvelopeEnabled) {
        cyl.visible = false;
      } else {
        cyl.visible = true;
        cyl.position.set(context.physics.playerPos.x, context.physics.playerPos.y + context.physics.currentEyeHeight.current / 2, context.physics.playerPos.z);
        cyl.scale.set(context.analysis.settings.bodyWidth, context.physics.currentEyeHeight.current, context.analysis.settings.bodyWidth);
      }
    }
  }

  private updateAnalysis(dt: number, context: EngineContext): void {
    const rSphere = context.scene.reachSphere;
    if (rSphere && context.analysis.settings.showReachSphere) {
      rSphere.visible = true;
      rSphere.position.set(context.physics.playerPos.x, context.physics.playerPos.y + context.physics.currentEyeHeight.current - 0.15, context.physics.playerPos.z);
      rSphere.scale.setScalar(context.analysis.settings.reachRadius);
    } else if (rSphere) {
      rSphere.visible = false;
    }

    const fpArm = context.scene.fpArmGroup;
    if (fpArm) {
      if (context.analysis.settings.viewMode === 'first-person' && this.reachAnimTimer >= 0) {
        fpArm.visible = true;
        const animTime = this.reachAnimTimer;
        this.reachAnimTimer += dt;

        const tExtend = 0.12;
        const tHold = 0.25;
        const tRetract = 0.18;
        const totalDuration = tExtend + tHold + tRetract;

        const restX = 0.18, restY = -0.16, restZ = -0.18;
        const restRotX = 0.4, restRotY = -0.4;
        const extX = 0.05, extY = -0.06, extZ = -0.55;
        const extRotX = -0.1, extRotY = 0.1;

        if (animTime < tExtend) {
          const alpha = animTime / tExtend;
          const ease = 1 - Math.pow(1 - alpha, 3);
          fpArm.position.set(
            THREE.MathUtils.lerp(restX, extX, ease),
            THREE.MathUtils.lerp(restY, extY, ease),
            THREE.MathUtils.lerp(restZ, extZ, ease)
          );
          fpArm.rotation.set(
            THREE.MathUtils.lerp(restRotX, extRotX, ease),
            THREE.MathUtils.lerp(restRotY, extRotY, ease),
            0
          );
        } else if (animTime < tExtend + tHold) {
          fpArm.position.set(extX, extY, extZ);
          fpArm.rotation.set(extRotX, extRotY, 0);
        } else if (animTime < totalDuration) {
          const alpha = (animTime - tExtend - tHold) / tRetract;
          const ease = alpha < 0.5 ? 2 * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 2) / 2;
          fpArm.position.set(
            THREE.MathUtils.lerp(extX, restX, ease),
            THREE.MathUtils.lerp(extY, restY, ease),
            THREE.MathUtils.lerp(extZ, restZ, ease)
          );
          fpArm.rotation.set(
            THREE.MathUtils.lerp(extRotX, restRotX, ease),
            THREE.MathUtils.lerp(extRotY, restRotY, ease),
            0
          );
        } else {
          this.reachAnimTimer = -1;
          fpArm.visible = false;
        }
      } else {
        fpArm.visible = false;
        if (this.reachAnimTimer >= 0 && context.analysis.settings.viewMode !== 'first-person') {
          this.reachAnimTimer = -1;
        }
      }
    }

    if (context.input.activeKeys['e'] && this.reachAnimTimer < 0 && context.analysis.settings.viewMode === 'first-person') {
      this.reachAnimTimer = 0;
    }

    const dynReach = context.scene.dynReachGroup;
    if (dynReach) {
      if (this.dynReachFadeTimer >= 0) {
        dynReach.visible = true;
        dynReach.position.set(context.physics.playerPos.x, context.physics.playerPos.y + context.physics.currentEyeHeight.current - 0.1, context.physics.playerPos.z);

        const fadeTime = this.dynReachFadeTimer;
        this.dynReachFadeTimer -= dt;

        const baseOpacityInner = 0.05;
        const baseOpacityOuter = 0.15;
        const ratio = Math.max(0, fadeTime / 0.5);

        const innerMesh = dynReach.children[0] as THREE.Mesh;
        const outerMesh = dynReach.children[1] as THREE.Mesh;

        if (innerMesh && innerMesh.material) {
          (innerMesh.material as THREE.Material).transparent = true;
          (innerMesh.material as THREE.Material).opacity = baseOpacityInner * ratio;
        }
        if (outerMesh && outerMesh.material) {
          (outerMesh.material as THREE.Material).transparent = true;
          (outerMesh.material as THREE.Material).opacity = baseOpacityOuter * ratio;
        }

        if (fadeTime <= 0) {
          this.dynReachFadeTimer = -1;
          dynReach.visible = false;
        }
      } else {
        dynReach.visible = false;
      }
    }

    if (context.input.activeKeys['e'] && this.dynReachFadeTimer < 0) {
      this.dynReachFadeTimer = 0.5;
    }

    if (context.scene.sunGroup) {
      if (context.analysis.settings.showSunAnalysis) {
        context.scene.sunGroup.visible = true;
        const currentModelId = context.input.currentSpace;
        const paramsChanged = 
          this.lastSolarParams.date !== context.analysis.settings.analysisDate ||
          this.lastSolarParams.time !== context.analysis.settings.analysisTime ||
          this.lastSolarParams.latitude !== context.analysis.settings.latitude ||
          this.lastSolarParams.longitude !== context.analysis.settings.longitude ||
          this.lastSolarParams.timezone !== context.analysis.settings.timezone ||
          this.lastSolarParams.modelNorth !== (context.analysis.settings.modelNorth || 0) ||
          this.lastSolarParams.showSunAnalysis !== context.analysis.settings.showSunAnalysis ||
          this.lastSolarParams.modelId !== currentModelId ||
          this.lastSolarParams.sceneSunEnabled !== context.analysis.sceneSunEnabled ||
          this.lastSolarParams.sceneSunPathEnabled !== context.analysis.sceneSunPathEnabled ||
          this.lastSolarParams.sceneSkyEnabled !== context.analysis.sceneSkyEnabled;

        let altitude = this.lastSolarParams.altitude !== undefined ? this.lastSolarParams.altitude : Math.PI / 2;
        const sunPos = _tempV1.set(0, 20, 0);
        const sunPosVisual = _tempV2.set(0, 1000, 0);

        if (paramsChanged) {
          const solarStartTime = context.services.time.now();
          try {
            const [year, month, day] = context.analysis.settings.analysisDate.split('-').map(Number);
            const [hour, minute] = context.analysis.settings.analysisTime.split(':').map(Number);
            const targetDate = new Date(Date.UTC(year, month - 1, day, hour - context.analysis.settings.timezone, minute));

            const solar = computeSolarPosition(targetDate, context.analysis.settings.latitude, context.analysis.settings.longitude, context.analysis.settings.timezone);

            altitude = solar.altitude;
            const azimuth = solar.azimuth;
            const sunRadius = 24;
            const sunRadiusVisual = 1000;
            const modelNorthRad = (context.analysis.settings.modelNorth || 0) * (Math.PI / 180);
            const relativeAzimuth = azimuth - modelNorthRad;

            const cosAlt = Math.cos(altitude);
            sunPos.set(
              sunRadius * cosAlt * Math.sin(relativeAzimuth),
              sunRadius * Math.sin(altitude),
              -sunRadius * cosAlt * Math.cos(relativeAzimuth)
            );

            sunPosVisual.set(
              sunRadiusVisual * cosAlt * Math.sin(relativeAzimuth),
              sunRadiusVisual * Math.sin(altitude),
              -sunRadiusVisual * cosAlt * Math.cos(relativeAzimuth)
            );

            const pathPoints = [];
            for (let h = 0; h <= 24; h += 0.5) {
              const tempDate = new Date(Date.UTC(year, month - 1, day, h - context.analysis.settings.timezone, 0));
              const pos = computeSolarPosition(tempDate, context.analysis.settings.latitude, context.analysis.settings.longitude, context.analysis.settings.timezone);
              const rCosAlt = Math.cos(pos.altitude);
              pathPoints.push(new THREE.Vector3(
                sunRadiusVisual * rCosAlt * Math.sin(pos.azimuth - modelNorthRad),
                sunRadiusVisual * Math.sin(pos.altitude),
                -sunRadiusVisual * rCosAlt * Math.cos(pos.azimuth - modelNorthRad)
              ));
            }

            const trajectoryLine = context.scene.sunGroup.children.find(child => child instanceof THREE.Line) as THREE.Line | undefined;
            if (trajectoryLine) {
              trajectoryLine.geometry.dispose();
              trajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
              trajectoryLine.computeLineDistances();
              trajectoryLine.visible = context.analysis.sceneSunPathEnabled;
            }

            this.lastSolarParams = {
              date: context.analysis.settings.analysisDate,
              time: context.analysis.settings.analysisTime,
              latitude: context.analysis.settings.latitude,
              longitude: context.analysis.settings.longitude,
              timezone: context.analysis.settings.timezone,
              modelNorth: context.analysis.settings.modelNorth || 0,
              showSunAnalysis: context.analysis.settings.showSunAnalysis,
              modelId: currentModelId,
              sceneSunEnabled: context.analysis.sceneSunEnabled,
              sceneSunPathEnabled: context.analysis.sceneSunPathEnabled,
              sceneSkyEnabled: context.analysis.sceneSkyEnabled,
              altitude,
              sunPos: sunPos.clone(),
              sunPosVisual: sunPosVisual.clone()
            };

            context.analysis.metricsCache.current.solarTime = context.services.time.now() - solarStartTime;
          } catch (err) {
            context.services.logger.error("Error calculating solar position: ", err);
          }
        } else {
          if (this.lastSolarParams.sunPos && this.lastSolarParams.sunPosVisual) {
            sunPos.copy(this.lastSolarParams.sunPos);
            sunPosVisual.copy(this.lastSolarParams.sunPosVisual);
            altitude = this.lastSolarParams.altitude !== undefined ? this.lastSolarParams.altitude : Math.PI / 2;
          }
        }

        const sunSphere = context.scene.scene.getObjectByName('sun_sphere');
        if (sunSphere) {
          sunSphere.position.copy(sunPosVisual);
          sunSphere.visible = context.analysis.sceneSunEnabled && altitude >= 0;
        }

        if (context.scene.dirLight) {
          const modelCenter = _tempV3.set(0, 0, 0);
          if (context.scene.currentModelGroup) {
            const box = new THREE.Box3().setFromObject(context.scene.currentModelGroup);
            box.getCenter(modelCenter);
          }
          context.scene.dirLight.position.copy(sunPos).add(modelCenter);
          context.scene.dirLight.target.position.copy(modelCenter);
          context.scene.dirLight.target.updateMatrixWorld();

          if (altitude <= 0) {
            context.scene.dirLight.intensity = 0.0;
            context.scene.dirLight.castShadow = false;
          } else if (altitude < 0.1) {
            context.scene.dirLight.intensity = 1.35 * (altitude / 0.1);
            context.scene.dirLight.castShadow = true;
          } else {
            context.scene.dirLight.intensity = 1.35;
            context.scene.dirLight.castShadow = true;
          }
        }

        if (context.scene.ambientLight) context.scene.ambientLight.intensity = 0.0;
        if (context.scene.hemiLight) context.scene.hemiLight.intensity = 0.0;

        if (context.analysis.sceneSkyEnabled) {
          context.scene.scene.background = getSkyColor(altitude);
        }

        if (context.scene.currentModelGroup) {
          context.scene.currentModelGroup.traverse((node) => {
            if (node instanceof THREE.Mesh && node.material instanceof THREE.ShaderMaterial) {
              if (node.material.uniforms && node.material.uniforms.uSunPos) {
                node.material.uniforms.uSunPos.value.copy(sunPosVisual);
              }
            }
          });
        }
      } else {
        context.scene.sunGroup.visible = false;
      }
    }

    if (context.scene.windGroup) {
      if (context.analysis.settings.showWindAnalysis) {
        context.scene.windGroup.visible = true;
        const relativeAngleRad = (context.analysis.windAngle - (context.analysis.settings.modelNorth || 0)) * (Math.PI / 180);
        const streamDir = new THREE.Vector3(-Math.sin(relativeAngleRad), 0, Math.cos(relativeAngleRad)).normalize();
        const timeVal = context.services.time.now();

        context.scene.windGroup.children.forEach((child, idx) => {
          child.userData.offset.addScaledVector(streamDir, context.analysis.windSpeed * dt);
          const maxBound = 5.0;
          if (child.userData.offset.x > maxBound) child.userData.offset.x = -maxBound;
          if (child.userData.offset.x < -maxBound) child.userData.offset.x = maxBound;
          if (child.userData.offset.z > maxBound) child.userData.offset.z = -maxBound;
          if (child.userData.offset.z < -maxBound) child.userData.offset.z = maxBound;

          child.position.copy(context.physics.playerPos).add(child.userData.offset);
          child.rotation.set(0, -Math.atan2(streamDir.z, streamDir.x) + Math.PI/2, 0);

          const pulse = Math.sin(timeVal * 0.005 + idx * 0.8) * 0.3 + 0.7;
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = 0.12 + 0.38 * pulse;
          }
        });
      } else {
        context.scene.windGroup.visible = false;
      }
    }

  }

  private updateShadowDiagnostics(dt: number, context: EngineContext): void {
    context.physics.characterController.setAvatarYaw(context.physics.avatarYaw.current);
    const isActualGrounded = context.physics.playerVelocity.y === 0;

    const diffYaw = Math.abs(context.physics.characterController.cameraYaw - context.physics.cameraYaw.current);
    const diffPitch = Math.abs(context.physics.characterController.cameraPitch - context.physics.cameraPitch.current);
    const diffPos = context.physics.characterController.position.distanceTo(context.physics.playerPos);
    const diffVel = context.physics.characterController.velocity.distanceTo(context.physics.playerVelocity);
    const diffEyeHeight = Math.abs(context.physics.characterController.currentEyeHeight - context.physics.currentEyeHeight.current);
    const diffGrounded = context.physics.characterController.grounded === isActualGrounded ? 0 : 1;

    this.shadowLogCounter = (this.shadowLogCounter + 1) % 180;
    if (this.shadowLogCounter === 0) {
      context.services.logger.log(`[Shadow Mode Diagnostics]
 - Position Dev: ${diffPos.toFixed(4)}
 - Velocity Dev: ${diffVel.toFixed(4)}
 - Yaw Dev:      ${diffYaw.toFixed(4)}
 - Pitch Dev:    ${diffPitch.toFixed(4)}
 - EyeHeight Dev:${diffEyeHeight.toFixed(4)}
 - Grounded Dev: ${diffGrounded}`);
    }

    const TOLERANCE = 0.0001;
    if (diffYaw > TOLERANCE || diffPitch > TOLERANCE || diffPos > TOLERANCE || diffVel > TOLERANCE || diffEyeHeight > TOLERANCE || diffGrounded !== 0) {
      if (!this.shadowSpamTimer || context.services.time.now() - this.shadowSpamTimer > 1000) {
        context.services.logger.warn(`[Shadow Mode Divergence Alert] State mismatch detected!
 - Position:   CC=${context.physics.characterController.position.x.toFixed(4)},${context.physics.characterController.position.y.toFixed(4)},${context.physics.characterController.position.z.toFixed(4)} vs Actual=${context.physics.playerPos.x.toFixed(4)},${context.physics.playerPos.y.toFixed(4)},${context.physics.playerPos.z.toFixed(4)} (diff: ${diffPos.toFixed(4)})
 - Velocity:   CC=${context.physics.characterController.velocity.x.toFixed(4)},${context.physics.characterController.velocity.y.toFixed(4)},${context.physics.characterController.velocity.z.toFixed(4)} vs Actual=${context.physics.playerVelocity.x.toFixed(4)},${context.physics.playerVelocity.y.toFixed(4)},${context.physics.playerVelocity.z.toFixed(4)} (diff: ${diffVel.toFixed(4)})
 - Yaw (rad):  CC=${context.physics.characterController.cameraYaw.toFixed(4)} vs Actual=${context.physics.cameraYaw.current.toFixed(4)} (diff: ${diffYaw.toFixed(4)})
 - Pitch (rad): CC=${context.physics.characterController.cameraPitch.toFixed(4)} vs Actual=${context.physics.cameraPitch.current.toFixed(4)} (diff: ${diffPitch.toFixed(4)})
 - EyeHeight:  CC=${context.physics.characterController.currentEyeHeight.toFixed(4)} vs Actual=${context.physics.currentEyeHeight.current.toFixed(4)} (diff: ${diffEyeHeight.toFixed(4)})
 - Grounded:   CC=${context.physics.characterController.grounded} vs Actual=${isActualGrounded}`);
        this.shadowSpamTimer = context.services.time.now();
      }
    }
  }

  private renderFrame(context: EngineContext): void {
    context.scene.renderer.render(context.scene.scene, context.scene.camera);
  }
}
