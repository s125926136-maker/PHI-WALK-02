# Sprint 04D Summary

## 修改內容

- Updated `src/proceduralSpaces.ts`.
- Added a local `disposeObjectResources()` helper for procedural object disposal.
- Updated `buildInteractiveCorridor()` so an existing scene object named `corridor` is disposed before it is removed and replaced.

## Ownership 判定

- Normal procedural ownership remains caller-owned: `buildApartment()`, `buildGallery()`, and the newly returned `buildInteractiveCorridor()` group are still owned by the caller after creation.
- The special replacement path inside `buildInteractiveCorridor()` is builder-owned because the builder finds and removes the existing `corridor` object itself.
- Since the builder performs that removal, it is also responsible for disposing the removed corridor resources before detaching it from the scene.

## Dispose 流程

When `buildInteractiveCorridor()` finds an existing `corridor` object:

1. Traverse the existing `Object3D` subtree.
2. Collect unique geometries, materials, and material-owned textures.
3. Dispose textures first.
4. Dispose materials.
5. Dispose geometries.
6. Remove the existing object from the scene.
7. Build and return the new corridor group as before.

## 是否影響 Runtime

- Corridor geometry is unchanged.
- Corridor material appearance is unchanged.
- Procedural generation algorithm is unchanged.
- Runtime replacement behavior is unchanged except that the removed corridor's resources are now released before replacement.
- Benchmark scenario behavior is unchanged.

## Residual Risk

- Shared resources attached to an externally owned object named `corridor` would be disposed if that object is passed into this builder-owned replacement path.
- Current procedural corridor resources are created by the builder and are not shared outside the corridor group, so this residual risk is acceptable for the targeted F-04 fix.

## Verification Results

- Build: failed.
  - Command: `npm.cmd run build`
  - Error: `Cannot read directory "../../..": Access is denied.`
  - Error: `Could not resolve "C:\\Users\\User\\Documents\\Projects\\PHI-WALK-02\\vite.config.ts"`
- Lint: not run because build failed.
- Tests: not run because build failed.
