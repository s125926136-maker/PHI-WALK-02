# Sprint 04A Summary

## 修改項目

- Updated `src/components/ThreeViews.tsx`.
- Added local ThreeViews-only disposal helpers for preview-owned mesh geometry/material resources.
- Added cached preview model unmount cleanup.
- Replaced previous cached model cleanup with the shared local disposal helper.
- Added explicit temporary preview ground mesh disposal after plan/north/west render passes.
- Clarified normalized preview material ownership by disposing replaced original preview materials when assigning generated normalized preview materials.

## ownership 變更

- `ThreeViews` now explicitly owns and disposes its cached preview model copy.
- `ThreeViews` now explicitly owns and disposes temporary preview-scene ground resources.
- Normalized preview materials are owned by `ThreeViews`; replaced preview materials are disposed during normalization and generated materials are disposed with the cached preview model.
- No `ThreeSceneManager`, `SimulatorCanvas`, analysis engine, procedural space, benchmark, runtime, or registry ownership was changed.

## 驗證結果

- `npm.cmd run build`: Failed.
- Exact error:

```text
X [ERROR] Cannot read directory "../../..": Access is denied.

X [ERROR] Could not resolve "C:\\Users\\User\\Documents\\Projects\\PHI-WALK-02\\vite.config.ts"

failed to load config from C:\Users\User\Documents\Projects\PHI-WALK-02\vite.config.ts
error during build:
Error: Build failed with 2 errors:
error: Cannot read directory "../../..": Access is denied.
error: Could not resolve "C:\\Users\\User\\Documents\\Projects\\PHI-WALK-02\\vite.config.ts"
```

- `npm.cmd run lint`: Not run because build failed first.
- `npx.cmd vitest run`: Not run because build failed first.
- `git status`: Not run after verification failure.
- `git diff --stat`: Not run after verification failure.
- Commit: Not created because build failed.
- Push: Not run because build failed.

## remaining risks

- Preview material normalization now disposes replaced materials because the preview model copy is owned by `ThreeViews`. If a future caller shares model resources with another owner before passing them into `ThreeViews`, that caller must not reuse disposed materials.
- Renderer validation still depends on the existing one-shot canvas render behavior.
