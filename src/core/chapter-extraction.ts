import type { ChapterEntry, ChapterOutline } from "../schemas/chapter-outline.js";
import type { WorldbookDraftEntry } from "../schemas/worldbook-draft.js";

export function createChapterExtractionTemplate(input: { title?: string; chapter_count?: number } = {}): ChapterOutline {
  const count = Math.max(1, Math.min(input.chapter_count ?? 3, 30));
  const chapters: ChapterEntry[] = Array.from({ length: count }, (_, index) => ({
    title: `第${index + 1}章`,
    startLine: undefined,
    endLine: undefined,
    summary: "",
    key_events: [],
    character_state_changes: [],
    world_changes: [],
    item_ability_reveals: [],
    keys: [],
  }));
  return { title: input.title ?? "章节提取大纲", chapters };
}

export function buildChapterWorldbookEntries(outline: ChapterOutline, options: { base_order?: number; comment_prefix?: string } = {}): { worldbookEntries: WorldbookDraftEntry[] } {
  const baseOrder = options.base_order ?? 100;
  const prefix = options.comment_prefix ?? "故事";
  const entries: WorldbookDraftEntry[] = outline.chapters.map((chapter, index) => {
    const keys = collectKeys(chapter);
    return {
      comment: `${prefix}_${chapter.title}`,
      entryType: "event",
      keys,
      secondaryKeys: [],
      content: renderChapterContent(chapter),
      constant: false,
      position: "after_char",
      order: baseOrder + index,
      enabled: true,
      depth: undefined,
      scanDepth: 2,
      preventRecursion: true,
      excludeRecursion: true,
    };
  });
  return { worldbookEntries: entries };
}

function collectKeys(chapter: ChapterEntry): string[] {
  const seen = new Set<string>();
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !seen.has(trimmed)) seen.add(trimmed);
  };
  for (const key of chapter.keys) push(key);
  push(chapter.title);
  for (const event of chapter.key_events) {
    const head = event.split(/[，,。 ]/, 1)[0];
    if (head) push(head);
  }
  return [...seen];
}

function renderChapterContent(chapter: ChapterEntry): string {
  const lineRange = chapter.startLine && chapter.endLine ? `L${chapter.startLine}-L${chapter.endLine}` : "";
  return `<chapter>\ntitle: ${chapter.title}\nline_range: ${lineRange}\nsummary: ${chapter.summary || "待补充"}\nkey_events:\n${list(chapter.key_events)}character_state_changes:\n${list(chapter.character_state_changes)}world_changes:\n${list(chapter.world_changes)}item_ability_reveals:\n${list(chapter.item_ability_reveals)}</chapter>`;
}

function list(items: string[]): string {
  if (items.length === 0) return "  - 待补充\n";
  return items.map((item) => `  - ${item}`).join("\n") + "\n";
}
