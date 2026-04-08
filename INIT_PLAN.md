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

plank push               # sync all tracked docs to Notion
plank pull               # pull latest from Notion to local
plank status             # show diff between local and remote
plank log                # show version history for this project
plank init               # create .planrc interactively
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
    "ARCHON.md",
    "PLAN.md",
    "docs/architecture.md"
  ],
  "notion": {
    "database_id": "your-notion-db-id-here"
  },
  "auto_push": false
}
```

Secrets (Notion API token) live in `~/.plank/config.json` globally —
never in `.planrc`.

---

## Notion structure

One Notion database acts as the backing store. Schema:

| Property | Type | Description |
|---|---|---|
| `project` | title | Project name from `.planrc` |
| `doc` | text | Filename (e.g. `ARCHON.md`) |
| `version` | number | Auto-incrementing per project+doc |
| `content` | text | Full markdown content |
| `pushed_at` | date | Timestamp of push |
| `message` | text | Optional push message (like a commit message) |
| `checksum` | text | SHA256 of content — detect unchanged docs |

Each push creates a **new row** (not an update) — this is how versioning
works. `plank pull` fetches the row with the highest version number for
each doc.

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
| `plan:get` | `project, doc?` | Get latest version of a doc (or all docs) |
| `plan:push` | `project, doc, content, message?` | Push new version |
| `plan:list` | — | List all projects in backing store |
| `plan:history` | `project, doc, limit?` | Last N versions with timestamps |
| `plan:diff` | `project, doc, v1, v2` | Diff between two versions |

This means Claude Code mid-session can call `plan:get("archon")` and
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
│   │   │   ├── init.ts       # plank init
│   │   │   ├── push.ts       # plank push
│   │   │   ├── pull.ts       # plank pull
│   │   │   ├── status.ts     # plank status
│   │   │   └── log.ts        # plank log
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
└── PLANK.md                  # this file
```

---

## What to build first (ordered)

1. `src/config/` — read `.planrc` and `~/.plank/config.json`
2. `src/notion/client.ts` — init Notion client, test connection
3. `plank init` — interactive setup, creates `.planrc`
4. `plank push` — read tracked docs, checksum check, create Notion rows
5. `plank pull` — fetch latest version per doc, write to local files
6. `plank status` — compare local checksums to latest remote
7. `plank log` — list version history from Notion
8. `src/mcp/server.ts` — wire up MCP tools using the same notion/ layer
9. Test MCP integration with Claude Code

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
