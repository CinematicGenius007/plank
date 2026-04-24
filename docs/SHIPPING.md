# Shipping Plank

This document turns the current MVP into a release plan we can execute in stages.
The goal is simple: make `plank` easy to install on macOS, Linux, and Windows,
while keeping the first release small enough to ship confidently.

## Release goals

- Ship a stable npm package with a documented CLI and man page.
- Make installation straightforward across all major desktop platforms.
- Add enough automation that releases are repeatable instead of heroic.
- Create a clear path for community contributions once external users arrive.

## Recommended rollout

### Phase 1: solidify the npm release

This is the fastest path to "works everywhere" because Node.js already gives us
cross-platform execution.

- Keep `bin.plank` pointing to `dist/cli/index.js`.
- Publish `dist/` and `man/plank.1` in the package tarball.
- Keep `README.md`, `LICENSE`, `CHANGELOG.md`, and `CONTRIBUTING.md` current.
- Keep smoke tests covering `plank --help`, `plank --version`, and core config flows.
- Keep CI green on Node 18, 20, and 22 across Ubuntu, macOS, and Windows.
- Add and maintain an automated npm publish flow that runs only after tagged release validation passes.

Suggested public install:

```bash
npm install -g plank-cli
```

Package naming decision:

- Publish the npm package as `plank-cli`.
- Keep the executable name as `plank`.
- Use `plank-cli` in package-manager metadata where the package name must be unique.

### Phase 2: package-manager coverage

Once npm is stable, add package-manager entry points that either wrap the npm
package or install the published tarball.

#### Homebrew (macOS and Linux)

Best for developer adoption on macOS, and increasingly common on Linux too.

- Create a tap such as `plankdev/tap`.
- Add a `plank.rb` formula that installs from the npm tarball or GitHub release tarball.
- Ensure the formula installs the executable and the man page.
- Add a release step that updates the formula checksum automatically.

#### Scoop (Windows)

Scoop is usually the easiest Windows package manager for Node-based CLIs.

- Create a Scoop bucket or submit to a shared bucket later.
- Publish a manifest pointing to a zip or npm-packed artifact.
- Validate install, update, and uninstall on Windows in CI.

Suggested install target:

```powershell
scoop bucket add plank https://github.com/<org>/scoop-plank
scoop install plank
```

#### Winget (Windows)

Winget is worth adding after Scoop because it reaches a broader Windows audience.

- Publish versioned release artifacts on GitHub.
- Submit a manifest to the `microsoft/winget-pkgs` repository.
- Keep release notes and version metadata consistent with Git tags.

#### APT, RPM, Pacman, and friends

Do not block the first release on native Linux distro packages.
They are valuable, but they add maintenance overhead quickly.
Start with npm plus Homebrew, then revisit native Linux packaging after there is
real usage demand.

### Phase 3: standalone binaries

If we want installs that do not require Node.js, add standalone binaries later.

Options to evaluate:

- `pkg` or a similar Node runtime bundler for single-file executables.
- A small installer script that downloads a release artifact for the current platform.

Only do this after the CLI surface is stable. Binary packaging adds release
complexity and debugging overhead, especially around ESM, filesystem paths, and
native platform behavior.

## What "all platforms" should mean for v1

For the first public release, a practical definition is:

- macOS: npm and Homebrew
- Linux: npm and optionally Homebrew
- Windows: npm, Scoop, and then Winget

That gives us usable coverage without forcing native packaging on day one.

## Release engineering checklist

- Keep `README.md`, `LICENSE`, `CHANGELOG.md`, and `CONTRIBUTING.md` current.
- Keep GitHub Actions for CI and tagged release publishing healthy.
- Keep the versioning policy explicit: SemVer, with `0.x` allowed for breaking changes until stable.
- Verify `npm pack` includes only the intended files.
- Test install from the packed tarball on macOS, Linux, and Windows.
- Confirm `plank --help`, `plank config --help`, and `man plank` work after install.
- Confirm ESM entry points run correctly under the supported Node versions.
- Document required Notion setup clearly for first-time users.

## CI and automation plan

Recommended workflows:

- `ci.yml`: run `pnpm check:version`, install dependencies, run `npm run build`, run `npm run typecheck`,
  and execute smoke tests on a platform matrix.
- `release.yml`: on version tags, build once, run final validation, publish to npm,
  and optionally open automated PRs for Homebrew/Scoop manifests.

## Suggested next implementation steps

1. Push the repository to GitHub and confirm the CI matrix passes there.
2. Add `NPM_TOKEN` to GitHub repository secrets and validate the tagged release workflow.
3. Publish an initial npm prerelease and test install from a clean machine.
4. Verify `plank --help`, `plank config --help`, and `man plank` after prerelease install.
5. Publish the first stable npm release for `plank-cli`.
6. Add a Homebrew tap after the npm package is confirmed working.
7. Add Scoop next, then Winget once release artifacts are consistent.

## Open questions

- Do we want Node.js to be a runtime requirement for v1, or do we want to commit
  early to shipping standalone binaries?
- Will the public release be GitHub-first, npm-first, or both at the same time?
