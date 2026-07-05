/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { AnalysisEngine, EngineMetadata, UpdatePolicy, AnalysisResult, AnalysisContext } from './framework';
import { formatDistance } from '../utils/math';
import { ModelUnit } from '../types';

export interface WindVisualizer {
  group: THREE.Group;
  mainArrow: THREE.ArrowHelper;
  flowArrows: THREE.ArrowHelper[];
  sprite: THREE.Sprite;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  context: CanvasRenderingContext2D;
}

/**
 * Returns a localized wind direction name on a 16-point compass.
 */
function getWindCardinal(angle: number): string {
  const directions = [
    '北風 N', '東北北 NNE', '東北風 NE', '東東北 ENE',
    '東風 E', '東南東 ESE', '東南風 SE', '南南東 SSE',
    '南風 S', '西南南 SSW', '西南風 SW', '西西南 WSW',
    '西風 W', '西北西 WNW', '西北風 NW', '西北北 NNW'
  ];
  const index = Math.round((angle % 360) / 22.5) % 16;
  return directions[index];
}

/**
 * Maps wind velocity to a comfort rating and description.
 */
function getWindComfortRating(speed: number): { rating: string; color: string; colorHex: number; desc: string } {
  if (speed === 0) {
    return { rating: '無風停滯 Stagnant', color: '#ef4444', colorHex: 0xef4444, desc: '空氣停滯悶熱' };
  } else if (speed < 1.0) {
    return { rating: '微弱無風 Stagnant', color: '#f97316', colorHex: 0xf97316, desc: '局部空氣流速低，易感悶熱' };
  } else if (speed < 2.0) {
    return { rating: '輕風微調 Slight', color: '#fbbf24', colorHex: 0xfbbf24, desc: '有些微空氣流通，人體感舒適' };
  } else if (speed < 6.0) {
    return { rating: '優良通風 Excellent', color: '#10b981', colorHex: 0x10b981, desc: '最佳建築通風對流降溫區' };
  } else {
    return { rating: '強風干擾 High Draft', color: '#0ea5e9', colorHex: 0x0ea5e9, desc: '風速偏高，輕質物件易受干涉' };
  }
}

/**
 * Initializes a beautiful Wind Visualizer group including a localized flow arrow array
 * and a double-buffered 2D-in-3D text billboard card.
 */
function initWindVisualizer(): WindVisualizer {
  const group = new THREE.Group();

  // 1. Create central main arrow (facing direction wind is going)
  const defaultDir = new THREE.Vector3(0, 0, 1);
  const defaultPos = new THREE.Vector3(0, 0, 0);
  const mainArrow = new THREE.ArrowHelper(
    defaultDir,
    defaultPos,
    1.5,
    0x10b981, // Emerald green
    0.3,      // headLength
    0.15      // headWidth
  );
  group.add(mainArrow);

  // 2. Create peripheral flow field arrows (5 arrows distributed in a ring)
  const flowArrows: THREE.ArrowHelper[] = [];
  const numFlowArrows = 5;
  for (let i = 0; i < numFlowArrows; i++) {
    const arrow = new THREE.ArrowHelper(
      defaultDir,
      defaultPos,
      0.8,
      0x34d399, // Lighter emerald
      0.18,     // headLength
      0.09      // headWidth
    );
    group.add(arrow);
    flowArrows.push(arrow);
  }

  // 3. High-contrast billboarding text sprite canvas
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
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
  sprite.scale.set(1.0, 0.31, 1);
  group.add(sprite);

  return {
    group,
    mainArrow,
    flowArrows,
    sprite,
    canvas,
    texture,
    context
  };
}

/**
 * Updates the wind visualization components in 3D, computing appropriate scales, colors,
 * and drawing the high-contrast architectural info card.
 */
function updateWindVisualizer(
  vis: WindVisualizer,
  playerPos: THREE.Vector3,
  windDir: THREE.Vector3,
  ambientSpeed: number,
  localSpeed: number,
  windAngle: number,
  blockageDist: number | null,
  obstacleName: string,
  modelUnit: ModelUnit
) {
  const comfort = getWindComfortRating(localSpeed);
  const mainColor = comfort.colorHex;

  // 1. Update main central arrow
  const mainOrigin = new THREE.Vector3(playerPos.x, playerPos.y + 0.8, playerPos.z);
  vis.mainArrow.position.copy(mainOrigin);
  vis.mainArrow.setDirection(windDir);
  
  // Scale length proportionally with local speed (cap at 2.2m for visibility)
  const mainLen = Math.max(0.3, Math.min(2.2, 0.4 + localSpeed * 0.4));
  vis.mainArrow.setLength(mainLen, mainLen * 0.2, mainLen * 0.1);
  vis.mainArrow.setColor(mainColor);

  // 2. Update peripheral flow field arrows (relative to player in a circle)
  const numFlowArrows = vis.flowArrows.length;
  const radius = 1.6; // 1.6 meters radius ring
  for (let i = 0; i < numFlowArrows; i++) {
    const arrow = vis.flowArrows[i];
    const theta = (i / numFlowArrows) * Math.PI * 2;
    
    // Position on ring
    const localOffset = new THREE.Vector3(
      Math.cos(theta) * radius,
      0.8, // waist height
      Math.sin(theta) * radius
    );
    const arrowPos = new THREE.Vector3().addVectors(playerPos, localOffset);
    arrow.position.copy(arrowPos);
    arrow.setDirection(windDir);

    // Minor flow arrows have smaller scale
    const flowLen = mainLen * 0.6;
    arrow.setLength(flowLen, flowLen * 0.22, flowLen * 0.11);
    arrow.setColor(mainColor);
  }

  // 3. Render HUD card text on the sprite canvas
  const ctx = vis.context;
  const canvas = vis.canvas;

  const titleFont = 'bold 11px "Inter", "Microsoft JhengHei", sans-serif';
  const dataFont = 'bold 13px "JetBrains Mono", "Microsoft JhengHei", monospace';
  const descFont = '10px "Inter", "Microsoft JhengHei", sans-serif';

  // Measure text widths for layout
  ctx.font = titleFont;
  const t1Width = ctx.measureText('環境風速 AMBIENT').width;
  ctx.font = dataFont;
  const d1Width = ctx.measureText(`${ambientSpeed.toFixed(1)} m/s (${getWindCardinal(windAngle)})`).width;
  ctx.font = descFont;
  const descWidth = ctx.measureText(comfort.desc).width;

  const maxTextWidth = Math.max(t1Width, d1Width, descWidth, 140);
  const paddingX = 14;
  const paddingY = 8;
  const borderThickness = 3;

  const bgWidth = maxTextWidth + paddingX * 2;
  const bgHeight = 68; // Fitted height

  const dpr = 2;
  canvas.width = bgWidth * dpr;
  canvas.height = bgHeight * dpr;

  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, bgWidth, bgHeight);

  // Draw elegant translucent glass card backplate
  ctx.fillStyle = 'rgba(20, 20, 23, 0.9)';
  ctx.strokeStyle = comfort.color;
  ctx.lineWidth = borderThickness;

  const r = 6;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(borderThickness / 2, borderThickness / 2, bgWidth - borderThickness, bgHeight - borderThickness, r);
  } else {
    const x = borderThickness / 2;
    const y = borderThickness / 2;
    const w = bgWidth - borderThickness;
    const h = bgHeight - borderThickness;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Line 1: Title (Ambient and Wind Dir)
  ctx.fillStyle = '#a1a1aa'; // Zinc-400
  ctx.font = titleFont;
  ctx.fillText(`環境風場: ${getWindCardinal(windAngle)}`, bgWidth / 2, paddingY);

  // Line 2: Values (Ambient Speed -> Local Speed)
  ctx.fillStyle = '#ffffff';
  ctx.font = dataFont;
  ctx.fillText(`實測體感: ${localSpeed.toFixed(1)} m/s`, bgWidth / 2, paddingY + 14);

  // Line 3: Comfort Rating Status
  ctx.fillStyle = comfort.color;
  ctx.font = 'bold 11px "Inter", "Microsoft JhengHei", sans-serif';
  ctx.fillText(comfort.rating, bgWidth / 2, paddingY + 30);

  // Line 4: Descriptive info (Blockage indicator)
  ctx.fillStyle = '#78716c'; // Stone-500
  ctx.font = descFont;
  const obstacleMsg = blockageDist !== null 
    ? `受 ${obstacleName} 遮蔽 (${formatDistance(blockageDist, modelUnit)})` 
    : comfort.desc;
  ctx.fillText(obstacleMsg, bgWidth / 2, paddingY + 44);

  vis.texture.needsUpdate = true;

  // Scale relative to actual width/height
  const scaleFactor = 0.0035;
  vis.sprite.scale.set(bgWidth * scaleFactor, bgHeight * scaleFactor, 1);

  // Position the label slightly above the player's head for high legibility
  vis.sprite.position.set(playerPos.x, playerPos.y + 1.8, playerPos.z);
}

/**
 * WindEngine evaluates wind flow, processes upwind/downwind building blockages using raycasts,
 * and renders localized 3D fluid field vectors in real time.
 */
export class WindEngine implements AnalysisEngine {
  public readonly metadata: EngineMetadata = {
    name: 'wind-engine',
    version: '1.0.0',
    category: 'wind',
    priority: 40, // Player(10) -> Solar(20) -> Measure(30) -> Wind(40) -> HUD(50)
    updatePolicy: UpdatePolicy.Always,
    dependencies: []
  };

  private _isEnabled: boolean = false;
  private scene!: THREE.Scene;
  private results: Record<string, AnalysisResult> = {};

  // Three.js visualizer group
  public windGroup = new THREE.Group();
  private visualizer!: WindVisualizer;

  // Reusable raycasters and vectors to maintain Zero Allocation performance
  private readonly _windRayUp = new THREE.Raycaster();
  private readonly _windRayDown = new THREE.Raycaster();
  private readonly _rayOrigin = new THREE.Vector3();
  private readonly _windFlowDir = new THREE.Vector3();
  private readonly _upwindDir = new THREE.Vector3();

  public get isEnabled(): boolean {
    return this._isEnabled;
  }

  public initialize(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer): void {
    this.scene = scene;

    // Create and configure visualizer
    this.visualizer = initWindVisualizer();
    this.windGroup.add(this.visualizer.group);
    this.visualizer.group.visible = false;
  }

  public onEnable(): void {
    this._isEnabled = true;
    if (this.scene) {
      this.scene.add(this.windGroup);
    }
    console.log('[WindEngine] Enabled and added to scene.');
  }

  public onDisable(): void {
    this._isEnabled = false;
    if (this.scene) {
      this.scene.remove(this.windGroup);
    }
    this.results = {};
    console.log('[WindEngine] Disabled and removed from scene.');
  }

  public update(context: AnalysisContext): void {
    if (!this._isEnabled) return;

    const { player, colliders, settings, timestamp } = context;
    const modelUnit: ModelUnit = settings.modelUnit || 'm';

    // If wind analysis is toggled off, hide visuals, clear results, and return early
    if (!settings.showWindAnalysis) {
      if (this.visualizer) {
        this.visualizer.group.visible = false;
      }
      this.results = {};
      return;
    }

    // 1. Get wind settings from the context
    // Default to speed=3.0 m/s, direction=170° if not provided
    const windSpeed = context.analysisSettings.wind?.speed ?? 3.0;
    const windAngle = context.analysisSettings.wind?.angle ?? 170;

    // 2. Compute wind direction vectors in coordinate space
    // Account for True North offset: positive X is East, negative Z is North
    const modelNorthRad = (settings.modelNorth || 0) * (Math.PI / 180);
    const relativeAngleRad = (windAngle - (settings.modelNorth || 0)) * (Math.PI / 180);

    // Wind blows TOWARDS:
    // W_dir.x = -Math.sin(relativeAngleRad)
    // W_dir.z = Math.cos(relativeAngleRad)
    this._windFlowDir.set(
      -Math.sin(relativeAngleRad),
      0,
      Math.cos(relativeAngleRad)
    ).normalize();

    // Upwind points directly opposite (toward the wind source)
    this._upwindDir.copy(this._windFlowDir).multiplyScalar(-1);

    // 3. Analyze building blockages with upwind/downwind raycasts
    // Origin is at player's chest/waist height (0.8m)
    this._rayOrigin.set(player.position.x, player.position.y + 0.8, player.position.z);

    let isBlocked = false;
    let blockageDist: number | null = null;
    let obstacleName = '';

    if (windSpeed > 0 && colliders.length > 0) {
      // Ray 1: UPWIND block check (has wall/obstacle in front of incoming wind)
      this._windRayUp.set(this._rayOrigin, this._upwindDir);
      this._windRayUp.far = 25; // Search within 25 meters
      const intersectionsUp = this._windRayUp.intersectObjects(colliders, true);

      let bUp = 0;
      let dUp: number | null = null;
      let nameUp = '';

      if (intersectionsUp.length > 0) {
        const hit = intersectionsUp[0];
        dUp = hit.distance;
        const node = hit.object;
        nameUp = node.userData.type ? String(node.userData.type) : (node.name || 'Structure');

        // Blockage factor: 90% (0.9) if < 1.0m, scaling linearly down to 0% at 20m
        if (dUp < 1.0) {
          bUp = 0.9;
        } else if (dUp < 5.0) {
          bUp = 0.9 - 0.5 * (dUp - 1.0) / 4.0; // scales from 0.9 down to 0.4
        } else if (dUp < 20.0) {
          bUp = 0.4 - 0.4 * (dUp - 5.0) / 15.0; // scales from 0.4 down to 0.0
        }
      }

      // Ray 2: DOWNWIND block check (has wall directly behind creating stagnant pocket)
      this._windRayDown.set(this._rayOrigin, this._windFlowDir);
      this._windRayDown.far = 5; // Close pocket search
      const intersectionsDown = this._windRayDown.intersectObjects(colliders, true);

      let bDown = 0;
      let dDown: number | null = null;
      let nameDown = '';

      if (intersectionsDown.length > 0) {
        const hit = intersectionsDown[0];
        dDown = hit.distance;
        const node = hit.object;
        nameDown = node.userData.type ? String(node.userData.type) : (node.name || 'Structure');

        // Strong blockage if dead end is closer than 3 meters
        if (dDown < 1.5) {
          bDown = 0.8;
        } else if (dDown < 4.0) {
          bDown = 0.8 - 0.6 * (dDown - 1.5) / 2.5; // scales from 0.8 down to 0.2
        }
      }

      // Integrate final blockage factors
      const maxBlockage = Math.max(bUp, bDown);
      if (maxBlockage > 0.15) {
        isBlocked = true;
        // Use the closer distance/object name
        if (bUp >= bDown) {
          blockageDist = dUp;
          obstacleName = nameUp;
        } else {
          blockageDist = dDown;
          obstacleName = nameDown;
        }
      }

      // Apply blockage reduction to compute Local Wind Speed
      const localSpeed = windSpeed * (1.0 - maxBlockage);

      // 4. Update 3D visualization and HUD label card
      const showViz = settings.showWindAnalysis ?? true;
      if (showViz) {
        this.visualizer.group.visible = true;
        updateWindVisualizer(
          this.visualizer,
          player.position,
          this._windFlowDir,
          windSpeed,
          localSpeed,
          windAngle,
          blockageDist,
          obstacleName,
          modelUnit
        );
      } else {
        this.visualizer.group.visible = false;
      }

      // 5. Build Unified Analysis Results
      const comfort = getWindComfortRating(localSpeed);
      
      this.results['wind-ambient-speed'] = {
        name: '環境風速 (Ambient Wind Speed)',
        value: windSpeed.toFixed(1),
        unit: 'm/s',
        status: windSpeed === 0 ? 'inactive' : 'success',
        timestamp
      };

      this.results['wind-ambient-direction'] = {
        name: '環境風向 (Ambient Wind Direction)',
        value: getWindCardinal(windAngle),
        unit: `(${windAngle}°/Azimuth)`,
        status: windSpeed === 0 ? 'inactive' : 'success',
        timestamp
      };

      this.results['wind-local-speed'] = {
        name: '體感風速 (Local Wind Speed)',
        value: localSpeed.toFixed(1),
        unit: 'm/s',
        status: localSpeed < 1.0 ? 'warning' : 'success',
        warning: localSpeed < 1.0 ? `局部流速低，易生悶熱角落 (${comfort.rating})` : undefined,
        timestamp,
        extraData: {
          blockageDist,
          obstacleName,
          isBlocked
        }
      };

      this.results['wind-comfort-rating'] = {
        name: '通風效益評估 (Ventilation Rating)',
        value: comfort.rating,
        status: localSpeed < 1.0 ? 'warning' : (localSpeed > 6.0 ? 'warning' : 'success'),
        warning: localSpeed < 1.0 ? '局部死角空氣交換緩慢' : (localSpeed > 6.0 ? '廊道強風，干擾戶外活動' : undefined),
        timestamp
      };
    } else {
      // Wind speed is 0
      this.visualizer.group.visible = false;
      this.results['wind-ambient-speed'] = {
        name: '環境風速 (Ambient Wind Speed)',
        value: '0.0',
        unit: 'm/s',
        status: 'inactive',
        timestamp
      };
      this.results['wind-ambient-direction'] = {
        name: '環境風向 (Ambient Wind Direction)',
        value: '無風狀態 (Calm)',
        status: 'inactive',
        timestamp
      };
      this.results['wind-local-speed'] = {
        name: '體感風速 (Local Wind Speed)',
        value: '0.0',
        unit: 'm/s',
        status: 'inactive',
        timestamp
      };
      this.results['wind-comfort-rating'] = {
        name: '通風效益評估 (Ventilation Rating)',
        value: '無風停滯 Stagnant',
        status: 'warning',
        warning: '當前無風流通，微氣候停滯悶熱',
        timestamp
      };
    }
  }

  public onSettingsChanged(settings: any): void {
    // Dynamic settings cache if needed
  }

  public dispose(): void {
    this.onDisable();
    // Dispose resources to avoid WebGL memory leaks
    if (this.visualizer) {
      this.visualizer.mainArrow.dispose();
      this.visualizer.flowArrows.forEach(arrow => arrow.dispose());
      (this.visualizer.sprite.material as THREE.Material).dispose();
      this.visualizer.texture.dispose();
    }
    console.log('[WindEngine] Disposed and cleaned up WebGL resources.');
  }

  public getResults(): Record<string, AnalysisResult> {
    return this.results;
  }
}
