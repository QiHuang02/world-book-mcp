export function toPrettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function safeJsonParse<T = unknown>(text: string): T {
  return JSON.parse(text) as T;
}
