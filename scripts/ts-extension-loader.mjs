import { extname } from "node:path";

export async function resolve(specifier, context, defaultResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (isRelative && !extname(specifier)) {
    try {
      return await defaultResolve(specifier + ".ts", context, defaultResolve);
    } catch {
      // Preserve Node's normal resolver error for unresolved specifiers.
    }
  }
  return defaultResolve(specifier, context, defaultResolve);
}
