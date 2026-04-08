# Plank

> A CLI + MCP server that syncs your local project plan docs to Notion,
> with versioning, so LLMs and humans always have the same context.

---

## The problem

You work across multiple projects. Each project lives in a main folder:

```
~/projects/
├── archon/
│   ├── frontend/        ← git repo
│   ├── backend/         ← git repo
│   ├── ARCHON.md        ← lives here, outside any repo
│   └── PLAN.md          ← lives here, never committed
├── zariya/
│   ├── web/
│   ├── api/
│   └── ZARIYA.md
```

The root-level `.md` files are your most valuable context — architecture
decisions, project history, current status. But they are:
- Outside any git repo (no version history)
- Only on your local machine (no backup)
- Invisible to LLMs starting a fresh session (no shared memory)

You end up copy-pasting context into every new Claude/Codex session.
Plans drift. Old decisions get lost. You repeat yourself constantly.

---

## What Plank does

Plank is a thin CLI tool + MCP server that:

1. **Syncs** local plan docs to a Notion database on push
2. **Versions** every push — full history of how plans evolved
3. **Exposes** docs as MCP tools so LLMs can read/write plans mid-session
4. **Configures** per-project via a `.planrc` file in the project root

---

## Core workflow

```
# In any project folder with a .planrc:

plank init               # create .planrc interactively (sets project name, db ID, first docs)
plank push               # sync all tracked docs to Notion
plank push ARCHON.md     # sync one specific doc (must already be tracked, or prompts for title)
plank pull               # pull latest version of all tracked docs from Notion
plank pull ARCHON.md     # pull one specific doc
plank status             # show diff between local checksums and latest remote
plank log                # show version history for all tracked docs in this project
plank log ARCHON.md      # version history for one doc
plank track ARCHON.md    # add a new file to .planrc (prompts for title, does not push)
plank clone archon       # on a new machine: create .planrc + pull all docs for that project
plank config             # interactive: set Notion token + default database ID
plank config set notion_token <token>          # set a specific key non-interactively
plank config set default_database_id <db_id>  # set a specific key non-interactively
plank config show        # print current global config (token masked)
```

### First-time tracking a file

When you run `plank push somefile.md` and `somefile.md` is not yet in
`.planrc`, Plank prompts interactively:

```
"somefile.md" is not tracked yet.
Enter a title for this doc (shown in Notion): _
```

After you enter a title, Plank:
1. Adds `{ "file": "somefile.md", "title": "<your title>" }` to `.planrc`
2. Proceeds with the push immediately

Same flow for `plank track somefile.md` — minus the immediate push.

### System-level setup — `plank config`

Before any other command works, the global config needs a Notion token and
a default database ID. `plank config` handles this interactively:

```
plank config

  Notion API token: ****************************  (hidden input)
  Default Notion database ID: abc123...

  ✓ Saved to ~/.plank/config.json
```

Non-interactive form for scripting or dotfiles:

```
plank config set notion_token secret_abc123
plank config set default_database_id abc123def456
```

Print current config (token is always masked):

```
plank config show

  notion_token:        secret_••••••••••••••
  default_database_id: abc123def456
```

Any command that requires global config and finds it missing will tell
you to run `plank config` first rather than failing silently.

---

### Bootstrapping on a new machine — `plank clone <project>`

`.planrc` is intentionally not committed to git. On a new machine there's
no local record of which docs belong to a project. `plank clone` solves
this:

```
plank clone archon
```

Flow:
1. Reads `default_database_id` from `~/.plank/config.json` (prompts once
   if not set — same first-time setup as `plank init`)
2. Queries Notion for all rows where `project = "archon"`
3. **If found:** reconstructs `.planrc` from the unique `file + title`
   pairs in those rows, then pulls the latest version of every doc to disk

   ```
   Cloning project "archon" from Notion...

   ✓ ARCHON.md   "Archon Architecture"   v8   → written
   ✓ PLAN.md     "Project Plan"           v3   → written

   .planrc created. You're set up.
   ```

4. **If not found:** exits cleanly with a prompt

   ```
   No project "archon" found in Notion.
   Run `plank init` to create a new project, or check the project name.
   ```

Complete new machine setup is three steps:
```
npm i -g plank-cli
plank config            # set token + default DB ID once
plank clone archon      # in your project folder
```

### CLI output convention

`file` is used as the identifier in all commands. `title` is always shown
alongside it in output for clarity:

```
plank push

  ✓ ARCHON.md  "Archon Architecture"   v8  (unchanged, skipped)
  ✓ PLAN.md    "Project Plan"          v3  → pushed

plank log ARCHON.md

  ARCHON.md  "Archon Architecture"
  v8   2026-04-08 10:23   no message
  v7   2026-04-07 18:41   "add truss integration notes"
  v6   2026-04-06 09:12   "initial"
```

And from inside a Claude Code / Codex session (via MCP):

```
plan:get("archon")                          # fetch latest plan doc
plan:update("archon", "ARCHON.md", content) # push updated doc
plan:history("archon", limit: 5)            # last 5 versions
plan:list()                                 # all tracked projects
```

---

## .planrc format

Lives at the project root. Committed to git (no secrets in it).

```json
{
  "project": "archon",
  "description": "Agent flow builder powered by Truss",
  "docs": [
    {
      "file": "ARCHON.md",
      "title": "Archon Architecture"
    },
    {
      "file": "PLAN.md",
      "title": "Project Plan"
    },
    {
      "file": "docs/architecture.md",
      "title": "System Design"
    }
  ],
  "notion": {
    "database_id": "your-notion-db-id-here"
  },
  "auto_push": false
}
```

**Why objects instead of strings in `docs`?**

`file` is the local path (generic, changes across machines/repos). `title`
is the human-readable label that appears in Notion as the page title and
identifies the doc across all projects in the shared database. You enter
the title once — on the first push of a new file — and Plank writes it
into `.planrc` so it's never asked again.

Secrets and machine-level defaults live in `~/.plank/config.json` globally —
never in `.planrc`:

```json
{
  "notion_token": "secret_...",
  "default_database_id": "your-notion-db-id-here"
}
```

`default_database_id` is what `plank clone` uses to know which Notion database
to search. Individual projects can override this via `notion.database_id` in
their `.planrc`, but for a single shared brain database you only ever need the
default.

---

## Notion structure

One Notion database acts as the backing store. It is **shared across all
your projects** — each row is one version of one doc. The database ID is
configured in each project's `.planrc`, pointing at the same database.

### Schema

| Property | Type | Description |
|---|---|---|
| `title` | **title** | Human-readable doc title (e.g. `"Archon Architecture"`) — Notion page name |
| `project` | select | Project name from `.planrc` (e.g. `"archon"`) |
| `file` | text | Local filename (e.g. `"ARCHON.md"`) |
| `version` | number | Auto-incrementing per `project + file` |
| `content` | text | Full markdown content |
| `pushed_at` | date | Timestamp of push |
| `message` | text | Optional push message (like a commit message) |
| `checksum` | text | SHA256 of content — skip push when unchanged |

**Why `title` is the Notion page title:** Notion requires one property to
be the title type (the row name). We use the human-readable doc title here
because it makes the database readable at a glance — you can filter/search
by project and immediately see which doc each row represents without
decoding filenames. The `file` column preserves the actual path for CLI
round-trips.

Each push creates a **new row** (not an update) — this is how versioning
works. `plank pull` fetches the row with the highest `version` number for
each `project + file` combination.

---

## MCP server

Plank ships as both a CLI and an MCP server. The same binary, different
entry point:

```bash
plank serve          # starts the MCP server over stdio
```

Add to Claude Code's MCP config:

```json
{
  "mcpServers": {
    "plank": {
      "command": "plank",
      "args": ["serve"]
    }
  }
}
```

### MCP tools exposed

| Tool | Args | Description |
|---|---|---|
| `plan:get` | `project, file?` | Get latest version of a doc (or all docs for the project) |
| `plan:push` | `project, file, content, message?` | Push new version |
| `plan:list` | — | List all projects in backing store |
| `plan:history` | `project, file, limit?` | Last N versions with timestamps |
| `plan:diff` | `project, file, v1, v2` | Diff between two versions |

**`file` is the canonical key** for all tool args — it's stable, unambiguous, and
matches `.planrc`. `title` is display-only: every response includes both so the
output is human-readable without sacrificing programmatic precision.

Example `plan:get` response shape:

```json
{
  "file": "ARCHON.md",
  "title": "Archon Architecture",
  "project": "archon",
  "version": 7,
  "pushed_at": "2026-04-08T10:23:00Z",
  "content": "..."
}
```

This means Claude Code mid-session can call `plan:get("archon", "ARCHON.md")` and
immediately have the full architecture context without you pasting anything.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| CLI runtime | Node.js + TypeScript | Consistent with Archon/Truss work |
| CLI framework | `commander` | Lightweight, well-typed |
| Notion client | `@notionhq/client` | Official SDK, great types |
| MCP server | `@modelcontextprotocol/sdk` | First MCP project — learn it properly |
| Config storage | `~/.plank/config.json` | Simple, no DB needed for phase 1 |
| Checksum | Node `crypto` (SHA256) | Skip pushes when content unchanged |
| Distribution | `npm` global install | `npm i -g plank-cli` |

---

## Monorepo or standalone?

Standalone repo for now — `github.com/ayush/plank`. It is small enough
to not need a monorepo. If it grows (web dashboard, team sync), revisit.

```
plank/
├── src/
│   ├── cli/
│   │   ├── index.ts          # commander entry point
│   │   ├── commands/
│   │   │   ├── config.ts     # plank config [set <key> <val> | show]
│   │   │   ├── init.ts       # plank init (new project from scratch)
│   │   │   ├── clone.ts      # plank clone <project> (bootstrap on new machine)
│   │   │   ├── track.ts      # plank track <file>
│   │   │   ├── push.ts       # plank push [file]
│   │   │   ├── pull.ts       # plank pull [file]
│   │   │   ├── status.ts     # plank status
│   │   │   └── log.ts        # plank log [file]
│   ├── mcp/
│   │   ├── server.ts         # MCP server entry point
│   │   └── tools/
│   │       ├── get.ts
│   │       ├── push.ts
│   │       ├── list.ts
│   │       ├── history.ts
│   │       └── diff.ts
│   ├── notion/
│   │   ├── client.ts         # thin wrapper around @notionhq/client
│   │   ├── push.ts           # create new version row
│   │   ├── pull.ts           # fetch latest version
│   │   └── query.ts          # history, diff, list
│   ├── config/
│   │   ├── planrc.ts         # read/write .planrc
│   │   └── global.ts         # read/write ~/.plank/config.json
│   └── utils/
│       ├── checksum.ts       # SHA256 helpers
│       └── diff.ts           # text diff between versions
├── package.json
├── vitest.config.ts
└── PLANK.md                  # this file
```

---

## What to build first (ordered)

1. `src/config/planrc.ts` — types and read/write for `.planrc`; docs are `{ file, title }[]`
2. `src/config/global.ts` — read/write `~/.plank/config.json` (Notion token, default db ID)
3. `src/notion/client.ts` — init Notion client, verify connection
4. `src/notion/push.ts` — create new version row (title, project, file, version, content, checksum, pushed_at, message)
5. `src/notion/pull.ts` — fetch row with highest version for a given `project + file`
6. `src/notion/query.ts` — history, list projects, checksum lookup
7. `plank config` — read/write `~/.plank/config.json`; interactive + `set`/`show` subcommands; token masking
8. `plank init` — interactive: project name, database ID, first docs (with title prompts)
9. `plank clone <project>` — query Notion for project rows, reconstruct `.planrc`, pull latest docs
10. `plank track <file>` — add untracked file to `.planrc` with title prompt
11. `plank push [file]` — checksum check → skip or create row; if file untracked → run track flow first
12. `plank pull [file]` — fetch latest version, write to disk
13. `plank status` — compare local checksums to latest remote checksums
14. `plank log [file]` — version history from Notion
15. `src/mcp/server.ts` — wire up MCP tools using the same `notion/` layer
16. Unit tests — `vitest` for pure functions (checksum, diff, chunkContent, planrc/global helpers)
17. Integration tests — mocked Notion client for push/pull/query logic
18. Manual E2E checklist — real Notion DB, full command walkthrough, MCP smoke test

---

## Testing strategy

### Unit tests (vitest)

**Why vitest:** ESM-native, zero config for TypeScript + Node, fast. Jest requires painful ESM shims.

Add to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Add `vitest` as a dev dependency.

#### What to unit test (no Notion needed)

| File | What to test |
|---|---|
| `src/utils/checksum.ts` | `sha256` is deterministic; `isUnchanged` returns correct bool |
| `src/utils/diff.ts` | `unifiedDiff` produces expected patch for known inputs |
| `src/notion/client.ts` | `chunkContent` splits at correct boundaries, handles exact-length and empty strings |
| `src/config/planrc.ts` | `findDoc`, `resolveDbId`, `addDoc` with temp directories |
| `src/config/global.ts` | `maskToken` masks correctly; read/write round-trips |

#### What to integration test (mocked Notion client)

Mock `@notionhq/client` with `vi.mock()` to test the Notion layer logic without hitting the real API:

| File | What to test |
|---|---|
| `src/notion/push.ts` | Skips push when checksum matches; creates page + blocks when content changed; increments version |
| `src/notion/pull.ts` | Writes file when content differs; skips when checksum matches; handles not-found |
| `src/notion/query.ts` | Filters correctly by project + file; deduplicates for `getProjectDocs` |

#### What NOT to automate

- Full CLI command tests — covered by manual E2E checklist below
- Real Notion API calls in CI — too slow, needs credentials, Notion has rate limits

### Manual E2E checklist (pre-release)

Run this against a real Notion database before any release:

```
Setup
  [ ] pnpm build passes clean
  [ ] plank config — stores token + DB ID in ~/.plank/config.json
  [ ] plank config show — token is masked

New project flow
  [ ] plank init — creates .planrc with correct shape
  [ ] plank push <new file> — prompts for title, creates row in Notion
  [ ] plank push <same file> — skipped (unchanged)
  [ ] plank push <modified file> — pushed as v2
  [ ] plank status — shows correct M / ✓ / + states
  [ ] plank log <file> — shows v1 and v2 with timestamps

Pull + clone flow
  [ ] plank pull <file> — writes file from Notion, skips if up to date
  [ ] rm .planrc && plank clone <project> — reconstructs .planrc + pulls all docs

MCP flow
  [ ] plank serve starts without error
  [ ] plan:list returns correct projects
  [ ] plan:get returns latest content with title in response
  [ ] plan:push creates new version
  [ ] plan:history returns versions newest-first
  [ ] plan:diff returns unified patch between two versions
```

### Test file structure

```
src/
  utils/
    checksum.test.ts
    diff.test.ts
  notion/
    client.test.ts     # chunkContent unit tests
    push.test.ts       # mocked client
    pull.test.ts       # mocked client
    query.test.ts      # mocked client
  config/
    planrc.test.ts     # temp dir I/O
    global.test.ts     # temp dir I/O
```

---

## Phase 2: Archon integration

Once Plank is stable, Truss gets a native `PlanNode` — a worker that
calls `plan:get` at the start of any flow to seed context automatically.
Every Archon flow can self-hydrate from the latest plan doc without
any manual setup.

## Phase 3: Own cloud library

Replace Notion with a purpose-built backend:
- Versioned doc storage (PostgreSQL + S3 or R2)
- Team sharing and access control
- Web UI to browse, diff, and annotate plan history
- Webhooks so external tools can subscribe to plan changes

Plank CLI stays the same — just points at a different API endpoint.

---

## Suggested first Claude Code prompt

```
Read PLANK.md for full project context.
Scaffold the project: init package.json with TypeScript, commander,
@notionhq/client, @modelcontextprotocol/sdk.
Then implement src/config/planrc.ts and src/config/global.ts —
read and write .planrc and ~/.plank/config.json with full types.
No CLI wiring yet, just the config layer with tests.
```

---

## Naming

**Plank** — a plank is a structural member that connects two points and
carries load. Here it connects your local working context to a shared
backing store. Also: planks make up a floor — your plan docs are the
floor everything else is built on.

Fits the Archon/Truss naming universe (structural / architectural).

---

*Status: Concept — ready to scaffold*
*Last updated: April 2026*
