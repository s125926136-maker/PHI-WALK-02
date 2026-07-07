/**
 * Benchmark Runner
 * Programmatically runs the performance suite across the seven specified scenarios,
 * recording metrics, Three.js engine diagnostics, scene graph complexity, and raycaster counts.
 */

import * as THREE from 'three';
import { engineServices } from './EngineServices';
import { CollisionSystem } from './CollisionSystem';
import { CharacterController } from './CharacterController';
import { CameraController } from './CameraController';
import { SpatialMeasurementEngine } from '../analysis/measure';
import { SolarEngine } from '../analysis/solar';
import { WindEngine } from '../analysis/wind';
import { PerformanceProfiler } from './PerformanceProfiler';
import {
  BenchmarkReport,
  ScenarioBenchmarkResult,
  ScenarioMetrics,
  SubsystemTimings,
  ThreeJsMetrics,
  SceneMetrics,
  RaycasterMetrics,
  exportToJson,
  compareBenchmarks,
  generateMarkdownReport,
  generateRegressionMarkdown,
  PerformanceRegressionReport
} from './BenchmarkReport';
import { buildApartment, buildGallery, buildInteractiveCorridor } from '../proceduralSpaces';

// Raycaster count tracker
export class RaycasterTracker {
  public static counts = {
    total: 0,
    ground: 0,
    collision: 0,
    measurement: 0,
    camera: 0,
    solar: 0,
    wind: 0
  };

  private static originalIntersectObjects: any = null;
  private static originalIntersectObject: any = null;
  private static hooked = false;

  public static hook(): void {
    if (this.hooked) return;
    this.hooked = true;

    this.originalIntersectObjects = THREE.Raycaster.prototype.intersectObjects;
    this.originalIntersectObject = THREE.Raycaster.prototype.intersectObject;

    const self = this;

    THREE.Raycaster.prototype.intersectObjects = function (this: THREE.Raycaster, ...args: any[]) {
      self.recordCast(this);
      return self.originalIntersectObjects.apply(this, args);
    };

    THREE.Raycaster.prototype.intersectObject = function (this: THREE.Raycaster, ...args: any[]) {
      self.recordCast(this);
      return self.originalIntersectObject.apply(this, args);
    };
  }

  public static unhook(): void {
    if (!this.hooked) return;
    this.hooked = false;
    THREE.Raycaster.prototype.intersectObjects = this.originalIntersectObjects;
    THREE.Raycaster.prototype.intersectObject = this.originalIntersectObject;
  }

  public static reset(): void {
    this.counts.total = 0;
    this.counts.ground = 0;
    this.counts.collision = 0;
    this.counts.measurement = 0;
    this.counts.camera = 0;
    this.counts.solar = 0;
    this.counts.wind = 0;
  }

  private static recordCast(raycaster: THREE.Raycaster): void {
    this.counts.total++;

    // Classify based on the current active subsystem of the PerformanceProfiler
    const active = PerformanceProfiler.getActiveSubsystem();
    if (active === 'Collision') {
      this.counts.collision++;
    } else if (active === 'Camera') {
      this.counts.camera++;
    } else if (active === 'Measurement') {
      this.counts.measurement++;
    } else if (active === 'Solar') {
      this.counts.solar++;
    } else if (active === 'Wind') {
      this.counts.wind++;
    } else if (active === 'Character' || active === 'Physics' || active === 'SimulationLoop') {
      // Differentiate ground ray versus wall ray using direction
      if (Math.abs(raycaster.ray.direction.y + 1) < 0.1) {
        this.counts.ground++;
      } else {
        this.counts.collision++;
      }
    } else {
      // Default fallback classification based on direction vector
      if (Math.abs(raycaster.ray.direction.y + 1) < 0.1) {
        this.counts.ground++;
      } else {
        this.counts.collision++;
      }
    }
  }
}

/**
 * Custom procedural builders for the uploaded and empty scenarios
 */

function buildEmptyScene(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Empty Scene (空場景)';

  // Minimal floor
  const floorGeom = new THREE.PlaneGeometry(50, 50);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  scene.add(group);
  return group;
}

function buildSmallGLBScene(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Uploaded Small GLB (小型匯入模型)';

  // 5 high-polygon spheres to simulate a small detailed asset
  for (let i = 0; i < 5; i++) {
    const geom = new THREE.SphereGeometry(1.0, 32, 32); // ~2000 polygons
    const mat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.4 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((i - 2) * 3, 1.0, -4);
    mesh.castShadow = true;
    group.add(mesh);
  }

  scene.add(group);
  return group;
}

function buildMediumGLBScene(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Uploaded Medium GLB (中型匯入模型)';

  // 20 detailed Torus Knots to represent complex geometry, with procedural textures
  for (let i = 0; i < 20; i++) {
    const geom = new THREE.TorusKnotGeometry(0.8, 0.24, 64, 16); // ~4000 triangles each

    // Canvas-based checkerboard texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = `hsl(${(i * 18) % 360}, 80%, 50%)`;
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillRect(64, 64, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: texture,
      roughness: 0.25,
      metalness: 0.2
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(
      (i % 5 - 2) * 4,
      1.2,
      -8 - Math.floor(i / 5) * 4
    );
    mesh.castShadow = true;
    group.add(mesh);
  }

  scene.add(group);
  return group;
}

function buildLargeBIMScene(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Uploaded Large BIM (大型 BIM 結構)';

  const columnGeom = new THREE.BoxGeometry(0.4, 6.0, 0.4);
  const wallGeom = new THREE.BoxGeometry(8.0, 6.0, 0.25);
  const columnMat = new THREE.MeshStandardMaterial({ color: 0xdde2eb, roughness: 0.7 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85, transparent: true, opacity: 0.9 });

  // Grid of columns and partitions
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      const col = new THREE.Mesh(columnGeom, columnMat);
      col.position.set(x * 6.0, 3.0, z * 6.0);
      col.castShadow = true;
      group.add(col);

      if (x < 3) {
        const wall = new THREE.Mesh(wallGeom, wallMat);
        wall.position.set(x * 6.0 + 3.0, 3.0, z * 6.0);
        wall.castShadow = true;
        group.add(wall);
      }
    }
  }

  // Instanced light fittings (80 light meshes)
  const bulbGeom = new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, metalness: 0.9, roughness: 0.1 });
  const instancedMesh = new THREE.InstancedMesh(bulbGeom, bulbMat, 80);

  const dummy = new THREE.Object3D();
  let count = 0;
  for (let x = -4; x < 4; x++) {
    for (let z = -5; z < 5; z++) {
      dummy.position.set(x * 5.0, 5.9, z * 4.5);
      dummy.updateMatrix();
      instancedMesh.setMatrixAt(count++, dummy.matrix);
    }
  }
  instancedMesh.instanceMatrix.needsUpdate = true;
  group.add(instancedMesh);

  scene.add(group);
  return group;
}

/**
 * Gathers complete metrics from the current scene graph structure
 */
function gatherSceneMetrics(scene: THREE.Scene): SceneMetrics {
  let meshCount = 0;
  let triangleCount = 0;
  let lightCount = 0;
  let shadowCasters = 0;
  let transparentObjects = 0;
  let instancedObjects = 0;

  const materialsSet = new Set<THREE.Material>();
  const texturesSet = new Set<THREE.Texture>();

  scene.traverse((obj) => {
    if (obj instanceof THREE.Light) {
      lightCount++;
    }
    if (obj.castShadow) {
      shadowCasters++;
    }

    if (obj instanceof THREE.Mesh) {
      meshCount++;

      if (obj instanceof THREE.InstancedMesh) {
        instancedObjects++;
      }

      const geom = obj.geometry;
      if (geom) {
        let tri = 0;
        if (geom.index) {
          tri = geom.index.count / 3;
        } else if (geom.attributes.position) {
          tri = geom.attributes.position.count / 3;
        }

        if (obj instanceof THREE.InstancedMesh) {
          tri *= obj.count;
        }
        triangleCount += Math.round(tri);
      }

      const mat = obj.material;
      if (mat) {
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
          materialsSet.add(m);
          if (m.transparent) {
            transparentObjects++;
          }

          // Scan material properties for textures
          for (const key of Object.keys(m)) {
            const val = (m as any)[key];
            if (val && val.isTexture) {
              texturesSet.add(val);
            }
          }
        }
      }
    }
  });

  return {
    meshCount,
    triangleCount,
    materialCount: materialsSet.size,
    textureCount: texturesSet.size,
    lightCount,
    shadowCasters,
    transparentObjects,
    instancedObjects
  };
}

function disposeBenchmarkSceneResources(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) {
      return;
    }

    if (obj.geometry) {
      geometries.add(obj.geometry);
    }

    const materialList = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materialList) {
      if (!material) {
        continue;
      }

      materials.add(material);

      for (const key of Object.keys(material)) {
        const value = (material as unknown as Record<string, unknown>)[key];
        if (value instanceof THREE.Texture) {
          textures.add(value);
        }
      }
    }
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
  scene.clear();
}

export class BenchmarkRunner {
  /**
   * Run full programmatic benchmark suite
   */
  public static async runBenchmarks(frameCount: number = 50): Promise<{
    report: BenchmarkReport;
    markdown: string;
    regressionReport: PerformanceRegressionReport | null;
    regressionMarkdown: string | null;
  }> {
    // Enable performance profiling
    PerformanceProfiler.enable();

    // Hook raycasters
    RaycasterTracker.hook();

    // Setup offscreen canvas and renderer
    const canvas = document.createElement('canvas');
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      precision: 'mediump'
    });
    renderer.setSize(800, 600);

    const scenarios = [
      { name: '1. Empty Scene', builder: buildEmptyScene },
      { name: '2. Apartment', builder: (s: THREE.Scene) => buildApartment(s) },
      { name: '3. Gallery', builder: (s: THREE.Scene) => buildGallery(s) },
      { name: '4. Corridor', builder: (s: THREE.Scene) => buildInteractiveCorridor(s, 1.8, 2.7) },
      { name: '5. Uploaded Small GLB', builder: buildSmallGLBScene },
      { name: '6. Uploaded Medium GLB', builder: buildMediumGLBScene },
      { name: '7. Uploaded Large BIM', builder: buildLargeBIMScene }
    ];

    const results: ScenarioBenchmarkResult[] = [];

    for (const sc of scenarios) {
      // 1. Scene & Setup
      const scene = new THREE.Scene();

      // Add lights
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
      scene.add(hemiLight);

      const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
      dirLight.position.set(5, 10, 5);
      dirLight.castShadow = true;
      scene.add(dirLight);

      // Populate scenario meshes
      sc.builder(scene);

      // Gather collidables
      const collidables: THREE.Object3D[] = [];
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          collidables.push(obj);
        }
      });

      // 2. Setup engines
      const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 100);
      const collisionSystem = new CollisionSystem();
      const characterController = new CharacterController(collisionSystem);
      const cameraController = new CameraController('first-person');

      const measureEngine = new SpatialMeasurementEngine();
      const solarEngine = new SolarEngine();
      const windEngine = new WindEngine();

      measureEngine.initialize(scene, camera, renderer);
      solarEngine.initialize(scene, camera, renderer);
      windEngine.initialize(scene, camera, renderer);

      // 3. Warmup frames to settle shaders and GC
      for (let w = 0; w < 5; w++) {
        renderer.render(scene, camera);
      }

      // 4. Reset diagnostics trackers
      RaycasterTracker.reset();
      PerformanceProfiler.reset();

      const frameTimes: number[] = [];

      // 5. Benchmark loop
      for (let f = 0; f < frameCount; f++) {
        const frameStart = engineServices.time.now();

        PerformanceProfiler.begin('SimulationLoop');

        // Character update
        const charInput = {
          forward: f % 10 < 5,
          backward: false,
          left: f % 10 >= 5,
          right: false,
          jump: false,
          shift: false
        };

        const charConfig = {
          gravityEnabled: true,
          collisionEnabled: true,
          eyeHeight: 1.65,
          bodyWidth: 0.6,
          moveSpeed: 3.0,
          jumpPower: 5.0,
          posture: 'standing' as const
        };

        PerformanceProfiler.begin('Character');
        characterController.update(0.016, charInput, charConfig, collidables);
        PerformanceProfiler.end('Character');

        // Collision tracking is part of character controller update which calls CollisionSystem inside it,
        // and that timing is measured by PerformanceProfiler because we wrapped CollisionSystem inside the Controller.

        // Camera update
        PerformanceProfiler.begin('Camera');
        cameraController.update(
          0.016,
          camera,
          characterController.position,
          1.65,
          0,
          0,
          true,
          false,
          1.0,
          'standing',
          'first-person',
          collidables,
          characterController
        );
        PerformanceProfiler.end('Camera');

        // Build context for analysis
        const context = {
          scene,
          camera,
          renderer,
          player: {
            position: characterController.position,
            direction: new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, characterController.cameraYaw, 0)),
            eyeHeight: 1.65,
            yaw: characterController.cameraYaw
          },
          colliders: collidables,
          settings: {},
          deltaTime: 0.016,
          timestamp: engineServices.time.now(),
          analysisSettings: {
            shouldRunRaycasts: true,
            measure: {
              eyeLevelEnabled: true,
              ceilingHeightEnabled: true,
              walkwayWidthEnabled: true,
              wallDistanceEnabled: true,
              eyeRayEnabled: true,
              dimensionLabelsEnabled: false,
              measureArrowEnabled: false
            },
            solar: {
              date: '2026-06-21',
              time: '12:00',
              latitude: 35.6762,
              longitude: 139.6503,
              timezone: 9,
              modelNorth: 0
            },
            wind: {
              speed: 5,
              angle: 45
            }
          }
        };

        // Measurement update
        PerformanceProfiler.begin('Measurement');
        measureEngine.update(context);
        PerformanceProfiler.end('Measurement');

        // Solar update
        PerformanceProfiler.begin('Solar');
        solarEngine.update(context);
        PerformanceProfiler.end('Solar');

        // Wind update
        PerformanceProfiler.begin('Wind');
        windEngine.update(context);
        PerformanceProfiler.end('Wind');

        // Telemetry update
        PerformanceProfiler.begin('Telemetry');
        // Simple dummy workload representing telemetry extraction
        const dummyVal = context.player.position.clone();
        dummyVal.normalize();
        PerformanceProfiler.end('Telemetry');

        // Render Frame
        PerformanceProfiler.begin('Render');
        renderer.render(scene, camera);
        PerformanceProfiler.end('Render');

        PerformanceProfiler.end('SimulationLoop');

        const frameEnd = engineServices.time.now();
        frameTimes.push(frameEnd - frameStart);

        // Yield slightly if not immediate
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // 6. Harvest results
      const totalTime = frameTimes.reduce((a, b) => a + b, 0);
      const avgFrameTime = totalTime / frameCount;
      const avgFps = Math.round(1000 / avgFrameTime);
      const minFrameTime = Math.min(...frameTimes);
      const maxFrameTime = Math.max(...frameTimes);

      const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
      const p95Idx = Math.floor(frameCount * 0.95);
      const p95FrameTime = sortedFrameTimes[p95Idx];

      const scenarioMetrics: ScenarioMetrics = {
        scenarioName: sc.name,
        avgFps,
        avgFrameTime,
        p95FrameTime,
        maxFrameTime,
        minFrameTime
      };

      const metrics = PerformanceProfiler.getAllMetrics();

      const subsystemTimings: SubsystemTimings = {
        Simulation: metrics['SimulationLoop']?.averageTime || 0,
        Character: metrics['Character']?.averageTime || 0,
        Collision: metrics['Collision']?.averageTime || 0,
        Camera: metrics['Camera']?.averageTime || 0,
        Measurement: metrics['Measurement']?.averageTime || 0,
        Solar: metrics['Solar']?.averageTime || 0,
        Wind: metrics['Wind']?.averageTime || 0,
        Telemetry: metrics['Telemetry']?.averageTime || 0,
        Render: metrics['Render']?.averageTime || 0
      };

      const threeJsMetrics: ThreeJsMetrics = {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures
      };

      const sceneMetrics = gatherSceneMetrics(scene);

      // Capture average raycasts per frame
      const raycasterMetrics: RaycasterMetrics = {
        total: Math.round(RaycasterTracker.counts.total / frameCount),
        ground: Math.round(RaycasterTracker.counts.ground / frameCount),
        collision: Math.round(RaycasterTracker.counts.collision / frameCount),
        measurement: Math.round(RaycasterTracker.counts.measurement / frameCount),
        camera: Math.round(RaycasterTracker.counts.camera / frameCount),
        solar: Math.round(RaycasterTracker.counts.solar / frameCount),
        wind: Math.round(RaycasterTracker.counts.wind / frameCount)
      };

      results.push({
        scenarioName: sc.name,
        scenarioMetrics,
        subsystemTimings,
        threeJsMetrics,
        sceneMetrics,
        raycasterMetrics
      });

      // Cleanup webgl context objects
      measureEngine.dispose();
      solarEngine.dispose();
      windEngine.dispose();
      disposeBenchmarkSceneResources(scene);
    }

    // Unhook raycasters
    RaycasterTracker.unhook();
    renderer.dispose();

    const report: BenchmarkReport = {
      timestamp: new Date().toISOString(),
      results
    };

    // Regression check using local storage history
    let previousReport: BenchmarkReport | null = null;
    let regressionReport: PerformanceRegressionReport | null = null;
    let regressionMarkdown: string | null = null;

    try {
      const hist = localStorage.getItem('engine_benchmark_history');
      if (hist) {
        previousReport = JSON.parse(hist) as BenchmarkReport;
      }
    } catch (e) {
      engineServices.logger.warn('Failed to parse previous benchmark history:', e);
    }

    if (previousReport) {
      regressionReport = compareBenchmarks(report, previousReport);
      regressionMarkdown = generateRegressionMarkdown(regressionReport);
    }

    // Save current report to history
    try {
      localStorage.setItem('engine_benchmark_history', exportToJson(report));
    } catch (e) {
      engineServices.logger.warn('Failed to save current benchmark:', e);
    }

    const markdown = generateMarkdownReport(report);

    return {
      report,
      markdown,
      regressionReport,
      regressionMarkdown
    };
  }
}
