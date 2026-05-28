export function stripCdata(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
  if (!match) return value;
  return match[1].replace(/^\r?\n/, "").replace(/\r?\n$/, "");
}

export function normalizeStatusbarVariableMacros(value: string): string {
  return value.replace(/\{\{\s*(stat_data(?:\.[\w$\u4e00-\u9fff-]+)+)\s*\}\}/g, (_match, path: string) => `{{format_message_variable::${path}}}`);
}

export function normalizeStatusbarHtml(value: string): string {
  return normalizeStatusbarVariableMacros(stripCdata(value));
}

export function hasCdata(value: string): boolean {
  return /<!\[CDATA\[|\]\]>/.test(value);
}

export function hasBareStatDataMacro(value: string): boolean {
  return /\{\{\s*stat_data(?:\.[\w$\u4e00-\u9fff-]+)+\s*\}\}/.test(value);
}
