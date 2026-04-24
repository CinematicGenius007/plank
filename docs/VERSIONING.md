# Versioning

Plank should use Semantic Versioning for releases:

- `MAJOR`: breaking CLI, MCP, or config changes
- `MINOR`: backwards-compatible features and workflow additions
- `PATCH`: backwards-compatible fixes, docs corrections, and packaging fixes

## Current release posture

Until `1.0.0`, the project is still stabilizing. That means:

- breaking changes are still possible
- they should still be called out clearly in `CHANGELOG.md`
- release notes should state migration impact when behavior changes

## Source of truth

The package version in `package.json` is the source of truth.

Runtime consumers read from that shared version:

- the CLI `--version` output
- the MCP server version metadata

## Release checklist

1. Update `package.json` version.
2. Update `man/plank.1` if the packaged manual still shows the previous version.
3. Add a `CHANGELOG.md` entry for the release.
4. Run:

```bash
pnpm check:version
pnpm build
pnpm typecheck
pnpm test:smoke
```

5. Tag the release in Git.
6. Publish to GitHub, then npm, then package managers.

## Notes

- The npm package name is `plank-cli`.
- The installed command remains `plank`.
- CI should fail if the manual page and package version drift.
