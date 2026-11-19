import superjson from "superjson";

type Mark = ["Date"] | ["undefined"];

const escapeKey = (key: string) => key.replace(/\\/g, "\\\\").replace(/\./g, "\\.");

/**
 * What `superjson.stringify` writes, built with the native `JSON.stringify` for plain data, Dates
 * and undefined: superjson's own walk took ~250 ms on a 1.6 MB read cache. Anything else (a Map,
 * NaN, a class) goes to superjson, so `superjson.parse` reads either back the same.
 */
export function stringifyStored(value: unknown): string {
  const values: Record<string, Mark> = {};
  const path: string[] = [];
  const mark = (type: Mark[0]) => {
    values[path.map(escapeKey).join(".")] = [type];

    return true;
  };
  const visit = (key: string, item: unknown): boolean => {
    path.push(key);
    const plain = walk(item);

    path.pop();

    return plain;
  };
  const walk = (node: unknown): boolean => {
    if (node === null || typeof node === "string" || typeof node === "boolean") return true;
    if (typeof node === "number") return Number.isFinite(node) && !Object.is(node, -0);
    if (node === undefined) return mark("undefined");
    if (node instanceof Date) return !Number.isNaN(node.getTime()) && mark("Date");
    if (typeof node !== "object") return false;
    if (Array.isArray(node)) return node.every((item, index) => visit(String(index), item));

    const proto: unknown = Object.getPrototypeOf(node);

    if (proto !== Object.prototype && proto !== null) return false;

    return Object.keys(node).every((key) => visit(key, (node as Record<string, unknown>)[key]));
  };

  if (value === null || typeof value !== "object" || value instanceof Date || !walk(value)) {
    return superjson.stringify(value);
  }

  return JSON.stringify(
    Object.keys(values).length > 0 ? { json: value, meta: { values, v: 1 } } : { json: value }
  );
}
