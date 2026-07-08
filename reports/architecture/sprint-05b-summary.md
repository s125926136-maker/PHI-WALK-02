# Sprint 05B Summary

## Extraction Boundary

- Extracted simulator-owned environment Three.js object management into `src/components/simulator/useEnvironmentObjects.ts`.
- `SimulatorCanvas` remains responsible for deciding when environment objects are created, rebuilt, passed into the runtime loop, and cleaned up.
- Runtime lifecycle, model loading, analysis lifecycle, runtime loop behavior, JSX, and avatar object ownership were not extracted.

## Modified Files

- `src/components/SimulatorCanvas.tsx`
- `src/components/simulator/useEnvironmentObjects.ts`
- `reports/architecture/sprint-05b-summary.md`

## Extracted Objects

- `siteBoundaryRef`
- `vegetationGroupRef`
- `spawnPointMeshRef`
- `sunGroupRef`
- `windGroupRef`
- `accessibilityGroupRef`
- `turningCircleRef`

Extracted behavior:

- Site boundary creation/replacement.
- Vegetation group creation/replacement.
- Spawn point mesh creation/replacement.
- Sun analysis group creation.
- Wind analysis group creation.
- Accessibility analysis group creation.
- Environment object cleanup on unmount.
- Visibility synchronization for site boundary, vegetation, and spawn point.

## Deferred Objects

- `avatarGroupRef` remains in `SimulatorCanvas` for Sprint 05C.
- First-person arm, dynamic reach, reach sphere, and clearance cylinder remain in `SimulatorCanvas`.
- Scene sky/background logic remains in `SimulatorCanvas` because it is coupled to display mode and settings-driven lighting behavior.
- `sceneSunEnabled`, `sceneSunPathEnabled`, and wind parameters remain wired through the runtime loop context.
- Model loading and ground-plane call timing remain in `SimulatorCanvas`; only the environment object rebuild implementation moved.

## Ownership Verification

- Ownership is unchanged: `SimulatorCanvas` still owns when environment objects are created, rebuilt, and cleaned up.
- `useEnvironmentObjects()` owns the mutable refs and resource disposal implementation for the extracted environment objects.
- Existing `disposeSimulatorObject3D()` from `threeDisposal.ts` is used for replacement and cleanup.
- Cleanup timing is unchanged: environment cleanup still runs during the same mount-effect unmount cleanup before remaining simulator-owned visual cleanup.
- Scene add order is preserved inside extracted creation routines:
  1. Sun group.
  2. Wind group.
  3. Accessibility group.
- Ground environment replacement still disposes previous site boundary, vegetation, and spawn point before creating replacements.

## Behavioral Verification

- Runtime behavior intended unchanged.
- Visual output intended unchanged.
- Runtime loop context still receives `sunGroup`, `windGroup`, `accessibilityGroup`, and `turningCircle` refs from `SimulatorCanvas`.
- JSX was not modified.
- Model loading was not modified.
- Analysis engine lifecycle was not modified.

## Remaining Risks

- The extracted hook still depends on `SimulatorCanvas` call timing; this is intentional to avoid changing runtime behavior.
- Sun, wind, and accessibility visibility remain controlled by the runtime loop and settings context, so those controls were deferred rather than moved into the hook.
- Verification is pending.

## Verification Results

- Build: failed.
  - Command: `npm.cmd run build`
  - Error: `Cannot read directory "../../..": Access is denied.`
  - Error: `Could not resolve "C:\\Users\\User\\Documents\\Projects\\PHI-WALK-02\\vite.config.ts"`
- Lint: not run because build failed.
- Tests: not run because build failed.
