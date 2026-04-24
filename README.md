# Plank

Plank is a CLI and MCP server for syncing local plan documents to a Notion
database with versioned history.

It is built for the files that matter most in a project but often live outside
normal app code: architecture notes, operating plans, handoff docs, and
project memory. Plank keeps those documents on disk, versions every push in
Notion, and exposes the same docs to AI tools through MCP.

## Why Plank

- Keep plan docs local and editable in plain Markdown.
- Push every change as a new Notion version instead of overwriting history.
- Pull the latest remote copy onto a new machine quickly.
- Expose project context to agents through MCP tools.
- Track docs per project with a local `.planrc` file that should stay gitignored.

## Status

Plank is currently in an MVP CLI-first phase. The command surface is in place,
the Notion sync model is implemented, and release/distribution work is underway.

## Install

Requires Node.js 18 or newer.

```bash
npm install -g plank-cli
```

The npm package name is `plank-cli`. The installed command is still `plank`.

Once installed, the CLI entrypoint is:

```bash
plank --help
```

The package also ships a manual page:

```bash
man plank
```

## Quick start

### 1. Configure your machine once

```bash
plank config
```

This writes machine-level settings to `~/.plank/config.json`:

- `notion_token`
- `default_database_id`

### 2. Initialize a project

From your project root:

```bash
plank init
```

This creates a `.planrc` file that tracks your project name, tracked docs, and
an optional per-project Notion database override.

`.planrc` is intended to stay local and should be gitignored.

### 3. Track a document

```bash
plank track ARCHON.md
```

Plank will prompt for a human-readable title that becomes the Notion page title.

### 4. Push to Notion

```bash
plank push -m "initial import"
```

You can also push a single file:

```bash
plank push ARCHON.md -m "refresh architecture notes"
```

If the file is not already tracked, `plank push <file>` will prompt for a title,
add the file to `.planrc`, and continue the push.

## Core commands

```text
plank config
plank config set <key> <value>
plank config show
plank init
plank clone <project> [--db <database_id>]
plank track <file>
plank push [file] [-m <message>]
plank pull [file]
plank status
plank log [file] [-n <limit>]
plank serve
```

## How it works

### Local config

Project-level config lives in `.planrc`:

```json
{
  "project": "archon",
  "description": "Agent flow builder powered by Truss",
  "docs": [
    {
      "file": "ARCHON.md",
      "title": "Archon Architecture"
    }
  ],
  "auto_push": false
}
```

Both `.planrc` and `~/.plank/config.json` should stay out of git.

The repository `.gitignore` should include:

```gitignore
.planrc
```

### Notion storage model

Plank stores document metadata in Notion database properties:

- title property: display title
- `project`
- `file`
- `version`
- `pushed_at`
- `message`
- `checksum`

Document content is stored in the Notion page body as chunked Markdown code
blocks, which lets Plank handle documents larger than a single property value.

### Versioning behavior

- Every successful push creates a new row.
- Existing Notion rows are not updated in place.
- Pushes are deduplicated by checksum, so unchanged files are skipped.

## MCP tools

`plank serve` starts an MCP server over stdio and exposes:

- `plan:get`
- `plan:push`
- `plan:list`
- `plan:history`
- `plan:diff`

These tools use `file` as the canonical identifier and return `title` in responses.

## Example workflows

### Pull the latest versions for a project

```bash
plank pull
```

### Check whether local docs differ from Notion

```bash
plank status
```

### See version history

```bash
plank log
plank log ARCHON.md -n 5
```

### Bootstrap a new machine

Inside the project directory:

```bash
plank config
plank clone archon
```

## Development

```bash
pnpm install
pnpm check:version
pnpm build
pnpm typecheck
pnpm test:smoke
```

For contribution expectations and repo workflow, see [CONTRIBUTING.md](./CONTRIBUTING.md).

For release and package-manager planning, see [docs/SHIPPING.md](./docs/SHIPPING.md).
For SemVer and release version workflow, see [docs/VERSIONING.md](./docs/VERSIONING.md).

## License

MIT. See [LICENSE](./LICENSE).
