import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readGlobalConfig } from "../config/global.js";
import { getClient } from "../notion/client.js";
import { getLatestRow, getHistory, listProjects, getLatestChecksum } from "../notion/query.js";
import { pushDoc } from "../notion/push.js";
import { unifiedDiff } from "../utils/diff.js";
import type { GlobalConfig } from "../config/types.js";

const TOOLS = [
  {
    name: "plan:get",
    description:
      "Get the latest version of a plan doc (or all docs for a project). Returns file, title, version, pushed_at, and content.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string", description: "Project code name" },
        file: { type: "string", description: "Optional: specific file to fetch (e.g. ARCHON.md)" },
        database_id: { type: "string", description: "Optional: Notion database ID (uses global default if omitted)" },
      },
      required: ["project"],
    },
  },
  {
    name: "plan:push",
    description: "Push a new version of a doc to Notion.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        file: { type: "string", description: "File identifier (e.g. ARCHON.md)" },
        title: { type: "string", description: "Human-readable title shown in Notion" },
        content: { type: "string", description: "Full markdown content" },
        message: { type: "string", description: "Optional push message" },
        database_id: { type: "string" },
      },
      required: ["project", "file", "title", "content"],
    },
  },
  {
    name: "plan:list",
    description: "List all project names in the Notion backing store.",
    inputSchema: {
      type: "object",
      properties: {
        database_id: { type: "string" },
      },
    },
  },
  {
    name: "plan:history",
    description: "Get version history for a doc (newest first, no content).",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        file: { type: "string" },
        limit: { type: "number", description: "Max versions to return (default 10)" },
        database_id: { type: "string" },
      },
      required: ["project", "file"],
    },
  },
  {
    name: "plan:diff",
    description: "Show a unified diff between two specific versions of a doc.",
    inputSchema: {
      type: "object",
      properties: {
        project: { type: "string" },
        file: { type: "string" },
        v1: { type: "number", description: "Older version number" },
        v2: { type: "number", description: "Newer version number" },
        database_id: { type: "string" },
      },
      required: ["project", "file", "v1", "v2"],
    },
  },
];

function ok(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "plank", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    let globalCfg: GlobalConfig;
    try {
      globalCfg = readGlobalConfig();
    } catch (e) {
      return fail("Plank is not configured. Run `plank config` on this machine first.");
    }

    const client = getClient(globalCfg);
    const args = req.params.arguments as Record<string, unknown>;
    const dbId = (args.database_id as string | undefined) ?? globalCfg.default_database_id;

    try {
      switch (req.params.name) {
        case "plan:get": {
          const project = args.project as string;
          const file = args.file as string | undefined;

          if (file) {
            const row = await getLatestRow(client, dbId, project, file);
            if (!row) return fail(`No doc found: ${project}/${file}`);
            return ok(row);
          }

          // All docs for project — fetch latest per file
          const { getProjectDocs } = await import("../notion/query.js");
          const docs = await getProjectDocs(client, dbId, project);
          const rows = await Promise.all(
            docs.map((d) => getLatestRow(client, dbId, project, d.file))
          );
          return ok(rows.filter(Boolean));
        }

        case "plan:push": {
          const result = await pushDoc(client, globalCfg, {
            project: args.project as string,
            file: args.file as string,
            title: args.title as string,
            content: args.content as string,
            databaseId: dbId,
            message: args.message as string | undefined,
          });
          return ok(result);
        }

        case "plan:list": {
          const projects = await listProjects(client, dbId);
          return ok({ projects });
        }

        case "plan:history": {
          const history = await getHistory(
            client,
            dbId,
            args.project as string,
            args.file as string,
            (args.limit as number | undefined) ?? 10
          );
          return ok(history);
        }

        case "plan:diff": {
          const project = args.project as string;
          const file = args.file as string;
          const v1 = args.v1 as number;
          const v2 = args.v2 as number;

          // Fetch both versions
          const { queryProject, pageToRow } = await import("../notion/query.js");
          const pages = await queryProject(client, dbId, project);

          const findVersion = async (v: number) => {
            for (const page of pages) {
              const vProp = page.properties["version"];
              if (vProp?.type === "number" && vProp.number === v) {
                const fileProp = page.properties["file"];
                if (fileProp?.type === "rich_text") {
                  const fileVal = fileProp.rich_text.map((r) => r.plain_text).join("");
                  if (fileVal === file) return pageToRow(client, page);
                }
              }
            }
            return null;
          };

          const [rowA, rowB] = await Promise.all([findVersion(v1), findVersion(v2)]);
          if (!rowA) return fail(`Version ${v1} not found for ${file}`);
          if (!rowB) return fail(`Version ${v2} not found for ${file}`);

          const patch = unifiedDiff(
            rowA.content,
            rowB.content,
            `${file} (v${v1})`,
            `${file} (v${v2})`
          );
          return ok({ file, v1, v2, diff: patch });
        }

        default:
          return fail(`Unknown tool: ${req.params.name}`);
      }
    } catch (e) {
      return fail(String(e));
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
