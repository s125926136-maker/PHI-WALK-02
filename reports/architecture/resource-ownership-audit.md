# F-04 Three.js Resource Ownership Audit

Repository: `C:\Users\User\Documents\Projects\PHI-WALK-02`

Scope: F-04 Three.js Resource Ownership

Mode: Read-only source audit. No application source files were modified for this audit.

## Executive Summary

The audit found that Three.js resource ownership is split across `ThreeSceneManager`, `SimulatorCanvas`, `ThreeViews`, analysis engines, procedural scene builders, and benchmark utilities.

`ThreeSceneManager` has clear ownership and disposal for its own ground mesh, active model group, renderer, lights, camera, and DRACO loader. Analysis engines mostly own and dispose their visualizers through their `dispose()` methods. The main risk is outside `ThreeSceneManager`: `SimulatorCanvas` creates several persistent helper groups and meshes but does not clearly dispose their geometries, materials, textures, or detached scene objects during unmount or rebuild. `ThreeViews` disposes cached model resources when replacing a model, but per-render ground resources and normalized replacement materials are not clearly disposed after one-shot renderer disposal.

Total findings: 25.

Critical findings: 0.

High findings: 9.

## Methodology

The audit used source-code searches against the requested F-04 scope and related resource factories:

- Creation scan: `new THREE.BufferGeometry`, `PlaneGeometry`, `BoxGeometry`, `SphereGeometry`, `CylinderGeometry`, `RingGeometry`, `ShapeGeometry`, `MeshBasicMaterial`, `MeshStandardMaterial`, `LineBasicMaterial`, `SpriteMaterial`, `Texture`, `CanvasTexture`, `WebGLRenderTarget`, `Mesh`, `Line`, `Points`, `scene.add(...)`, `group.add(...)`.
- Disposal scan: `.dispose()`, `scene.remove(...)`, `.remove(...)`, `traverse(...)`, `unloadModel()`, `renderer.dispose()`.
- Primary files checked: `src/components/SimulatorCanvas.tsx`, `src/components/ThreeViews.tsx`, `src/core/ThreeSceneManager.ts`, `src/analysis/*`, `src/core/plugins/*`, `src/components/workspace/*`.
- Additional files checked because source scan found Three.js resources there: `src/proceduralSpaces.ts`, `src/core/SimulationLoop.ts`.

Ownership was classified as:

- Safe: owner and disposal path are visible in source.
- Unclear: owner exists by implication, but disposal is partial, indirect, or missing for some child resources.
- Probable leak: resource is removed from scene or replaced without visible geometry/material/texture disposal, or one-shot resources are not cleaned after rendering.

## Resource Creation Inventory

| ID | File | Line | Resource created | Current owner inferred from source | Dispose found |
|---|---|---:|---|---|---|
| F04-01 | `src/core/ThreeSceneManager.ts` | 51-66 | Ground `PlaneGeometry`, `MeshStandardMaterial`, `Mesh` | `ThreeSceneManager` | Yes |
| F04-02 | `src/core/ThreeSceneManager.ts` | 70-98 | Scene lights, camera, WebGL renderer | `ThreeSceneManager` | Yes for renderer; lights/camera removed |
| F04-03 | `src/components/SimulatorCanvas.tsx` | 866 | Replacement ground `PlaneGeometry` assigned to `groundMesh.geometry` | `SimulatorCanvas` mutates `ThreeSceneManager.groundMesh` | Yes for previous geometry |
| F04-04 | `src/components/SimulatorCanvas.tsx` | 894-904 | Site boundary `BufferGeometry`, `LineDashedMaterial`, `LineSegments` | `SimulatorCanvas` via `siteBoundaryRef` | No complete disposal found |
| F04-05 | `src/components/SimulatorCanvas.tsx` | 931-950 | Vegetation tree geometries/materials/meshes/groups | `SimulatorCanvas` via `vegetationGroupRef` | No complete disposal found |
| F04-06 | `src/components/SimulatorCanvas.tsx` | 959-965 | Spawn ring `RingGeometry`, `MeshBasicMaterial`, `Mesh` | `SimulatorCanvas` via `spawnPointMeshRef` | No complete disposal found |
| F04-07 | `src/components/SimulatorCanvas.tsx` | 1158, 1178 | Temporary model `MeshStandardMaterial` display-mode replacements | `SimulatorCanvas` | Partial |
| F04-08 | `src/components/SimulatorCanvas.tsx` | 1247-1327 | First-person arm and dynamic reach groups with geometries/materials/meshes | `SimulatorCanvas` via refs | No complete disposal found |
| F04-09 | `src/components/SimulatorCanvas.tsx` | 1346-1370 | Reach sphere and clearance cylinder geometries/materials/meshes | `SimulatorCanvas` via refs | No disposal found |
| F04-10 | `src/components/SimulatorCanvas.tsx` | 1398-1428 | Sun group, path geometry/material/line, `CanvasTexture`, sprite material/sprite | `SimulatorCanvas` via refs | No complete disposal found |
| F04-11 | `src/components/SimulatorCanvas.tsx` | 1434-1458 | Wind group, shared cylinder geometry, per-particle materials/meshes | `SimulatorCanvas` via `windGroupRef` | No disposal found |
| F04-12 | `src/components/SimulatorCanvas.tsx` | 1464-1494 | Accessibility group, ring/circle geometries, materials, meshes | `SimulatorCanvas` via refs | No disposal found |
| F04-13 | `src/components/SimulatorCanvas.tsx` | 1501-1654 | Avatar/mannequin/wheelchair mesh tree | `SimulatorCanvas` via `avatarGroupRef` | No disposal found |
| F04-14 | `src/components/ThreeViews.tsx` | 211-286 | Fallback model mesh and per-render ground mesh/material/geometry | `ThreeViews` component | Partial |
| F04-15 | `src/components/ThreeViews.tsx` | 222 | Replacement normalized `MeshStandardMaterial` for loaded model nodes | `ThreeViews` component | Partial |
| F04-16 | `src/analysis/measure.ts` | 26-58, 361-375 | Measurement visualizer lines, line segments, sprites, textures, laser lines | `SpatialMeasurementEngine` | Yes, with one shared-material caveat |
| F04-17 | `src/analysis/solar.ts` | 28-59 | Solar visualizer line, sprite, `CanvasTexture` | `SolarEngine` | Yes |
| F04-18 | `src/analysis/wind.ts` | 70-104 | Wind `ArrowHelper`s, sprite, `CanvasTexture` | `WindEngine` | Yes |
| F04-19 | `src/proceduralSpaces.ts` | 11-363 | Procedural materials, box geometries, meshes, groups | Caller-owned model group / `ThreeSceneManager.unloadModel()` | Yes when loaded as current model |
| F04-20 | `src/core/SimulationLoop.ts` | 895-896 | Replacement sun trajectory `BufferGeometry` | Existing sun trajectory line owner | Yes for previous geometry |

## Disposal Ownership Table

| ID | File | Line | Resource created | Owner currently responsible | Dispose found | Disposal location if found | Risk | Recommended fix |
|---|---|---:|---|---|---|---|---|---|
| F04-01 | `src/core/ThreeSceneManager.ts` | 51-66 | Ground plane geometry/material/mesh | `ThreeSceneManager` | Yes | `dispose()` lines 189-197 | Low | Keep ownership in `ThreeSceneManager`. |
| F04-02 | `src/core/ThreeSceneManager.ts` | 98 | `WebGLRenderer` | `ThreeSceneManager` | Yes | `dispose()` line 228 | Low | Keep as-is. |
| F04-03 | `src/core/ThreeSceneManager.ts` | 160-173 | Current model group and child mesh resources | `ThreeSceneManager` | Yes | `unloadModel()` lines 160-173 | Low | Keep model disposal centralized. |
| F04-04 | `src/components/SimulatorCanvas.tsx` | 866 | Replacement ground geometry | `SimulatorCanvas` updates `ThreeSceneManager.groundMesh` | Yes | Previous geometry disposed at line 864; final disposal in `ThreeSceneManager.dispose()` | Low | Acceptable, but document cross-owner mutation. |
| F04-05 | `src/components/SimulatorCanvas.tsx` | 894-904 | Site boundary geometry/material/line | `SimulatorCanvas` | No complete disposal | Only `scene.remove(...)` at line 873 | High | Add a scoped helper to remove and dispose boundary geometry/material before rebuild and unmount. |
| F04-06 | `src/components/SimulatorCanvas.tsx` | 931-950 | Vegetation group with tree meshes | `SimulatorCanvas` | No complete disposal | Only `scene.remove(...)` at line 909 | High | Traverse `vegetationGroupRef.current` and dispose each mesh geometry/material before replacing or unmounting. |
| F04-07 | `src/components/SimulatorCanvas.tsx` | 959-965 | Spawn point ring mesh | `SimulatorCanvas` | No complete disposal | Only `scene.remove(...)` at line 955 | High | Dispose spawn mesh geometry/material before replacing or unmounting. |
| F04-08 | `src/components/SimulatorCanvas.tsx` | 1158, 1178 | Temporary display-mode model materials | `SimulatorCanvas` | Partial | Previous generated material disposed at lines 1112-1116 | Medium | On model unload/unmount, restore original materials before `ThreeSceneManager.unloadModel()` or ensure generated active materials are disposed without losing original ownership. |
| F04-09 | `src/components/SimulatorCanvas.tsx` | 1247-1293 | First-person arm group | `SimulatorCanvas` | No | None found | High | Remove from camera and traverse-dispose mesh geometries/materials on unmount. |
| F04-10 | `src/components/SimulatorCanvas.tsx` | 1301-1327 | Dynamic reach group | `SimulatorCanvas` | No | None found | High | Remove from scene and traverse-dispose children on unmount. |
| F04-11 | `src/components/SimulatorCanvas.tsx` | 1346-1370 | Reach sphere and clearance cylinder | `SimulatorCanvas` | No | None found | High | Dispose both refs via shared `disposeObject3D` helper during unmount. |

| F04-12 | `src/components/SimulatorCanvas.tsx` | 1398-1428 | Sun group, path line, sprite material, `CanvasTexture` | `SimulatorCanvas` | No complete disposal | None found for `sunGroupRef` / `sunSphereRef` | High | Remove `sunGroupRef.current` and traverse-dispose line geometry/material, sprite material, and texture. |
| F04-13 | `src/components/SimulatorCanvas.tsx` | 1434-1458 | Wind particle group | `SimulatorCanvas` | No | None found | High | Traverse-dispose wind group; handle shared `windParticleGeom` once and each particle material. |
| F04-14 | `src/components/SimulatorCanvas.tsx` | 1464-1494 | Accessibility group meshes | `SimulatorCanvas` | No | None found | Medium | Traverse-dispose `accessibilityGroupRef.current` on unmount. |
| F04-15 | `src/components/SimulatorCanvas.tsx` | 1501-1654 | Avatar/mannequin/wheelchair object tree | `SimulatorCanvas` | No | None found | High | Remove `avatarGroupRef.current` from scene and traverse-dispose all mesh geometry/material resources. |
| F04-16 | `src/components/SimulatorCanvas.tsx` | 1764-1860 | Uploaded model group | `ThreeSceneManager` after `currentModelGroup` assignment | Yes | `ThreeSceneManager.unloadModel()` lines 160-173 | Low | Keep existing model disposal path. |
| F04-17 | `src/components/ThreeViews.tsx` | 211-214 | Fallback preview mesh | `ThreeViews` | Yes when cached model replaced | Lines 151-158 | Low | Keep, but add unmount cleanup for cached model if component can unmount without replacement. |
| F04-18 | `src/components/ThreeViews.tsx` | 222 | Replacement normalized material | `ThreeViews` | Partial | Previous cached model resources disposed lines 151-158 | Medium | Dispose original material before replacement if it is no longer used, or avoid replacing with unmanaged materials. |
| F04-19 | `src/components/ThreeViews.tsx` | 273-286 | Per-render ground mesh geometry/material | `ThreeViews` local render scene | No explicit geometry/material disposal | Renderers disposed at lines 373, 382, 391 | Medium | After rendering, dispose ground geometry/material and remove model from temporary scene. |
| F04-20 | `src/analysis/measure.ts` | 26-58 | Dimension visualizer resources | `SpatialMeasurementEngine` | Yes | Lines 821-826 | Low | Keep, but avoid double-disposing shared line material. |
| F04-21 | `src/analysis/measure.ts` | 361-375 | Laser line geometry/materials | `SpatialMeasurementEngine` | Mostly yes | Lines 831-832 | Medium | Dispose base `laserGeom` and unused `laserMat`, or remove unused allocations. |
| F04-22 | `src/analysis/solar.ts` | 28-59 | Solar visualizer line/sprite/texture | `SolarEngine` | Yes | Lines 413-416 | Low | Keep. |
| F04-23 | `src/analysis/wind.ts` | 70-104 | Wind arrows/sprite/texture | `WindEngine` | Yes | Lines 533-536 | Low | Keep. |
| F04-24 | `src/proceduralSpaces.ts` | 11-363 | Procedural model resources | Caller / `ThreeSceneManager` once loaded | Yes in normal simulator path | `ThreeSceneManager.unloadModel()` lines 160-173 | Low | Keep caller-owned transfer model; document that builders do not own disposal. |
| F04-25 | `src/core/SimulationLoop.ts` | 895-896 | Dynamic sun trajectory geometry replacement | Existing line owner | Yes | Previous geometry disposed at line 895 | Low | Keep. |

## Unclear Ownership

1. `SimulatorCanvas` helper scene objects: `siteBoundaryRef`, `vegetationGroupRef`, `spawnPointMeshRef`, `fpArmGroupRef`, `dynReachGroupRef`, `reachSphereRef`, `clearanceCylinderRef`, `sunGroupRef`, `windGroupRef`, `accessibilityGroupRef`, and `avatarGroupRef` are created outside `ThreeSceneManager` and not clearly covered by `ThreeSceneManager.dispose()`.
2. `SimulatorCanvas` mutates `ThreeSceneManager.groundMesh.geometry`. This is currently safe because old geometry is disposed before replacement and final ground mesh disposal is in `ThreeSceneManager`, but ownership is split.
3. `SimulatorCanvas` temporary display-mode materials store `originalMaterial` and dispose prior generated materials, but final active generated material disposal depends on model unload behavior and current state.
4. `ThreeViews` creates a temporary scene and per-render ground mesh, then disposes renderers but does not explicitly dispose that temporary ground geometry/material.
5. `ThreeViews` replaces loaded model materials with new `MeshStandardMaterial` instances. Previous material ownership is not explicit.

## Probable Leaks

The following are probable leaks because source shows creation and scene attachment, but no matching geometry/material/texture disposal path:

| ID | Resource | Evidence | Why it is probably leaking |
|---|---|---|---|
| PL-01 | Site boundary line | `SimulatorCanvas.tsx` lines 894-904; removal only line 873 | Removed from scene without disposing `BufferGeometry` or `LineDashedMaterial`. |
| PL-02 | Vegetation trees | `SimulatorCanvas.tsx` lines 931-950; removal only line 909 | Group removal does not dispose child mesh geometries/materials. |
| PL-03 | Spawn point mesh | `SimulatorCanvas.tsx` lines 959-965; removal only line 955 | Ring geometry and material are not disposed. |
| PL-04 | First-person arm group | `SimulatorCanvas.tsx` lines 1247-1293 | Added to camera; no unmount cleanup found. |
| PL-05 | Dynamic reach group | `SimulatorCanvas.tsx` lines 1301-1327 | Added to scene; no unmount cleanup found. |
| PL-06 | Reach sphere and clearance cylinder | `SimulatorCanvas.tsx` lines 1346-1370 | Added to scene; refs are not disposed on unmount. |
| PL-07 | SimulatorCanvas sun visuals | `SimulatorCanvas.tsx` lines 1398-1428 | `BufferGeometry`, line material, sprite material, and `CanvasTexture` lack visible cleanup. |
| PL-08 | SimulatorCanvas wind particles | `SimulatorCanvas.tsx` lines 1434-1458 | Shared geometry and per-particle materials lack visible cleanup. |
| PL-09 | Accessibility group meshes | `SimulatorCanvas.tsx` lines 1464-1494 | Ring/circle geometries and materials lack visible cleanup. |
| PL-10 | Avatar/mannequin/wheelchair meshes | `SimulatorCanvas.tsx` lines 1501-1654 | Large object tree is added to scene with no traverse-dispose path. |

## Safe Resources

Resources safely owned by `ThreeSceneManager`:

- Ground plane mesh created in `src/core/ThreeSceneManager.ts` lines 51-66 and disposed in lines 189-197.
- Active model group assigned to `currentModelGroup`, disposed through `unloadModel()` lines 160-173.
- `WebGLRenderer` created at line 98 and disposed at line 228.
- Lights and camera are removed from the scene in `dispose()` lines 204-220.
- DRACO loader is disposed at line 233.

Resources owned by `SimulatorCanvas` with safe or partial disposal:

- Replacement ground geometry at line 866: previous geometry is disposed at line 864; final mesh is owned by `ThreeSceneManager`.
- Uploaded model group at lines 1764-1860: ownership transfers to `ThreeSceneManager.currentModelGroup` and is disposed by `unloadModel()`.
- Display-mode generated model materials at lines 1158 and 1178: previous generated material is disposed at lines 1112-1116; final state still needs cleanup clarity.

Resources safely owned by analysis engines:

- `SpatialMeasurementEngine` dimension visualizers are disposed in `src/analysis/measure.ts` lines 821-826.
- `SpatialMeasurementEngine` laser lines are disposed in `src/analysis/measure.ts` lines 831-832, with a caveat that the base `laserGeom` and unused `laserMat` allocation are not clearly disposed.
- `SolarEngine` visualizer resources are disposed in `src/analysis/solar.ts` lines 413-416.
- `WindEngine` arrow helpers, sprite material, and texture are disposed in `src/analysis/wind.ts` lines 533-536.

Resources safe by transfer of ownership:

- `src/proceduralSpaces.ts` creates procedural meshes and shared materials, then returns or adds a model group. In the simulator path, that group becomes the current model and is disposed by `ThreeSceneManager.unloadModel()`.
- `src/core/SimulationLoop.ts` replaces sun trajectory geometry after disposing the previous geometry at line 895.

## Minimal Sprint 03 Implementation Plan

1. Add a small local disposal helper in `SimulatorCanvas` only, scoped to F-04:
   - Accept `THREE.Object3D | null`.
   - Remove from parent if attached.
   - Traverse children.
   - Dispose mesh/line geometry.
   - Dispose material arrays and single materials.
   - Dispose material texture maps if present and owned by the created helper object.

2. Use that helper for `SimulatorCanvas`-owned refs only:
   - `siteBoundaryRef`
   - `vegetationGroupRef`
   - `spawnPointMeshRef`
   - `fpArmGroupRef`
   - `dynReachGroupRef`
   - `reachSphereRef`
   - `clearanceCylinderRef`
   - `sunGroupRef`
   - `windGroupRef`
   - `accessibilityGroupRef`
   - `avatarGroupRef`

3. Replace rebuild-time `scene.remove(...)` calls for site boundary, vegetation, and spawn point with dispose helper calls.

4. Add unmount cleanup before `runtimeRef.current?.dispose()` for all `SimulatorCanvas` helper refs.

5. Keep `ThreeSceneManager` ownership unchanged. Do not move these helper resources into `ThreeSceneManager` during this sprint.

6. Add a focused test or lightweight utility test only if a disposal helper is extracted into a testable module. If kept local to `SimulatorCanvas`, rely on TypeScript build plus targeted search audit.

7. Verification after implementation:
   - `npm run build`
   - `npm run lint`
   - `npx vitest run`
   - Search audit for the listed refs and `scene.remove(...)` rebuild paths.
