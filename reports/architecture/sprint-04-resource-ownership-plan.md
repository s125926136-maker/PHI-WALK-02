# Sprint 04 Resource Ownership Plan

Repository: `C:\Users\User\Documents\Projects\PHI-WALK-02`

Mode: Planning only. No application source code changes.

Basis:

- `reports/architecture/regression-audit-sprint-01-03.md`
- `reports/architecture/resource-ownership-audit.md`
- Read-only source scans of remaining F-04 evidence

## Executive Summary

Sprint 01-03 resolved F-01, F-02, F-03, F-05, and F-06. F-04 is partially resolved: Sprint 03 handled the approved `SimulatorCanvas` owned refs, but broader Three.js resource ownership remains outside that limited scope.

Sprint 04 should stay focused on the remaining F-04 technical debt and should not change `ThreeSceneManager` ownership. The remaining work is best split into three smaller cleanup sprints:

- Sprint 04A: `ThreeViews` preview-render resource ownership.
- Sprint 04B: analysis engine cleanup caveats in measurement visualizer allocation/disposal.
- Sprint 04C: procedural and benchmark ownership documentation plus low-risk verification hardening.

## Current Regression State

| Finding | Current status | Sprint 04 relevance |
|---|---|---|
| F-01 | Resolved | None |
| F-02 | Resolved | None |
| F-03 | Resolved | None |
| F-04 | Partially resolved | Primary scope |
| F-05 | Resolved | None |
| F-06 | Resolved | None |

## Remaining Resource Creation Areas

### `src/components/ThreeViews.tsx`

Still creates Three.js preview resources outside `ThreeSceneManager`:

- Lines 211-214: fallback preview `BoxGeometry`, `MeshStandardMaterial`, `Mesh`.
- Line 222: replacement normalized `MeshStandardMaterial` for loaded model nodes.
- Lines 273-286: per-render ground `PlaneGeometry`, `MeshStandardMaterial`, `Mesh`.
- Lines 369, 378, 387: one-shot `WebGLRenderer` instances for plan/north/west canvases.

Known cleanup evidence:

- Lines 151-158: cached model replacement cleanup traverses and disposes mesh geometry/material.
- Lines 373, 382, 391: renderers are disposed after one-shot render.

Remaining ownership concern:

- Per-render temporary scene resources, especially ground geometry/material, are not explicitly disposed.
- Normalized material replacement lacks explicit prior-material ownership policy.
- Cached model cleanup occurs on replacement, but unmount cleanup is not clearly visible.

### `src/analysis/measure.ts`

Still creates analysis resources outside `ThreeSceneManager`:

- Lines 26-58: dimension visualizer line geometry/material, arrow geometry, sprite material, `CanvasTexture`.
- Lines 361-375: laser material, laser geometry, cloned geometries, and per-line materials.

Known cleanup evidence:

- Lines 821-826: dimension visualizer geometry/material/sprite/texture disposal.
- Lines 831-832: laser line geometry/material disposal.

Remaining ownership concern:

- `lineMat` is shared between the main line and arrow segments in `initDimensionVisualizer`; disposal currently calls dispose through both references, which can be semantically ambiguous even if Three.js dispose is tolerant.
- `laserMat` and base `laserGeom` allocations appear unused after cloned line construction and are not clearly disposed.

### `src/analysis/solar.ts`

Still creates analysis resources:

- Lines 28-59: visualizer line, sprite, `CanvasTexture`.

Known cleanup evidence:

- Lines 413-416: line geometry/material, sprite material, and texture are disposed.

Remaining ownership concern:

- Low. No Sprint 04 implementation required unless verification finds regression.

### `src/analysis/wind.ts`

Still creates analysis resources:

- Lines 70-104: `ArrowHelper`s, sprite material, `CanvasTexture`.

Known cleanup evidence:

- Lines 533-536: arrow helpers, sprite material, and texture are disposed.

Remaining ownership concern:

- Low. No Sprint 04 implementation required unless verification finds regression.

### `src/proceduralSpaces.ts`

Still creates procedural resources:

- Lines 11-47: architectural material set.
- Lines 69-75, 199-205, 301-306: helper-created meshes added to procedural groups.
- Lines 83-363: numerous procedural `BoxGeometry` instances and scene/group adds.

Known cleanup evidence:

- In normal simulator flow, procedural groups become current model groups and are disposed by `ThreeSceneManager.unloadModel()`.

Remaining ownership concern:

- Ownership is transfer-based and implicit. Builders do not own disposal after returning/adding the group.

### `src/core/BenchmarkRunner.ts`

Still creates benchmark-only resources:

- Lines 127-241: benchmark scenario geometry/material/mesh resources.
- Line 340: benchmark `WebGLRenderer`.

Known cleanup evidence:

- Line 610: benchmark renderer disposed.
- Resource ownership for scenario scene children is less explicit in the audit scope.

Remaining ownership concern:

- Benchmark resources are outside runtime rendering behavior but should have explicit benchmark-local cleanup if future Sprint scope includes test/benchmark hygiene.

### `src/core/SimulationLoop.ts`

Still creates replacement geometry:

- Line 896: dynamic sun trajectory `BufferGeometry`.

Known cleanup evidence:

- Line 895 disposes previous trajectory geometry before replacement.

Remaining ownership concern:

- Low. No Sprint 04 implementation required.

## Cleanup Paths Requiring Later Sprint Handling

| Area | Current cleanup path | Gap | Recommended Sprint |
|---|---|---|---|
| `ThreeViews` cached model | Replacement cleanup at lines 151-158 | No clearly visible unmount cleanup for cached model if component unmounts without replacement | 04A |
| `ThreeViews` temporary preview scene | Renderer disposal at lines 373, 382, 391 | Temporary ground geometry/material and temporary scene attachments lack explicit disposal | 04A |
| `ThreeViews` normalized materials | Materials replaced at line 222 | Previous material ownership policy is unclear; generated material lifecycle depends on cached model cleanup | 04A |
| `measure.ts` dimension visualizers | Dispose lines 821-826 | Shared material disposal between line and arrow segments is ambiguous | 04B |
| `measure.ts` laser setup | Dispose lines 831-832 | Base `laserGeom` and `laserMat` allocation ownership is unclear | 04B |
| `proceduralSpaces.ts` builders | Disposed by caller in normal simulator path | Ownership transfer is implicit; direct future caller misuse could leak | 04C |
| `BenchmarkRunner` scenarios | Renderer and analysis engines disposed | Scenario object/resource disposal should be explicit if benchmark hygiene is in scope | 04C |

## Sprint Split Recommendation

Sprint 04 should be split into 04A / 04B / 04C. A single large sprint would mix UI preview lifecycle, analysis-engine internals, and benchmark/procedural ownership policy. Splitting reduces regression risk and keeps each sprint independently verifiable.

## Sprint 04A - ThreeViews Preview Resource Ownership

### Scope

Files in scope:

- `src/components/ThreeViews.tsx`

Allowed work:

- Add local cleanup for the cached preview model on component unmount.
- Explicitly dispose temporary preview-scene ground geometry/material after the three view renders.
- Clarify material replacement ownership for normalized preview materials.
- Keep preview rendering behavior unchanged.

Out of scope:

- `ThreeSceneManager`
- `SimulatorCanvas`
- analysis engines
- procedural scene generation behavior

### Risk

Medium.

Reasons:

- `ThreeViews` renders plan/elevation previews, so cleanup changes must not detach cached models before all three render passes complete.
- `loadedModelRef.current` is temporarily added to a local scene for rendering. Cleanup must avoid disposing resources still intended for cached reuse during the same model key.

### Verification

Required:

- `npm run build`
- `npm run lint`
- `npx vitest run`
- Search audit:
  - `new THREE.PlaneGeometry` in `ThreeViews.tsx`
  - `new THREE.MeshStandardMaterial` in `ThreeViews.tsx`
  - `new THREE.WebGLRenderer` in `ThreeViews.tsx`
  - `loadedModelRef.current.traverse`
  - `renderer.dispose()`

Suggested manual smoke check:

- Open preview views for apartment, gallery, corridor, and uploaded model if available.
- Switch spaces repeatedly and confirm preview canvases still render.

### Expected Output

- One focused implementation in `ThreeViews.tsx`.
- No `ThreeSceneManager` ownership changes.

## Sprint 04B - Measurement Analysis Cleanup Clarification

### Scope

Files in scope:

- `src/analysis/measure.ts`

Allowed work:

- Remove or dispose unused base allocations in laser setup.
- Avoid ambiguous shared-material disposal in dimension visualizers.
- Keep measurement algorithms and rendered visual output unchanged.

Out of scope:

- Measurement raycast algorithm changes.
- Solar/wind analysis changes unless verification proves direct related cleanup regression.
- Plugin lifecycle or `EngineRegistry` lifecycle changes.

### Risk

Medium.

Reasons:

- Measurement visualizers are user-facing overlays.
- Material sharing may be intentional for synchronized visual style; changing it must not alter visual output.

### Verification

Required:

- `npm run build`
- `npm run lint`
- `npx vitest run`
- Search audit:
  - `initDimensionVisualizer`
  - `laserMat`
  - `laserGeom`
  - `vis.line.material`
  - `vis.arrowSegments.material`

Suggested manual smoke check:

- Enable/disable measurement overlays.
- Toggle eye level, ceiling height, walkway width, wall distance, eye ray, labels, and arrows.
- Confirm overlays still appear and disappear correctly.

### Expected Output

- Minimal cleanup-only changes in `measure.ts`.
- No analysis result or rendering behavior changes.

## Sprint 04C - Ownership Policy Hardening for Procedural and Benchmark Resources

### Scope

Files potentially in scope:

- `src/proceduralSpaces.ts`
- `src/core/BenchmarkRunner.ts`
- possibly documentation/report updates if implementation is not needed

Allowed work:

- Document or encode ownership transfer expectations for procedural builders.
- Add explicit benchmark-local scene/resource cleanup if benchmark resources are confirmed to be retained longer than intended.
- Keep runtime simulator behavior unchanged.

Out of scope:

- Redesigning procedural space generation.
- Refactoring model ownership into `ThreeSceneManager`.
- Changing benchmark scenarios or performance metrics.

### Risk

Low to Medium.

Reasons:

- Procedural spaces are runtime-critical, but normal simulator ownership already transfers to `ThreeSceneManager`.
- Benchmark cleanup is less user-facing but can affect performance reports if changed too broadly.

### Verification

Required:

- `npm run build`
- `npm run lint`
- `npx vitest run`
- Search audit:
  - `buildApartment`
  - `buildGallery`
  - `buildInteractiveCorridor`
  - `new THREE.MeshStandardMaterial` in `proceduralSpaces.ts`
  - benchmark scenario creation and cleanup sites

Suggested manual smoke check:

- Load apartment, gallery, and corridor.
- Switch between spaces repeatedly.
- Run benchmark if a project command exists and is already supported by the repo.

### Expected Output

- Either a small implementation for explicit cleanup or a documented decision that caller-owned transfer is sufficient.
- No visual or algorithmic changes.

## Recommended Sprint Order

1. Sprint 04A first, because `ThreeViews` has the clearest remaining probable resource leaks outside `SimulatorCanvas`.
2. Sprint 04B second, because measurement cleanup touches analysis visualizer internals and should be isolated.
3. Sprint 04C third, because procedural/benchmark ownership is lower-risk and may only require policy hardening.

## Non-Goals

- Do not modify `ThreeSceneManager` ownership.
- Do not reopen F-01, F-02, F-03, F-05, or F-06.
- Do not refactor unrelated systems.
- Do not change rendering behavior.
- Do not change analysis algorithms.
- Do not introduce new global ownership or hidden singleton ownership.

## Completion Criteria for Sprint 04

Sprint 04 is complete only when:

- `ThreeViews` preview resources have explicit cleanup ownership.
- Measurement visualizer cleanup caveats are resolved or explicitly documented as safe.
- Procedural and benchmark ownership expectations are documented or minimally hardened.
- Verification commands are run for each implementation sprint:
  - `npm run build`
  - `npm run lint`
  - `npx vitest run`
- Final regression audit marks F-04 as either Resolved or explicitly documents any intentionally accepted residual risk.

