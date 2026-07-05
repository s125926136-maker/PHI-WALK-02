/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { AnalysisEngine, EngineMetadata, UpdatePolicy, AnalysisResult, AnalysisContext } from './framework';
import { computeSolarPosition, formatToDMS } from '../utils/solarCalculator';
import { formatDistance } from '../utils/math';

export interface SolarVisualizer {
  group: THREE.Group;
  line: THREE.Line;
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  context: CanvasRenderingContext2D;
}

/**
 * Initializes a highly refined, double-buffered 2D-in-3D text billboard and ray line
 * specifically tuned for solar light path and shadow obstruction visualization.
 */
function initSolarVisualizer(colorHex: number): SolarVisualizer {
  const group = new THREE.Group();

  // Create solar ray line
  const lineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0)
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    linewidth: 2,
    depthWrite: false,
    depthTest: true
  });
  const line = new THREE.Line(lineGeom, lineMat);
  group.add(line);

  // High-contrast billboarding text sprite canvas
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    depthWrite: false,
    depthTest: true,
    transparent: true
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(1.0, 0.25, 1);
  group.add(sprite);

  return {
    group,
    line,
    sprite,
    canvas,
    texture,
    context
  };
}

/**
 * Updates the 3D solar visualizer geometry, line colors, and draws a beautiful,
 * high-contrast architectural HUD label card onto the text sprite.
 */
function updateSolarVisualizer(
  vis: SolarVisualizer,
  origin: THREE.Vector3,
  target: THREE.Vector3,
  text: string,
  colorHex: number,
  isObstructed: boolean,
  isNight: boolean
) {
  if (isNight) {
    vis.group.visible = false;
    return;
  }

  vis.group.visible = true;

  // 1. Update direct light/shadow path line geometry
  const lineGeom = vis.line.geometry;
  const positions = new Float32Array([
    origin.x, origin.y, origin.z,
    target.x, target.y, target.z
  ]);
  lineGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  lineGeom.computeBoundingSphere();
  lineGeom.computeBoundingBox();

  // Update line color dynamically
  (vis.line.material as THREE.LineBasicMaterial).color.setHex(colorHex);

  // 2. Draw card-style text on the sprite canvas
  const ctx = vis.context;
  const canvas = vis.canvas;

  let title = text;
  let subtitle = '';
  const parts = text.split(': ');
  if (parts.length > 1) {
    title = parts[0];
    subtitle = parts[1];
  }

  const titleFont = 'bold 11px "Inter", "Microsoft JhengHei", sans-serif';
  const subtitleFont = 'bold 14px "JetBrains Mono", "Microsoft JhengHei", monospace';

  ctx.font = titleFont;
  const titleWidth = ctx.measureText(title).width;

  let subtitleWidth = 0;
  if (subtitle) {
    ctx.font = subtitleFont;
    subtitleWidth = ctx.measureText(subtitle).width;
  }

  const maxTextWidth = Math.max(titleWidth, subtitleWidth);
  const paddingX = 14;
  const paddingY = 8;
  const borderThickness = 3;

  const bgWidth = Math.max(130, maxTextWidth + paddingX * 2);
  const lineSpacing = 4;
  const titleHeight = 13;
  const subtitleHeight = 15;
  const bgHeight = paddingY * 2 + titleHeight + (subtitle ? (lineSpacing + subtitleHeight) : 0);

  const dpr = 2;
  canvas.width = bgWidth * dpr;
  canvas.height = bgHeight * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, bgWidth, bgHeight);

  // Beautiful translucent dark glass background
  ctx.fillStyle = 'rgba(24, 24, 27, 0.88)';
  ctx.strokeStyle = '#' + colorHex.toString(16).padStart(6, '0');
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

  // Draw Title
  ctx.fillStyle = isObstructed ? '#a1a1aa' : '#fef08a'; // Zinc-400 or Yellow-200
  ctx.font = titleFont;
  ctx.fillText(title, bgWidth / 2, paddingY);

  // Draw Subtitle
  if (subtitle) {
    ctx.fillStyle = '#ffffff';
    ctx.font = subtitleFont;
    ctx.fillText(subtitle, bgWidth / 2, paddingY + titleHeight + lineSpacing);
  }

  vis.texture.needsUpdate = true;

  // Scale relative to background dimensions
  const scaleFactor = 0.0035;
  vis.sprite.scale.set(bgWidth * scaleFactor, bgHeight * scaleFactor, 1);

  // Place sprite billboard at the midpoint of the raycast segment
  const midPoint = new THREE.Vector3().addVectors(origin, target).multiplyScalar(0.5);
  // Float text slightly upwards to avoid overlapping the line
  midPoint.y += 0.15;
  vis.sprite.position.copy(midPoint);
}

/**
 * SolarEngine manages astronomical sun tracking, True North orientation correction,
 * real-time raycasted shadow obstruction analysis, and interactive 3D solar visualization.
 */
export class SolarEngine implements AnalysisEngine {
  public readonly metadata: EngineMetadata = {
    name: 'solar-engine',
    version: '1.0.0',
    category: 'solar',
    priority: 20, // Lower numbers run earlier: Player(10) -> Solar(20) -> Measure(30)
    updatePolicy: UpdatePolicy.Always,
    dependencies: []
  };

  private _isEnabled: boolean = false;
  private scene!: THREE.Scene;
  private results: Record<string, AnalysisResult> = {};

  // Three.js visualizer group
  public solarGroup = new THREE.Group();
  private visualizer!: SolarVisualizer;

  // Reusable raycaster and mathematical structures to avoid garbage collection overhead
  private readonly _solarRay = new THREE.Raycaster();
  private readonly _tempOrigin = new THREE.Vector3();
  private readonly _tempTarget = new THREE.Vector3();
  private readonly _sunDirection = new THREE.Vector3();

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  public initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.scene = scene;

    // Initialize the visualizer
    this.visualizer = initSolarVisualizer(0xf59e0b); // Golden amber
    this.solarGroup.add(this.visualizer.group);
    this.visualizer.group.visible = false;
  }

  public onEnable(): void {
    this._isEnabled = true;
    if (this.scene) {
      this.scene.add(this.solarGroup);
    }
    console.log('[SolarEngine] Enabled and added to scene.');
  }

  public onDisable(): void {
    this._isEnabled = false;
    if (this.scene) {
      this.scene.remove(this.solarGroup);
    }
    this.results = {};
    console.log('[SolarEngine] Disabled and removed from scene.');
  }

  public update(context: AnalysisContext): void {
    if (!this._isEnabled) return;

    // 1. Get current physical settings and player position
    const { player, colliders, settings, timestamp } = context;
    const modelUnit = settings.modelUnit || 'm';

    // Parse current date and time
    const [year, month, day] = settings.analysisDate.split('-').map(Number);
    const [hour, minute] = settings.analysisTime.split(':').map(Number);
    const timezone = settings.timezone ?? 8;

    // Local Date object represented as UTC to feed the offline calculator
    const targetDate = new Date(Date.UTC(year, month - 1, day, hour - timezone, minute));

    // Calculate astronomical solar coordinates
    const solar = computeSolarPosition(
      targetDate,
      settings.latitude,
      settings.longitude,
      timezone
    );

    const altitude = solar.altitude;
    const azimuth = solar.azimuth;
    const isNight = altitude <= 0;

    // Convert angles to degrees for display
    const altDeg = altitude * (180 / Math.PI);
    const azDeg = azimuth * (180 / Math.PI);

    // Apply True North offset correction to obtain correct local coordinate directions
    const modelNorthRad = (settings.modelNorth || 0) * (Math.PI / 180);
    const relativeAzimuth = azimuth - modelNorthRad;

    // Compute the exact 3D solar direction vector (Y is Up, Z is South/North, X is East/West)
    const cosAlt = Math.cos(altitude);
    this._sunDirection.set(
      Math.sin(relativeAzimuth) * cosAlt,
      Math.sin(altitude),
      -Math.cos(relativeAzimuth) * cosAlt
    ).normalize();

    // 2. Perform Sun Path Obstruction Analysis
    // Ray originates from player's eye level
    const eyeHeight = player.eyeHeight;
    this._tempOrigin.set(player.position.x, player.position.y + eyeHeight, player.position.z);

    let isObstructed = false;
    let obstructionDist: number | null = null;
    let obstructionName = '';

    if (!isNight && colliders.length > 0) {
      this._solarRay.set(this._tempOrigin, this._sunDirection);
      
      // Limit ray distance to a reasonable architectural range (120 meters)
      this._solarRay.far = 120;
      const intersections = this._solarRay.intersectObjects(colliders, true);

      if (intersections.length > 0) {
        // Direct sunlight is blocked!
        isObstructed = true;
        const hit = intersections[0];
        obstructionDist = hit.distance;
        
        // Save hit point in target
        this._tempTarget.copy(hit.point);

        // Deduce obstruction category or element name
        const node = hit.object;
        const type = node.userData.type;
        obstructionName = type ? String(type) : (node.name || 'Structure');
      }
    }

    // If there is no obstruction, draw an infinite/far-reaching solar vector line (e.g. 15 meters) for visual guidance
    if (!isObstructed) {
      this._tempTarget.copy(this._tempOrigin).addScaledVector(this._sunDirection, 15);
    }

    // 3. Render/Update 3D Visualizer Line & HUD Card
    const showViz = settings.showMeasureVisualization ?? true;
    if (showViz && !isNight) {
      const colorHex = isObstructed ? 0x78716c : 0xf59e0b; // Slate-500 (obstructed) or Amber-500 (sunlit)
      const text = isObstructed
        ? `日照遮蔽 Obstructed: ${formatDistance(obstructionDist ?? 0, modelUnit)}`
        : `日照直射 Direct Sun: OK`;

      updateSolarVisualizer(
        this.visualizer,
        this._tempOrigin,
        this._tempTarget,
        text,
        colorHex,
        isObstructed,
        false
      );
    } else {
      this.visualizer.group.visible = false;
    }

    // 4. Formulate Unified Analysis Results for HUD Panel & Telemetry
    this.results['sun-altitude'] = {
      name: '太陽仰角 (Sun Altitude)',
      value: isNight ? '已落入地平線' : altDeg.toFixed(1),
      unit: isNight ? undefined : '°',
      status: isNight ? 'inactive' : 'success',
      timestamp
    };

    this.results['sun-azimuth'] = {
      name: '太陽方位角 (Sun Azimuth)',
      value: azDeg.toFixed(1),
      unit: '°',
      status: isNight ? 'inactive' : 'success',
      timestamp,
      extraData: {
        rawAzimuth: azimuth,
        relativeAzimuth,
        modelNorth: settings.modelNorth || 0
      }
    };

    this.results['solar-exposure'] = {
      name: '日照直射狀態 (Solar Exposure)',
      value: isNight ? '夜間無日照 (Night)' : (isObstructed ? '遮蔽 (Obstructed)' : '直射 (Direct)'),
      status: isNight ? 'inactive' : (isObstructed ? 'warning' : 'success'),
      warning: (!isNight && isObstructed) ? `受周圍建築遮蔽 (Obstructed by ${obstructionName})` : undefined,
      timestamp
    };

    this.results['solar-obstruction'] = {
      name: '最近遮蔽物 (Obstruction)',
      value: isNight ? 'N/A' : (isObstructed && obstructionDist !== null ? `${formatDistance(obstructionDist, modelUnit)} (${obstructionName})` : '無遮蔽 (None)'),
      status: isNight ? 'inactive' : (isObstructed ? 'warning' : 'success'),
      timestamp,
      extraData: {
        isObstructed,
        distance: obstructionDist,
        objectName: obstructionName,
        hitPoint: isObstructed ? this._tempTarget.clone() : null
      }
    };
  }

  public onSettingsChanged(settings: any): void {
    // Synchronize local settings cache if needed
  }

  public dispose(): void {
    this.onDisable();
    // Dispose geometries and materials
    if (this.visualizer) {
      this.visualizer.line.geometry.dispose();
      (this.visualizer.line.material as THREE.Material).dispose();
      (this.visualizer.sprite.material as THREE.Material).dispose();
      this.visualizer.texture.dispose();
    }
    console.log('[SolarEngine] Disposed and cleaned up WebGL resources.');
  }

  public getResults(): Record<string, AnalysisResult> {
    return this.results;
  }
}
