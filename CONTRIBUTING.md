# Contributing to Plank

Thanks for helping improve Plank. This project is still in an early CLI-first
phase, so the best contributions are the ones that keep the tool reliable,
predictable, and easy to reason about.

## What we value

- Small, focused pull requests.
- Changes that match the current product direction in `INIT_PLAN.md`.
- Clear command-line behavior and user-facing output.
- Good judgment around secrets, local files, and Notion API interactions.

## Before you start

- Read `AGENTS.md` for repo-specific implementation constraints.
- Read `INIT_PLAN.md` to understand the product scope and current phase.
- Check whether the change belongs in the CLI, Notion layer, config layer, or MCP server.
- If the change shifts behavior, update docs in the same pull request.

## Local setup

```bash
pnpm install
pnpm build
pnpm typecheck
```

If you are testing against a real Notion workspace, use a local
`~/.plank/config.json`, keep `.planrc` gitignored, and never commit local
workspace secrets or machine-specific config into the repository.

## Development guidelines

- Use TypeScript with ESM and NodeNext-compatible imports.
- Always use `.js` extensions for internal imports, even in `.ts` source files.
- Reuse shared helpers such as `resolveDbId()` and `getTitlePropertyName()` instead
  of duplicating config or Notion schema logic.
- Treat `file` as the canonical identifier and `title` as the display label.
- Do not hardcode the Notion title property name.
- Do not mutate old Notion rows in place; pushes create new versions.
- Keep CLI output consistent with the existing `file  "title"` convention.

## Pull request expectations

- Explain the problem and the user-visible outcome.
- Keep refactors separate from behavior changes when possible.
- Add or update tests when behavior changes.
- Include doc updates for new commands, flags, workflows, or release steps.
- Call out any known gaps honestly so reviewers know where to look.

## Good first contributions

- Improve command help text and docs.
- Add smoke tests around CLI behavior.
- Tighten error messages and recovery hints.
- Improve packaging, release automation, and install docs.
- Add MCP tool coverage tests once the core CLI is stable.

## Community guidelines

We want this repo to feel welcoming, direct, and useful.

- Be respectful and assume good intent.
- Give actionable review feedback.
- Prefer curiosity over dunking when something is wrong.
- Keep discussions focused on making the product better.
- If a thread gets stuck, summarize tradeoffs and propose a path forward.

## Reporting bugs

When opening an issue or PR, include:

- What command you ran.
- What you expected to happen.
- What happened instead.
- Your OS, Node version, and package manager.
- Whether the issue involves local config, `.planrc`, or Notion sync state.

## Release-related changes

If your contribution affects installation or distribution, update
`docs/SHIPPING.md` in the same pull request so the release plan stays current.
