# CI Workflow Summary

## Workflow 架構

- Workflow file: `.github/workflows/ci.yml`
- Runner: `windows-latest`
- Checkout: `actions/checkout@v4`
- Node setup: `actions/setup-node@v4`
- Node.js version: `24`
  - `package.json` does not currently specify an `engines.node` version.
  - Node 24 is used as the current LTS baseline for this workflow.
- Dependency installation: `npm ci`
- NPM cache: enabled through `actions/setup-node@v4` with `cache: npm`

## 驗證流程

The workflow runs these validation commands in order:

1. `npm ci`
2. `npm.cmd run build`
3. `npm.cmd run lint`
4. `npx.cmd vitest run`

Any failed command fails the CI job and blocks a passing workflow result.

## Trigger 條件

The workflow runs on:

- Every `push`
- Every `pull_request`

No branch filters are configured, so all branches are covered.

## 後續使用方式

- Open a Pull Request or push to any branch to trigger CI automatically.
- Review the `CI / Build, lint, and test` job in GitHub Actions.
- Treat a failed build, lint, or Vitest step as a required fix before merging.
- Keep local verification aligned with CI by running:

```powershell
npm.cmd run build
npm.cmd run lint
npx.cmd vitest run
```

