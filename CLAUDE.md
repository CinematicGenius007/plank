# Plank — AI Context File

> CLI + MCP server that syncs local plan docs to a Notion database with versioning.
> See `INIT_PLAN.md` for the full product specification.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js ≥ 18, TypeScript 5, ESM (`"type": "module"`) |
| CLI framework | `commander` v12 |
| Interactive prompts | `@inquirer/prompts` v7 (ESM) |
| Notion | `@notionhq/client` v2 |
| MCP server | `@modelcontextprotocol/sdk` v1 |
| Output / colours | `chalk` v5 (ESM) |
| Diffing | `diff` v7 |
| Module resolution | `NodeNext` — all imports use `.js` extension even for `.ts` source |

---

## Project Structure

```
src/
  config/
    types.ts         # All shared interfaces: PlanRC, GlobalConfig, NotionRow, PushResult, PullResult
    planrc.ts        # Read/write .planrc; findDoc, addDoc, resolveDbId helpers
    global.ts        # Read/write ~/.plank/config.json; maskToken
  notion/
    client.ts        # getClient(), getTitlePropertyName() (dynamic discovery), chunkContent()
    push.ts          # pushDoc() — creates a new Notion page (version row) with metadata + body blocks
    pull.ts          # pullDoc() — fetches latest row, writes content to disk
    query.ts         # getLatestRow, getNextVersion, getHistory, getProjectDocs, listProjects, getLatestChecksum
  utils/
    checksum.ts      # sha256(), isUnchanged()
    output.ts        # Terminal output helpers: success/skipped/pushed/written/warn/error/header
    diff.ts          # unifiedDiff(), colorDiff() wrapping the `diff` package
  cli/
    index.ts         # Commander entry point; registers all commands + `serve`
    commands/
      config.ts      # plank config [set <key> <val> | show]
      init.ts        # plank init — interactive .planrc creation
      clone.ts       # plank clone <project> — bootstrap .planrc + pull all docs
      track.ts       # plank track <file> — add to .planrc; exports promptAndTrack() helper
      push.ts        # plank push [file] [-m msg]
      pull.ts        # plank pull [file]
      status.ts      # plank status
      log.ts         # plank log [file] [-n limit]
  mcp/
    server.ts        # startMcpServer() — registers all 5 plan:* tools over stdio
```

---

## Key Data Shapes

### `.planrc` (project root, committed to git)
```json
{
  "project": "archon",
  "description": "...",
  "docs": [
    { "file": "ARCHON.md", "title": "Archon Architecture" }
  ],
  "notion": { "database_id": "optional-override" },
  "auto_push": false
}
```

### `~/.plank/config.json` (machine-level, never committed)
```json
{
  "notion_token": "secret_...",
  "default_database_id": "abc123"
}
```

### Notion database schema
| Property | Type | Notes |
|---|---|---|
| *(title property)* | title | Name varies per DB — discovered dynamically via `getTitlePropertyName()` |
| `project` | select | Project code name |
| `file` | rich_text | Local file path |
| `version` | number | Auto-increments per `project + file` |
| `pushed_at` | date | ISO 8601 |
| `message` | rich_text | Optional |
| `checksum` | rich_text | SHA-256 of content |

**Content** is stored in the **page body** as code blocks (language: `markdown`), chunked at 2000 chars. Properties store only metadata. `getPageContent()` in `query.ts` reads and concatenates all code blocks.

---

## Critical Patterns

### ESM imports
All internal imports must use `.js` extension:
```typescript
import { readPlanRC } from "../../config/planrc.js";
```

### Notion SDK v5 API — critical differences from older versions
- **Types**: import from `@notionhq/client` directly — **not** from `@notionhq/client/build/src/api-endpoints.js`
  ```typescript
  import { isFullPage, isFullDatabase } from "@notionhq/client";
  import type { Client, PageObjectResponse } from "@notionhq/client";
  ```
- **Querying**: `client.databases.query()` is **gone**. Use `client.dataSources.query()` with `data_source_id` (not `database_id`). Filter/sorts syntax is unchanged.
- **Schema / properties**: `databases.retrieve()` no longer returns `properties`. Use `client.dataSources.retrieve({ data_source_id })` → `DataSourceObjectResponse.properties` instead. Use `isFullDataSource()` type guard before accessing.
  ```typescript
  client.dataSources.query({ data_source_id: "...", filter: {...}, sorts: [...] })
  ```
- **Type guards**: use `isFullPage()` and `isFullDatabase()` to narrow union response types before accessing properties
- **Database title**: `db.title` is `RichTextItemResponse[]` — use `.map(t => t.plain_text).join("")`. Always guard with `isFullDatabase(db)` first.
- `pages.create()` and `blocks.children.append/list` are unchanged

### Notion title property discovery
Notion databases have exactly one `title`-type property but its name varies (default: "Name"). We discover it with `getTitlePropertyName(client, databaseId)` which caches results in memory. Never hardcode `"Name"` or `"title"`.

### Content storage
Large files are split into 2000-char chunks in `chunkContent()` and stored as multiple code blocks in the page body. On read, `getPageContent()` concatenates them. This handles files of any size.

### File vs Title
- `file` = canonical key for all operations (CLI args, MCP args, `.planrc` lookups)
- `title` = display label (Notion page name, shown in all CLI output alongside `file`)
- CLI output always shows both: `ARCHON.md  "Archon Architecture"`

### Push deduplication
`pushDoc()` checks `isUnchanged(content, latest.checksum)` before creating a new row. If unchanged, returns `{ outcome: "skipped" }` — no Notion API write happens.

### First-time tracking
`push.ts` calls `promptAndTrack()` from `track.ts` when a file isn't in `.planrc` yet. After title input, `.planrc` is written and push continues.

### Database ID resolution
`resolveDbId(rc, globalCfg.default_database_id)` — project-level `.planrc` override takes priority over global default.

---

## CLI Commands Summary

| Command | What it does |
|---|---|
| `plank config` | Interactive global setup (token + DB ID) |
| `plank config set <key> <val>` | Non-interactive key set |
| `plank config show` | Print config with masked token |
| `plank init` | Create `.planrc` interactively |
| `plank clone <project>` | Reconstruct `.planrc` + pull all docs from Notion |
| `plank track <file>` | Add file to `.planrc` (prompts for title) |
| `plank push [file] [-m msg]` | Push all or one doc; tracks first if untracked |
| `plank pull [file]` | Pull latest from Notion |
| `plank status` | Compare local checksums to remote |
| `plank log [file] [-n N]` | Version history |
| `plank serve` | Start MCP server over stdio |

## MCP Tools

`plan:get`, `plan:push`, `plan:list`, `plan:history`, `plan:diff` — all use `file` as the identifier and return `title` in responses.

---

## Do's and Don'ts

- **Do** use `resolveDbId()` — never access `globalCfg.default_database_id` directly in commands
- **Do** call `getTitlePropertyName()` before writing page properties — the property name is DB-specific
- **Do** show `file  "title"` in all user-facing output (use `docLabel()` from `output.ts`)
- **Don't** store the Notion token in `.planrc` — it goes in `~/.plank/config.json` only
- **Don't** update existing Notion rows — every push creates a new row (versioning model)
- **Don't** read content from Notion properties — it's in the page body (code blocks)
- **Don't** hardcode the title property name — always use `getTitlePropertyName()`

---

## Known Issues / Active Plan

See `INIT_PLAN.md` for full specification.  
Phase 1 (current): CLI + MCP MVP — all commands scaffolded, needs `npm install` + real Notion DB to test end-to-end.  
Phase 2: Archon/Truss `PlanNode` integration.  
Phase 3: Own cloud backend to replace Notion.

---

_Last updated: April 2026. Initial scaffold — all source files written, dependencies not yet installed._
