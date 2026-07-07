# Sprint 04C Summary

## 修改項目

- `src/core/BenchmarkRunner.ts`
  - Added benchmark-local explicit cleanup for Three.js scene resources created during benchmark scenarios.
  - Replaced the final per-scenario `scene.clear()` with cleanup that disposes scene-owned textures, materials, and geometries before clearing the scene.
- `src/proceduralSpaces.ts`
  - No source changes.

## ownership 判定

- `buildApartment`, `buildGallery`, and `buildInteractiveCorridor` create scene groups and transfer ownership of the returned `THREE.Group` and its child resources to the caller.
- Runtime simulator ownership remains with the existing scene/model owner that receives and unloads those generated groups.
- Benchmark scenario ownership is local to `BenchmarkRunner`; benchmark-created scenes are now explicitly cleaned up after each scenario run.
- `buildInteractiveCorridor` still removes an existing object named `corridor` if called directly on a scene that already contains one. Current runtime and benchmark paths do not rely on this as the authoritative cleanup path; ownership remains with the caller that owns the generated group.

## 是否有程式碼修改

- Yes.
- Modified application source: `src/core/BenchmarkRunner.ts`.
- No procedural generation algorithm changes.
- No runtime simulator behavior changes intended.
- No benchmark scenario or performance metric logic changes intended.

## 驗證結果

- Build: failed.
  - Command: `npm.cmd run build`
  - Error: `Cannot read directory "../../..": Access is denied.`
  - Error: `Could not resolve "C:\\Users\\User\\Documents\\Projects\\PHI-WALK-02\\vite.config.ts"`
- Lint: not run because build failed.
- Tests: not run because build failed.

## remaining risks

- Direct repeated calls to `buildInteractiveCorridor` on the same scene without caller cleanup still depend on the caller owning disposal.
- Benchmark cleanup now disposes resources after metrics are collected; any future benchmark scenario that shares resources outside the benchmark scene should avoid attaching externally owned disposable resources to the scenario scene.
