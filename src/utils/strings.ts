export function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value).trim()).filter(Boolean)));
}
