# TODOs

## P2: Automated npm publish via GitHub Actions

**What:** CI pipeline that publishes to npm on version tag push.

**Why:** Manual `npm publish` will be forgotten. Every Chrome Web Store update that changes the `npx` flow needs a matching npm publish. Drift between the extension and the npm package = broken onboarding for new users.

**Context:** `package.json` has `version`, `bin`, and `files` fields configured. Need a `.github/workflows/publish.yml` that triggers on `v*` tag push, runs `npm publish` with an `NPM_TOKEN` secret. First publish must be done manually (`npm login && npm publish`).

**Effort:** S (~30 min)

**Depends on:** npm account created, first manual `npm publish` completed.
