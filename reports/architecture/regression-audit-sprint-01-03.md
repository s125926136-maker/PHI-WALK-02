# PHI WALK Regression Audit - Sprint 01-03

Repository: `C:\Users\User\Documents\Projects\PHI-WALK-02`

Scope: F-01, F-02, F-03, F-04, F-05, F-06 only.

Mode: Read-only source audit. No application source files were modified for this audit.

## Summary Table

| Finding | Status | Additional work needed |
|---|---|---|
| F-01 | Resolved | No |
| F-02 | Resolved | No |
| F-03 | Resolved | No |
| F-04 | Partially resolved | Yes |
| F-05 | Resolved | No |
| F-06 | Resolved | No |

## Findings

### F-01 - Stop render-time EngineRuntime construction in SimulatorCanvas

Status: Resolved.

File evidence:

- `src/components/SimulatorCanvas.tsx`

Line evidence:

- Line 591: `runtimeRef` is declared as `useRef<EngineRuntime | null>(null)`, not `useRef(new EngineRuntime())`.
- Lines 1266-1269: `new EngineRuntime()` is constructed inside `useLayoutEffect`, not during React render.

Remaining risk:

- Low. Runtime construction is now mount-lifecycle based. The current implementation relies on nullable runtime/subsystem refs being guarded before use.

Additional work needed:

- No.

### F-02 - Establish single initialization owner for analysis engines

Status: Resolved.

File evidence:

- `src/components/SimulatorCanvas.tsx`
- `src/analysis/framework.ts`
- `src/core/plugins/AnalysisEnginePluginAdapter.ts`

Line evidence:

- `src/components/SimulatorCanvas.tsx` lines 1428-1446: analysis engines are constructed and registered, then `EngineRegistry.getInstance().initializeAll(scene, camera, renderer)` is called once for the group.
- `src/analysis/framework.ts` lines 250-262: `initializeAll(...)` delegates initialization through `initializeEngine(...)`.
- `src/analysis/framework.ts` lines 361-370: `initializeEngine(...)` guards with `initializedEngines` and calls `engine.initialize(...)` plus `engine.onEnable()` once.
- `src/core/plugins/AnalysisEnginePluginAdapter.ts` lines 25-27: adapter `initialize(...)` is intentionally lifecycle-no-op.

Remaining risk:

- Low. `EngineRegistry` now owns initialization. The remaining architectural caveat is that `EngineRegistry.register(...)` still warns and overwrites duplicate engine names, but that is outside F-02 and was not part of Sprint 01-03 scope.

Additional work needed:

- No for F-02.

### F-03 - Establish single disposal owner for analysis engines

Status: Resolved.

File evidence:

- `src/components/SimulatorCanvas.tsx`
- `src/analysis/framework.ts`
- `src/core/plugins/AnalysisEnginePluginAdapter.ts`

Line evidence:

- `src/components/SimulatorCanvas.tsx` lines 1718-1728: cleanup unregisters plugin adapters and unregisters engines through `EngineRegistry`; no direct `measureEngineRef.current.dispose()`, `solarEngineRef.current.dispose()`, or `windEngineRef.current.dispose()` calls are present in this cleanup path.
- `src/analysis/framework.ts` lines 220-230: `unregister(...)` delegates disposal through `disposeEngine(...)`.
- `src/analysis/framework.ts` lines 372-381: `disposeEngine(...)` guards with `initializedEngines`, then calls `engine.onDisable()` and `engine.dispose()` once.
- `src/core/plugins/AnalysisEnginePluginAdapter.ts` lines 47-49: adapter `dispose()` is intentionally lifecycle-no-op.

Remaining risk:

- Low. Disposal ownership is centralized in `EngineRegistry`. If an engine is registered but never initialized, `disposeEngine(...)` no-ops; this is appropriate for resource ownership because no initialized engine resources should exist.

Additional work needed:

- No.

### F-04 - Three.js resource ownership

Status: Partially resolved.

File evidence:

- `src/components/SimulatorCanvas.tsx`
- `reports/architecture/resource-ownership-audit.md`

Line evidence:

- `src/components/SimulatorCanvas.tsx` lines 145-188: local `disposeSimulatorObject3D(...)` helper removes parent attachment, traverses children, disposes geometry, material arrays, single materials, and material texture maps.
- Lines 925-928: site boundary rebuild path uses `disposeSimulatorObject3D(...)`.
- Lines 961-964: vegetation rebuild path uses `disposeSimulatorObject3D(...)`.
- Lines 1007-1009: spawn point rebuild path uses `disposeSimulatorObject3D(...)`.
- Lines 1730-1753: unmount cleanup disposes listed `SimulatorCanvas` owned refs before runtime disposal.

Remaining risk:

- Medium. Sprint 03 implementation covered only the approved `SimulatorCanvas` owned refs from the implementation plan. The earlier F-04 audit also identified broader resource ownership concerns in `ThreeViews` and smaller caveats in analysis/measurement utility allocation patterns, but those were intentionally outside the Sprint 03 implementation scope.

Additional work needed:

- Yes, if F-04 is intended to cover all resources identified in the audit. No additional work is needed for the limited Sprint 03 implementation plan items that were approved.

### F-05 - Make EngineRuntime.dispose() terminal and side-effect-free

Status: Resolved.

File evidence:

- `src/core/EngineRuntime.ts`

Line evidence:

- Line 6: `_engine` is created at runtime construction through `EngineFactory.create()`.
- Lines 113-125: `dispose()` is idempotent via `_isDisposed`, stops runtime, disposes `threeSceneManager`, unbinds `inputManager`, resets state flags, and sets `_isDisposed = true`.
- No `EngineFactory.create()` call exists inside `dispose()`.
- Lines 38-42: `initialize(...)` throws if runtime has been disposed.
- Lines 57-60: `start(...)` throws if runtime has been disposed.

Remaining risk:

- Low. The disposed runtime keeps its original engine reference but cannot be reinitialized or restarted.

Additional work needed:

- No.

### F-06 - PluginRegistry rejects duplicate plugin IDs without auto-disposing existing plugin

Status: Resolved.

File evidence:

- `src/core/plugins/PluginRegistry.ts`
- `src/core/EngineFactory.ts`

Line evidence:

- `src/core/plugins/PluginRegistry.ts` lines 25-28: `register(plugin)` throws `Plugin with id "${plugin.id}" is already registered.` before mutating the registry.
- `src/core/plugins/PluginRegistry.ts` lines 30-36: plugin is registered only after duplicate check passes.
- `src/core/plugins/PluginRegistry.ts` lines 83-86: `has(id)` supports explicit duplicate checks by callers.
- `src/core/EngineFactory.ts` lines 27-31: core plugins are registered only when not already present, avoiding repeated registration attempts for global core plugin IDs.

Remaining risk:

- Low. Existing plugin is not auto-disposed during duplicate registration rejection. Callers that previously relied on silent replacement now fail loudly.

Additional work needed:

- No.

## Unresolved Items

| Finding | Item |
|---|---|
| F-04 | Broader Three.js resource ownership outside the approved Sprint 03 `SimulatorCanvas` scope remains only partially resolved. |

