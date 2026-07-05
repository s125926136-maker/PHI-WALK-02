/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { ModelUnit, PlayerSettings } from '../types';
import { formatDistance } from '../utils/math';
import { AnalysisEngine, EngineMetadata, UpdatePolicy, AnalysisResult, AnalysisContext } from './framework';

export interface DimensionVisualizer {
  group: THREE.Group;
  line: THREE.Line;
  arrowSegments: THREE.LineSegments;
  sprite: THREE.Sprite;
  textSprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  context: CanvasRenderingContext2D;
}

export function initDimensionVisualizer(colorHex: number): DimensionVisualizer {
  const group = new THREE.Group();
  
  // Main line with dummy points
  const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(0,0,0)]);
  const lineMat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.8,
    linewidth: 1.5,
    depthWrite: false,
    depthTest: false
  });
  const line = new THREE.Line(lineGeom, lineMat);
  group.add(line);

  // Arrow segments with dummy points
  const arrowGeom = new THREE.BufferGeometry();
  const arrowSegments = new THREE.LineSegments(arrowGeom, lineMat);
  group.add(arrowSegments);

  // Canvas and texture for text
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    depthWrite: false,
    depthTest: false,
    transparent: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.7, 0.175, 1);
  group.add(sprite);

  return {
    group,
    line,
    arrowSegments,
    sprite,
    textSprite: sprite,
    canvas,
    texture,
    context
  };
}

export function updateDimensionVisualizer(
  vis: DimensionVisualizer,
  pointA: THREE.Vector3,
  pointB: THREE.Vector3,
  text: string,
  colorHex: number,
  modelUnit: ModelUnit,
  arrowEnabled: boolean = true,
  labelsEnabled: boolean = true
) {
  // 1. Update line geometry
  const lineGeom = vis.line.geometry;
  const positions = new Float32Array([
    pointA.x, pointA.y, pointA.z,
    pointB.x, pointB.y, pointB.z
  ]);
  lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  lineGeom.computeBoundingSphere();
  lineGeom.computeBoundingBox();

  // 2. Compute arrow segments
  const dir = new THREE.Vector3().subVectors(pointB, pointA);
  const length = dir.length();
  let arrowPoints: THREE.Vector3[] = [];

  if (length > 0.05) {
    dir.normalize();
    const arrowLength = Math.min(0.08, length * 0.15);
    
    // Orthogonal offsets
    const up = Math.abs(dir.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const upOffset = new THREE.Vector3().crossVectors(dir, right).normalize();

    // Arrows at B pointing to B
    const bArrow1 = pointB.clone().sub(dir.clone().multiplyScalar(arrowLength)).add(right.clone().multiplyScalar(arrowLength * 0.4));
    const bArrow2 = pointB.clone().sub(dir.clone().multiplyScalar(arrowLength)).sub(right.clone().multiplyScalar(arrowLength * 0.4));
    const bArrow3 = pointB.clone().sub(dir.clone().multiplyScalar(arrowLength)).add(upOffset.clone().multiplyScalar(arrowLength * 0.4));
    const bArrow4 = pointB.clone().sub(dir.clone().multiplyScalar(arrowLength)).sub(upOffset.clone().multiplyScalar(arrowLength * 0.4));

    // Arrows at A pointing to A
    const aArrow1 = pointA.clone().add(dir.clone().multiplyScalar(arrowLength)).add(right.clone().multiplyScalar(arrowLength * 0.4));
    const aArrow2 = pointA.clone().add(dir.clone().multiplyScalar(arrowLength)).sub(right.clone().multiplyScalar(arrowLength * 0.4));
    const aArrow3 = pointA.clone().add(dir.clone().multiplyScalar(arrowLength)).add(upOffset.clone().multiplyScalar(arrowLength * 0.4));
    const aArrow4 = pointA.clone().add(dir.clone().multiplyScalar(arrowLength)).sub(upOffset.clone().multiplyScalar(arrowLength * 0.4));

    arrowPoints = [
      pointB, bArrow1,
      pointB, bArrow2,
      pointB, bArrow3,
      pointB, bArrow4,
      pointA, aArrow1,
      pointA, aArrow2,
      pointA, aArrow3,
      pointA, aArrow4
    ];
  }

  const arrowGeom = vis.arrowSegments.geometry;
  arrowGeom.setFromPoints(arrowPoints);
  arrowGeom.computeBoundingSphere();
  arrowGeom.computeBoundingBox();

  // 3. Update canvas text dynamically
  const ctx = vis.context;
  const canvas = vis.canvas;

  let title = text;
  let value = "";
  const parts = text.split(': ');
  if (parts.length > 1) {
    title = parts[0];
    value = parts[1];
  }

  const titleFont = '11px "Inter", "Microsoft JhengHei", sans-serif';
  const valueFont = 'bold 16px "JetBrains Mono", "Microsoft JhengHei", monospace';

  ctx.font = titleFont;
  const titleWidth = ctx.measureText(title).width;

  let valueWidth = 0;
  if (value) {
    ctx.font = valueFont;
    valueWidth = ctx.measureText(value).width;
  }

  const maxTextWidth = Math.max(titleWidth, valueWidth);
  const paddingX = 14;
  const paddingY = 8;
  const borderThickness = 3;

  const bgWidth = Math.max(120, maxTextWidth + paddingX * 2);
  const lineSpacing = 4;
  const titleHeight = 13;
  const valueHeight = 17;
  const bgHeight = paddingY * 2 + titleHeight + (value ? (lineSpacing + valueHeight) : 0);

  const dpr = 2;
  canvas.width = bgWidth * dpr;
  canvas.height = bgHeight * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, bgWidth, bgHeight);

  const colorStr = '#' + colorHex.toString(16).padStart(6, '0');
  ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
  ctx.strokeStyle = colorStr;
  ctx.lineWidth = borderThickness;

  const radius = 6;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(borderThickness / 2, borderThickness / 2, bgWidth - borderThickness, bgHeight - borderThickness, radius);
  } else {
    const x = borderThickness / 2;
    const y = borderThickness / 2;
    const w = bgWidth - borderThickness;
    const h = bgHeight - borderThickness;
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (value) {
    ctx.fillStyle = '#a8a29e';
    ctx.font = titleFont;
    ctx.fillText(title, bgWidth / 2, paddingY);

    ctx.fillStyle = '#ffffff';
    ctx.font = valueFont;
    ctx.fillText(value, bgWidth / 2, paddingY + titleHeight + lineSpacing);
  } else {
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = valueFont;
    ctx.fillText(title, bgWidth / 2, bgHeight / 2);
  }

  vis.texture.needsUpdate = true;

  const scaleFactor = 0.0027;
  vis.sprite.scale.set(bgWidth * scaleFactor, bgHeight * scaleFactor, 1);

  const midPoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5);
  if (Math.abs(pointB.y - pointA.y) < 0.1) {
    midPoint.y += 0.12;
  } else {
    midPoint.x += 0.08;
    midPoint.z += 0.08;
  }
  vis.sprite.position.copy(midPoint);
  vis.group.visible = true;
}

/**
 * SpatialMeasurementEngine encapsulates all spatial measurements, raycasts,
 * and 3D visual lines and text labels within the PHI WALK architectural workspace.
 */
export class SpatialMeasurementEngine implements AnalysisEngine {
  public readonly metadata: EngineMetadata = {
    name: 'measure-engine',
    version: '1.0.0',
    category: 'measure',
    priority: 30, // Player is 10, Solar is 20, Measure is 30, Wind is 40
    updatePolicy: UpdatePolicy.Always,
    dependencies: []
  };

  private _isEnabled: boolean = false;
  private scene!: THREE.Scene;
  private camera!: THREE.Camera;
  private results: Record<string, AnalysisResult> = {};

  // Three.js Groups managed by the engine
  public measureVisGroup = new THREE.Group();
  public laserGroup = new THREE.Group();

  // Individual Visualizers
  public visualizers!: {
    eyeLevel: DimensionVisualizer;
    ceiling: DimensionVisualizer;
    walkway: DimensionVisualizer;
    wallDist: DimensionVisualizer;
    eyeRay: DimensionVisualizer;
  };

  // Laser lines
  public laserLines!: {
    up: THREE.Line;
    down: THREE.Line;
    left: THREE.Line;
    right: THREE.Line;
    front: THREE.Line;
    back: THREE.Line;
  };

  // High-performance Raycast Cache to avoid repeating calculations in the same frame
  public raycastCache = {
    eyeLevelAboveGround: 1.65,
    groundHitPoint: new THREE.Vector3(0, 0, 0),
    calculatedCeilingHeight: null as number | null,
    ceilingHitPoint: new THREE.Vector3(0, 0, 0),
    walkwayWidth: null as number | null,
    leftHitPoint: new THREE.Vector3(0, 0, 0),
    rightHitPoint: new THREE.Vector3(0, 0, 0),
    closestWallDist: null as number | null,
    closestWallPoint: null as THREE.Vector3 | null,
    frontDistance: null as number | null,
    frontHitPoint: new THREE.Vector3(0, 0, 0),
    hasCeilingHit: false,
    hasLeftHit: false,
    hasRightHit: false,
    hasFrontHit: false,
  };

  // Performance-optimizing reusable mathematical structures (ZERO allocations in update)
  private readonly _eyeDownRay = new THREE.Raycaster();
  private readonly _upRay = new THREE.Raycaster();
  private readonly _leftRay = new THREE.Raycaster();
  private readonly _rightRay = new THREE.Raycaster();
  private readonly _sweepRay = new THREE.Raycaster();
  private readonly _frontRay = new THREE.Raycaster();

  private readonly _tempV1 = new THREE.Vector3();
  private readonly _tempV2 = new THREE.Vector3();
  private readonly _tempV3 = new THREE.Vector3();
  private readonly _sweepDir = new THREE.Vector3();

  // Input state from the rendering loop
  private playerPos = new THREE.Vector3();
  private eyeHeight: number = 1.65;
  private avatarYaw: number = Math.PI;
  private collidableMeshes: THREE.Object3D[] = [];
  private settings: any = {};
  private toggles = {
    eyeLevelEnabled: true,
    ceilingHeightEnabled: true,
    walkwayWidthEnabled: true,
    wallDistanceEnabled: true,
    eyeRayEnabled: true,
    dimensionLabelsEnabled: true,
    measureArrowEnabled: true,
  };
  private shouldRunRaycastsThisFrame: boolean = false;

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  public initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.scene = scene;
    this.camera = camera;

    // 1. Create Dimension Visualizers
    this.visualizers = {
      eyeLevel: initDimensionVisualizer(0xf97316), // Orange
      ceiling: initDimensionVisualizer(0xf97316),  // Orange
      walkway: initDimensionVisualizer(0x06b6d4),  // Cyan
      wallDist: initDimensionVisualizer(0x06b6d4), // Cyan
      eyeRay: initDimensionVisualizer(0xef4444),   // Red
    };

    this.measureVisGroup.add(this.visualizers.eyeLevel.group);
    this.measureVisGroup.add(this.visualizers.ceiling.group);
    this.measureVisGroup.add(this.visualizers.walkway.group);
    this.measureVisGroup.add(this.visualizers.wallDist.group);
    this.measureVisGroup.add(this.visualizers.eyeRay.group);

    // Hide by default
    this.visualizers.eyeLevel.group.visible = false;
    this.visualizers.ceiling.group.visible = false;
    this.visualizers.walkway.group.visible = false;
    this.visualizers.wallDist.group.visible = false;
    this.visualizers.eyeRay.group.visible = false;

    // 2. Create Laser Lines
    const laserMat = new THREE.LineBasicMaterial({ color: 0x10b981, depthWrite: false }); // Emerald green
    const laserGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]);

    this.laserLines = {
      up: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0x10b981 })),
      down: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0x3b82f6 })), // Blue
      left: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0xf59e0b })), // Amber
      right: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0xf59e0b })),
      front: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0xec4899 })), // Pink
      back: new THREE.Line(laserGeom.clone(), new THREE.LineBasicMaterial({ color: 0xec4899 })),
    };

    Object.values(this.laserLines).forEach(line => {
      line.visible = false;
      this.laserGroup.add(line);
    });

    // Make sure groups are added/removed via lifecycle onEnable / onDisable
  }

  public onEnable(): void {
    this._isEnabled = true;
    this.scene.add(this.measureVisGroup);
    this.scene.add(this.laserGroup);
    console.log('[SpatialMeasurementEngine] Enabled and added to scene.');
  }

  public onDisable(): void {
    this._isEnabled = false;
    this.scene.remove(this.measureVisGroup);
    this.scene.remove(this.laserGroup);
    console.log('[SpatialMeasurementEngine] Disabled and removed from scene.');
  }

  public onSettingsChanged(settings: any): void {
    this.settings = settings;
  }

  public update(context: AnalysisContext): void {
    if (!this._isEnabled) return;

    // Synchronize state dynamically from the AnalysisContext
    this.playerPos.copy(context.player.position);
    this.eyeHeight = context.player.eyeHeight;
    this.avatarYaw = context.player.yaw;
    this.camera = context.camera;
    this.collidableMeshes = context.colliders;
    this.settings = context.settings;
    this.shouldRunRaycastsThisFrame = context.analysisSettings.shouldRunRaycasts ?? true;
    if (context.analysisSettings.measure) {
      this.toggles = {
        eyeLevelEnabled: context.analysisSettings.measure.eyeLevelEnabled,
        ceilingHeightEnabled: context.analysisSettings.measure.ceilingHeightEnabled,
        walkwayWidthEnabled: context.analysisSettings.measure.walkwayWidthEnabled,
        wallDistanceEnabled: context.analysisSettings.measure.wallDistanceEnabled,
        eyeRayEnabled: context.analysisSettings.measure.eyeRayEnabled,
        dimensionLabelsEnabled: context.analysisSettings.measure.dimensionLabelsEnabled,
        measureArrowEnabled: context.analysisSettings.measure.measureArrowEnabled,
      };
    }

    const { timestamp } = context;

    // Origins
    const measureOrigin = this._tempV1.set(this.playerPos.x, this.playerPos.y + this.eyeHeight, this.playerPos.z);
    const shoulderOrigin = this._tempV2.set(
      this.playerPos.x,
      this.playerPos.y + (this.eyeHeight - 0.12),
      this.playerPos.z
    );

    // ----------------------------------------------------
    // 1. EXECUTE THROTTLED RAYCASTS (Update Cache)
    // ----------------------------------------------------
    if (this.shouldRunRaycastsThisFrame) {
      // A. Downwards raycaster (Eye Level Above Ground)
      this._eyeDownRay.set(measureOrigin, this._tempV3.set(0, -1, 0));
      const eyeDownHits = this._eyeDownRay.intersectObjects(this.collidableMeshes);
      if (eyeDownHits.length > 0) {
        this.raycastCache.eyeLevelAboveGround = eyeDownHits[0].distance;
        this.raycastCache.groundHitPoint.copy(eyeDownHits[0].point);
      } else {
        this.raycastCache.eyeLevelAboveGround = measureOrigin.y;
        this.raycastCache.groundHitPoint.set(measureOrigin.x, 0, measureOrigin.z);
      }

      // B. Upwards raycaster (Ceiling Height)
      this._upRay.set(measureOrigin, this._tempV3.set(0, 1, 0));
      const upHits = this._upRay.intersectObjects(this.collidableMeshes);
      if (upHits.length > 0) {
        this.raycastCache.hasCeilingHit = true;
        this.raycastCache.calculatedCeilingHeight = upHits[0].distance;
        this.raycastCache.ceilingHitPoint.copy(upHits[0].point);
      } else {
        this.raycastCache.hasCeilingHit = false;
        this.raycastCache.calculatedCeilingHeight = null;
      }

      // C. Left & Right Walkway Width Raycasters
      const leftDir = this._tempV3.set(-Math.cos(this.avatarYaw), 0, Math.sin(this.avatarYaw)).normalize();
      const rightDir = this._tempV3.clone().negate();

      this._leftRay.set(shoulderOrigin, leftDir);
      this._rightRay.set(shoulderOrigin, rightDir);

      const leftHits = this._leftRay.intersectObjects(this.collidableMeshes);
      const rightHits = this._rightRay.intersectObjects(this.collidableMeshes);

      if (leftHits.length > 0 && rightHits.length > 0) {
        this.raycastCache.hasLeftHit = true;
        this.raycastCache.hasRightHit = true;
        this.raycastCache.walkwayWidth = leftHits[0].distance + rightHits[0].distance;
        this.raycastCache.leftHitPoint.copy(leftHits[0].point);
        this.raycastCache.rightHitPoint.copy(rightHits[0].point);
      } else {
        this.raycastCache.hasLeftHit = false;
        this.raycastCache.hasRightHit = false;
        this.raycastCache.walkwayWidth = null;
      }

      // D. Closest Wall distance check (Horizontal 360-degree sweep of 8 rays)
      let closestWallDistLocal: number | null = null;
      let closestWallPointLocal: THREE.Vector3 | null = null;
      const directionsCount = 8;

      for (let j = 0; j < directionsCount; j++) {
        const angle = (j / directionsCount) * Math.PI * 2;
        this._sweepDir.set(Math.sin(angle), 0, Math.cos(angle));
        
        this._sweepRay.set(measureOrigin, this._sweepDir);
        const sweepHits = this._sweepRay.intersectObjects(this.collidableMeshes);
        
        if (sweepHits.length > 0) {
          const hit = sweepHits[0];
          const type = hit.object.userData.type;

          if (type === 'wall' || type === 'furniture') {
            if (closestWallDistLocal === null || hit.distance < closestWallDistLocal) {
              closestWallDistLocal = hit.distance;
              if (!closestWallPointLocal) {
                closestWallPointLocal = new THREE.Vector3();
              }
              closestWallPointLocal.copy(hit.point);
            }
          }
        }
      }
      this.raycastCache.closestWallDist = closestWallDistLocal;
      this.raycastCache.closestWallPoint = closestWallPointLocal;

      // E. Dynamic Front-looking raycaster (Crosshair / Eye Ray)
      const frontDir = this._tempV3;
      this.camera.getWorldDirection(frontDir);
      this._frontRay.set(measureOrigin, frontDir);
      const frontHits = this._frontRay.intersectObjects(this.collidableMeshes);
      
      if (frontHits.length > 0) {
        this.raycastCache.hasFrontHit = true;
        this.raycastCache.frontDistance = frontHits[0].distance;
        this.raycastCache.frontHitPoint.copy(frontHits[0].point);
      } else {
        this.raycastCache.hasFrontHit = false;
        this.raycastCache.frontDistance = null;
      }

      // Publish Standardized results inside the same frame
      this.publishResults(timestamp);
    }

    // ----------------------------------------------------
    // 2. SMOOTH VISUAL OVERLAY POSITIONING (At 60 FPS)
    // ----------------------------------------------------
    const is1P = this.settings.viewMode === 'first-person';
    const isMeasureEnabled = this.settings.showMeasureVisualization || is1P;

    if (isMeasureEnabled) {
      this.measureVisGroup.visible = true;

      // 1. Eye Level Above Ground
      if (this.toggles.eyeLevelEnabled && this.raycastCache.eyeLevelAboveGround !== null) {
        if (this.shouldRunRaycastsThisFrame) {
          updateDimensionVisualizer(
            this.visualizers.eyeLevel,
            this.raycastCache.groundHitPoint,
            measureOrigin,
            `眼高淨高 Eye-to-Ground: ${formatDistance(this.raycastCache.eyeLevelAboveGround, this.settings.modelUnit)}`,
            0xf97316,
            this.settings.modelUnit
          );
        } else {
          const lineGeom = this.visualizers.eyeLevel.line.geometry;
          const positions = new Float32Array([
            this.raycastCache.groundHitPoint.x, this.raycastCache.groundHitPoint.y, this.raycastCache.groundHitPoint.z,
            measureOrigin.x, measureOrigin.y, measureOrigin.z
          ]);
          lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          lineGeom.computeBoundingSphere();
          
          const midPoint = this._tempV3.addVectors(this.raycastCache.groundHitPoint, measureOrigin).multiplyScalar(0.5);
          midPoint.x += 0.08; midPoint.z += 0.08;
          this.visualizers.eyeLevel.sprite.position.copy(midPoint);
        }
        this.visualizers.eyeLevel.group.visible = true;
        this.visualizers.eyeLevel.line.visible = !is1P;
        this.visualizers.eyeLevel.arrowSegments.visible = is1P ? false : this.toggles.measureArrowEnabled;
        this.visualizers.eyeLevel.sprite.visible = is1P ? true : this.toggles.dimensionLabelsEnabled;
      } else {
        this.visualizers.eyeLevel.group.visible = false;
      }

      // 2. Eye-to-Ceiling
      if (this.toggles.ceilingHeightEnabled && this.raycastCache.calculatedCeilingHeight !== null) {
        if (this.shouldRunRaycastsThisFrame) {
          updateDimensionVisualizer(
            this.visualizers.ceiling,
            measureOrigin,
            this.raycastCache.ceilingHitPoint,
            `視線至天花板 Eye-to-Ceiling: ${formatDistance(this.raycastCache.calculatedCeilingHeight, this.settings.modelUnit)}`,
            0xf97316,
            this.settings.modelUnit
          );
        } else {
          const lineGeom = this.visualizers.ceiling.line.geometry;
          const positions = new Float32Array([
            measureOrigin.x, measureOrigin.y, measureOrigin.z,
            this.raycastCache.ceilingHitPoint.x, this.raycastCache.ceilingHitPoint.y, this.raycastCache.ceilingHitPoint.z
          ]);
          lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          lineGeom.computeBoundingSphere();

          const midPoint = this._tempV3.addVectors(measureOrigin, this.raycastCache.ceilingHitPoint).multiplyScalar(0.5);
          midPoint.x += 0.08; midPoint.z += 0.08;
          this.visualizers.ceiling.sprite.position.copy(midPoint);
        }
        this.visualizers.ceiling.group.visible = true;
        this.visualizers.ceiling.line.visible = !is1P;
        this.visualizers.ceiling.arrowSegments.visible = is1P ? false : this.toggles.measureArrowEnabled;
        this.visualizers.ceiling.sprite.visible = is1P ? true : this.toggles.dimensionLabelsEnabled;
      } else {
        this.visualizers.ceiling.group.visible = false;
      }

      // 3. Walkway Width
      if (this.toggles.walkwayWidthEnabled && this.raycastCache.walkwayWidth !== null) {
        if (this.shouldRunRaycastsThisFrame) {
          const walkwayColor = this.raycastCache.walkwayWidth < 0.90 ? 0xef4444 : 0x06b6d4;
          updateDimensionVisualizer(
            this.visualizers.walkway,
            this.raycastCache.leftHitPoint,
            this.raycastCache.rightHitPoint,
            `走道寬 Walkway Width: ${formatDistance(this.raycastCache.walkwayWidth, this.settings.modelUnit)}`,
            walkwayColor,
            this.settings.modelUnit
          );
        } else {
          const lineGeom = this.visualizers.walkway.line.geometry;
          const positions = new Float32Array([
            this.raycastCache.leftHitPoint.x, this.raycastCache.leftHitPoint.y, this.raycastCache.leftHitPoint.z,
            this.raycastCache.rightHitPoint.x, this.raycastCache.rightHitPoint.y, this.raycastCache.rightHitPoint.z
          ]);
          lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          lineGeom.computeBoundingSphere();

          const midPoint = this._tempV3.addVectors(this.raycastCache.leftHitPoint, this.raycastCache.rightHitPoint).multiplyScalar(0.5);
          midPoint.y += 0.12; // Offset text above shoulders
          this.visualizers.walkway.sprite.position.copy(midPoint);
        }
        this.visualizers.walkway.group.visible = true;
        this.visualizers.walkway.line.visible = !is1P;
        this.visualizers.walkway.arrowSegments.visible = is1P ? false : this.toggles.measureArrowEnabled;
        this.visualizers.walkway.sprite.visible = is1P ? true : this.toggles.dimensionLabelsEnabled;
      } else {
        this.visualizers.walkway.group.visible = false;
      }

      // 4. Wall Distance
      if (this.toggles.wallDistanceEnabled && this.raycastCache.closestWallDist !== null && this.raycastCache.closestWallPoint !== null) {
        if (this.shouldRunRaycastsThisFrame) {
          const wallDistColor = this.raycastCache.closestWallDist < 0.45 ? 0xef4444 : 0x06b6d4;
          updateDimensionVisualizer(
            this.visualizers.wallDist,
            measureOrigin,
            this.raycastCache.closestWallPoint,
            `最近牆面 Wall Distance: ${formatDistance(this.raycastCache.closestWallDist, this.settings.modelUnit)}`,
            wallDistColor,
            this.settings.modelUnit
          );
        } else {
          const lineGeom = this.visualizers.wallDist.line.geometry;
          const positions = new Float32Array([
            measureOrigin.x, measureOrigin.y, measureOrigin.z,
            this.raycastCache.closestWallPoint.x, this.raycastCache.closestWallPoint.y, this.raycastCache.closestWallPoint.z
          ]);
          lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          lineGeom.computeBoundingSphere();

          const midPoint = this._tempV3.addVectors(measureOrigin, this.raycastCache.closestWallPoint).multiplyScalar(0.5);
          midPoint.y += 0.08;
          this.visualizers.wallDist.sprite.position.copy(midPoint);
        }
        this.visualizers.wallDist.group.visible = true;
        this.visualizers.wallDist.line.visible = !is1P;
        this.visualizers.wallDist.arrowSegments.visible = is1P ? false : this.toggles.measureArrowEnabled;
        this.visualizers.wallDist.sprite.visible = is1P ? true : this.toggles.dimensionLabelsEnabled;
      } else {
        this.visualizers.wallDist.group.visible = false;
      }

      // 5. Eye Ray / Sight Distance
      if (this.toggles.eyeRayEnabled && this.raycastCache.frontDistance !== null && this.raycastCache.frontHitPoint !== null) {
        if (this.shouldRunRaycastsThisFrame) {
          updateDimensionVisualizer(
            this.visualizers.eyeRay,
            measureOrigin,
            this.raycastCache.frontHitPoint,
            `視線距離 Eye Ray: ${formatDistance(this.raycastCache.frontDistance, this.settings.modelUnit)}`,
            0xef4444,
            this.settings.modelUnit
          );
        } else {
          const lineGeom = this.visualizers.eyeRay.line.geometry;
          const positions = new Float32Array([
            measureOrigin.x, measureOrigin.y, measureOrigin.z,
            this.raycastCache.frontHitPoint.x, this.raycastCache.frontHitPoint.y, this.raycastCache.frontHitPoint.z
          ]);
          lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          lineGeom.computeBoundingSphere();

          const midPoint = this._tempV3.addVectors(measureOrigin, this.raycastCache.frontHitPoint).multiplyScalar(0.5);
          midPoint.y += 0.08;
          this.visualizers.eyeRay.sprite.position.copy(midPoint);
        }
        this.visualizers.eyeRay.group.visible = true;
        this.visualizers.eyeRay.line.visible = !is1P;
        this.visualizers.eyeRay.arrowSegments.visible = is1P ? false : this.toggles.measureArrowEnabled;
        this.visualizers.eyeRay.sprite.visible = is1P ? true : this.toggles.dimensionLabelsEnabled;
      } else {
        this.visualizers.eyeRay.group.visible = false;
      }
    } else {
      this.measureVisGroup.visible = false;
    }

    // ----------------------------------------------------
    // 3. DRAW LASER BEAMS / LINES (At 60 FPS)
    // ----------------------------------------------------
    const showLaser = this.settings.showLaserMeasure && !is1P;
    if (showLaser) {
      this.laserGroup.visible = true;

      // Up Laser
      const lineU = this.laserLines.up;
      if (this.raycastCache.hasCeilingHit && this.raycastCache.calculatedCeilingHeight !== null) {
        lineU.visible = true;
        lineU.position.copy(measureOrigin);
        lineU.scale.set(1, this.raycastCache.calculatedCeilingHeight, 1);
      } else {
        lineU.visible = false;
      }

      // Left & Right Shoulder Lasers
      const lineL = this.laserLines.left;
      const lineR = this.laserLines.right;
      if (this.raycastCache.hasLeftHit && this.raycastCache.hasRightHit) {
        lineL.visible = true;
        lineL.position.copy(shoulderOrigin);
        lineL.rotation.z = Math.PI / 2;
        lineL.rotation.y = this.avatarYaw;
        lineL.scale.set(1, this.raycastCache.leftHitPoint.distanceTo(shoulderOrigin), 1);

        lineR.visible = true;
        lineR.position.copy(shoulderOrigin);
        lineR.rotation.z = -Math.PI / 2;
        lineR.rotation.y = this.avatarYaw;
        lineR.scale.set(1, this.raycastCache.rightHitPoint.distanceTo(shoulderOrigin), 1);
      } else {
        lineL.visible = false;
        lineR.visible = false;
      }

      // Front Laser
      const lineF = this.laserLines.front;
      if (this.raycastCache.hasFrontHit && this.raycastCache.frontDistance !== null) {
        lineF.visible = true;
        lineF.position.copy(measureOrigin);
        lineF.lookAt(this.raycastCache.frontHitPoint);
        lineF.rotation.x += Math.PI / 2;
        lineF.scale.set(1, this.raycastCache.frontDistance, 1);
      } else {
        lineF.visible = false;
      }
    } else {
      this.laserGroup.visible = false;
      Object.values(this.laserLines).forEach(line => {
        line.visible = false;
      });
    }
  }

  /**
   * Internal publisher helper to assemble results.
   */
  private publishResults(timestamp: number): void {
    const is1P = this.settings.viewMode === 'first-person';
    const unit = this.settings.modelUnit;

    this.results['eye-level-above-ground'] = {
      name: '眼高淨高 Eye-to-Ground',
      value: this.raycastCache.eyeLevelAboveGround,
      unit,
      status: 'success',
      timestamp,
      extraData: {
        groundHitPoint: this.raycastCache.groundHitPoint
      }
    };

    this.results['ceiling-height'] = {
      name: '視線至天花板 Eye-to-Ceiling',
      value: this.raycastCache.calculatedCeilingHeight ?? 'N/A',
      unit: this.raycastCache.calculatedCeilingHeight !== null ? unit : undefined,
      status: this.raycastCache.calculatedCeilingHeight !== null ? 'success' : 'inactive',
      timestamp
    };

    const width = this.raycastCache.walkwayWidth;
    this.results['walkway-width'] = {
      name: '走道寬 Walkway Width',
      value: width ?? 'N/A',
      unit: width !== null ? unit : undefined,
      status: width !== null ? (width < 0.90 ? 'warning' : 'success') : 'inactive',
      warning: width !== null && width < 0.90 ? '無障礙走道寬度不足 90cm' : undefined,
      timestamp
    };

    this.results['wall-distance'] = {
      name: '最近牆面 Wall Distance',
      value: this.raycastCache.closestWallDist ?? 'N/A',
      unit: this.raycastCache.closestWallDist !== null ? unit : undefined,
      status: this.raycastCache.closestWallDist !== null ? 'success' : 'inactive',
      timestamp,
      extraData: {
        closestWallPoint: this.raycastCache.closestWallPoint
      }
    };

    this.results['eye-ray'] = {
      name: '視線距離 Eye Ray',
      value: this.raycastCache.frontDistance ?? 'N/A',
      unit: this.raycastCache.frontDistance !== null ? unit : undefined,
      status: this.raycastCache.frontDistance !== null ? 'success' : 'inactive',
      timestamp
    };
  }

  public dispose(): void {
    this.onDisable();

    // Clean up Three.js visual assets inside dimension visualizers
    Object.values(this.visualizers).forEach(vis => {
      vis.line.geometry.dispose();
      (vis.line.material as THREE.Material).dispose();
      vis.arrowSegments.geometry.dispose();
      (vis.arrowSegments.material as THREE.Material).dispose();
      vis.sprite.material.dispose();
      vis.texture.dispose();
    });

    // Clean up Lasers
    Object.values(this.laserLines).forEach(line => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    });

    console.log('[SpatialMeasurementEngine] Disposed and memory cleaned.');
  }

  public getResults(): Record<string, AnalysisResult> {
    return this.results;
  }
}
