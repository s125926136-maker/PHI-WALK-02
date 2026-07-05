import * as THREE from 'three';
import { engineServices } from './EngineServices';

export interface SpatialIndexStats {
  queryCount: number;
  totalTimeMs: number;
  totalCandidatesChecked: number;
  totalCandidatesReturned: number;
}

export class SpatialIndex {
  private static instance: SpatialIndex | null = null;

  public static getInstance(): SpatialIndex {
    if (!SpatialIndex.instance) {
      SpatialIndex.instance = new SpatialIndex();
    }
    return SpatialIndex.instance;
  }

  private staticMeshes: Set<THREE.Mesh> = new Set();
  private dynamicMeshes: Set<THREE.Mesh> = new Set();
  private boundsCache: Map<THREE.Mesh, { box: THREE.Box3; sphere: THREE.Sphere }> = new Map();

  // Benchmarking stats
  private stats = {
    box: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
    sphere: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
    ray: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
    frustum: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 }
  };

  public register(mesh: THREE.Mesh): void {
    if (mesh.matrixAutoUpdate) {
      this.dynamicMeshes.add(mesh);
    } else {
      this.staticMeshes.add(mesh);
    }
    this.updateMeshBounds(mesh);
  }

  public unregister(mesh: THREE.Mesh): void {
    this.staticMeshes.delete(mesh);
    this.dynamicMeshes.delete(mesh);
    this.boundsCache.delete(mesh);
  }

  public clear(): void {
    this.staticMeshes.clear();
    this.dynamicMeshes.clear();
    this.boundsCache.clear();
    this.resetStats();
  }

  public rebuild(): void {
    this.boundsCache.clear();
    for (const mesh of this.staticMeshes) {
      this.updateMeshBounds(mesh);
    }
    for (const mesh of this.dynamicMeshes) {
      this.updateMeshBounds(mesh);
    }
  }

  private updateMeshBounds(mesh: THREE.Mesh): void {
    mesh.updateMatrixWorld(true);
    const box = new THREE.Box3();
    const sphere = new THREE.Sphere();

    if (mesh.geometry) {
      if (!mesh.geometry.boundingBox) {
        mesh.geometry.computeBoundingBox();
      }
      if (mesh.geometry.boundingBox) {
        box.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
      } else {
        box.setFromObject(mesh);
      }

      if (!mesh.geometry.boundingSphere) {
        mesh.geometry.computeBoundingSphere();
      }
      if (mesh.geometry.boundingSphere) {
        sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
      } else {
        box.getBoundingSphere(sphere);
      }
    } else {
      box.setFromObject(mesh);
      box.getBoundingSphere(sphere);
    }

    this.boundsCache.set(mesh, { box, sphere });
  }

  public queryBox(box: THREE.Box3): THREE.Mesh[] {
    const start = engineServices.time.now();
    const result: THREE.Mesh[] = [];
    let checked = 0;

    // Update dynamic meshes before query
    for (const mesh of this.dynamicMeshes) {
      this.updateMeshBounds(mesh);
    }

    // Query static meshes
    for (const mesh of this.staticMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && cache.box.intersectsBox(box)) {
        result.push(mesh);
      }
    }

    // Query dynamic meshes
    for (const mesh of this.dynamicMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && cache.box.intersectsBox(box)) {
        result.push(mesh);
      }
    }

    const elapsed = engineServices.time.now() - start;
    this.stats.box.queryCount++;
    this.stats.box.totalTimeMs += elapsed;
    this.stats.box.totalCandidatesChecked += checked;
    this.stats.box.totalCandidatesReturned += result.length;

    return result;
  }

  public querySphere(sphere: THREE.Sphere): THREE.Mesh[] {
    const start = engineServices.time.now();
    const result: THREE.Mesh[] = [];
    let checked = 0;

    for (const mesh of this.dynamicMeshes) {
      this.updateMeshBounds(mesh);
    }

    for (const mesh of this.staticMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && cache.sphere.intersectsSphere(sphere)) {
        result.push(mesh);
      }
    }

    for (const mesh of this.dynamicMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && cache.sphere.intersectsSphere(sphere)) {
        result.push(mesh);
      }
    }

    const elapsed = engineServices.time.now() - start;
    this.stats.sphere.queryCount++;
    this.stats.sphere.totalTimeMs += elapsed;
    this.stats.sphere.totalCandidatesChecked += checked;
    this.stats.sphere.totalCandidatesReturned += result.length;

    return result;
  }

  public queryRay(ray: THREE.Ray): THREE.Mesh[] {
    const start = engineServices.time.now();
    const result: THREE.Mesh[] = [];
    let checked = 0;
    const tempTarget = new THREE.Vector3();

    for (const mesh of this.dynamicMeshes) {
      this.updateMeshBounds(mesh);
    }

    for (const mesh of this.staticMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && ray.intersectBox(cache.box, tempTarget) !== null) {
        result.push(mesh);
      }
    }

    for (const mesh of this.dynamicMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && ray.intersectBox(cache.box, tempTarget) !== null) {
        result.push(mesh);
      }
    }

    const elapsed = engineServices.time.now() - start;
    this.stats.ray.queryCount++;
    this.stats.ray.totalTimeMs += elapsed;
    this.stats.ray.totalCandidatesChecked += checked;
    this.stats.ray.totalCandidatesReturned += result.length;

    return result;
  }

  public queryFrustum(frustum: THREE.Frustum): THREE.Mesh[] {
    const start = engineServices.time.now();
    const result: THREE.Mesh[] = [];
    let checked = 0;

    for (const mesh of this.dynamicMeshes) {
      this.updateMeshBounds(mesh);
    }

    for (const mesh of this.staticMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && frustum.intersectsBox(cache.box)) {
        result.push(mesh);
      }
    }

    for (const mesh of this.dynamicMeshes) {
      checked++;
      const cache = this.boundsCache.get(mesh);
      if (cache && frustum.intersectsBox(cache.box)) {
        result.push(mesh);
      }
    }

    const elapsed = engineServices.time.now() - start;
    this.stats.frustum.queryCount++;
    this.stats.frustum.totalTimeMs += elapsed;
    this.stats.frustum.totalCandidatesChecked += checked;
    this.stats.frustum.totalCandidatesReturned += result.length;

    return result;
  }

  public getStats() {
    return this.stats;
  }

  public resetStats(): void {
    this.stats = {
      box: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
      sphere: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
      ray: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 },
      frustum: { queryCount: 0, totalTimeMs: 0, totalCandidatesChecked: 0, totalCandidatesReturned: 0 }
    };
  }

  public getRegisteredCount(): number {
    return this.staticMeshes.size + this.dynamicMeshes.size;
  }
}
