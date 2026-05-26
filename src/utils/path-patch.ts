export type PathToken = string | number | "append";

export function parsePatchPath(path: string): PathToken[] {
  const tokens: PathToken[] = [];
  let buffer = "";
  for (let i = 0; i < path.length; i += 1) {
    const char = path[i];
    if (char === ".") {
      pushBuffer(tokens, buffer);
      buffer = "";
      continue;
    }
    if (char === "[") {
      pushBuffer(tokens, buffer);
      buffer = "";
      const close = path.indexOf("]", i + 1);
      if (close < 0) throw new Error(`field_path 数组索引缺少 ]: ${path}`);
      const raw = path.slice(i + 1, close).trim();
      if (raw === "+") tokens.push("append");
      else if (/^\d+$/.test(raw)) tokens.push(Number(raw));
      else throw new Error(`field_path 数组索引只支持非负整数或 +: ${path}`);
      i = close;
      continue;
    }
    if (char === "]") throw new Error(`field_path 非法 ]: ${path}`);
    buffer += char;
  }
  pushBuffer(tokens, buffer);
  if (tokens.length === 0) throw new Error("field_path 不能为空");
  return tokens;
}

export function setValueAtPath(root: unknown, path: string, value: unknown): unknown {
  const tokens = parsePatchPath(path);
  const data = cloneContainer(root, nextContainerKind(tokens[0]));
  let cursor: unknown = data;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const last = index === tokens.length - 1;
    const nextKind = nextContainerKind(tokens[index + 1]);
    if (last) {
      setChild(cursor, token, value, true);
    } else {
      let child = getChild(cursor, token);
      if (!isContainer(child)) {
        child = nextKind === "array" ? [] : {};
        setChild(cursor, token, child, true);
      }
      cursor = child;
    }
  }
  return data;
}

function pushBuffer(tokens: PathToken[], buffer: string): void {
  if (!buffer) return;
  if (buffer === "append") tokens.push("append");
  else if (/^\d+$/.test(buffer)) tokens.push(Number(buffer));
  else tokens.push(buffer);
}

function nextContainerKind(token: PathToken | undefined): "object" | "array" {
  return typeof token === "number" || token === "append" ? "array" : "object";
}

function cloneContainer(value: unknown, fallback: "object" | "array"): Record<string, unknown> | unknown[] {
  if (Array.isArray(value)) return structuredClone(value);
  if (value && typeof value === "object") return structuredClone(value) as Record<string, unknown>;
  return fallback === "array" ? [] : {};
}

function isContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return Boolean(value && typeof value === "object");
}

function getChild(container: unknown, token: PathToken): unknown {
  if (Array.isArray(container)) {
    const index = arrayIndex(container, token, false);
    return index === undefined ? undefined : container[index];
  }
  if (!container || typeof container !== "object") throw new Error("field_path 中间路径不是对象或数组");
  if (typeof token !== "string") throw new Error("对象路径不能使用数组索引");
  return (container as Record<string, unknown>)[token];
}

function setChild(container: unknown, token: PathToken, value: unknown, allowAppend: boolean): void {
  if (Array.isArray(container)) {
    const index = arrayIndex(container, token, allowAppend);
    if (index === undefined) throw new Error("数组路径缺少有效索引");
    if (index > container.length) throw new Error(`数组索引不能跳跃写入：index=${index}, length=${container.length}`);
    container[index] = value;
    return;
  }
  if (!container || typeof container !== "object") throw new Error("field_path 中间路径不是对象或数组");
  if (typeof token !== "string") throw new Error("对象路径不能使用数组索引");
  (container as Record<string, unknown>)[token] = value;
}

function arrayIndex(array: unknown[], token: PathToken, allowAppend: boolean): number | undefined {
  if (token === "append") {
    if (!allowAppend) throw new Error("field_path 中间路径不支持 [+] append");
    return array.length;
  }
  if (typeof token !== "number") throw new Error("数组路径必须使用数字索引或 [+]");
  return token;
}
