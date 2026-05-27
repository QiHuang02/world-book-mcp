import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListSharedInputSchema, ShareSliceInputSchema, UseSharedInputSchema } from "./shared-tool-schemas.js";
import { loadProjectWithSlug } from "../storage/project-store.js";
import { listShared, shareSlice, useShared } from "../storage/shared-store.js";
import { logToolCall } from "../storage/tool-log.js";
import { assertProjectRevisionValue, resolveExpectedProjectRevision, versionSnapshot } from "../storage/version-manager.js";
import { toolText } from "./helpers.js";

export function registerSharedTools(server: McpServer): void {
  server.tool("share_slice", ShareSliceInputSchema.shape, async (input) => toolText(await logToolCall("share_slice", input, async () => {
    const parsed = ShareSliceInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const result = await shareSlice({ slug, type: parsed.draft_type, id: parsed.id, sharedId: parsed.shared_id, title: parsed.title, overwrite: parsed.overwrite });
    return { ok: true, project_id: parsed.project_id, shared: result.entry, path: result.path, slice: result.slice, version: versionSnapshot({ project, slice_revision: result.slice.revision }) };
  })));

  server.tool("use_shared", UseSharedInputSchema.shape, async (input) => toolText(await logToolCall("use_shared", input, async () => {
    const parsed = UseSharedInputSchema.parse(input);
    const { project, slug } = await loadProjectWithSlug(parsed.project_id);
    assertProjectRevisionValue(project, resolveExpectedProjectRevision(parsed));
    const result = await useShared({ slug, sharedId: parsed.shared_id, targetId: parsed.target_id, overwrite: parsed.overwrite });
    return { ok: true, project_id: parsed.project_id, registry_entry: result.registry_entry, path: result.path, slice: result.slice, version: versionSnapshot({ project, slice_revision: result.slice.revision }) };
  })));

  server.tool("list_shared", ListSharedInputSchema.shape, async (input) => toolText(await logToolCall("list_shared", input, async () => {
    const parsed = ListSharedInputSchema.parse(input);
    const entries = await listShared({ type: parsed.draft_type, category: parsed.category, includeContent: parsed.include_content });
    return { count: entries.length, entries };
  })));
}
