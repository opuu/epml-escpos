/**
 * Resolves a dot-notation path like "user.profile.name" or "items.0.price"
 * within a given data object. Correctly handles array indices.
 */
export function resolvePath(path: string, data: any): any {
  if (!path || !data) return undefined;

  const segments = path.split(".");
  let current = data;

  for (const segment of segments) {
    if (current == null) return undefined;

    // Support array index if segment is purely numeric
    if (/^\d+$/.test(segment)) {
      const index = parseInt(segment, 10);
      current = current[index];
    } else {
      current = current[segment];
    }
  }

  return current;
}

/**
 * Replaces all interpolation tags `{{ path }}` in a string with their resolved values
 */
export function interpolateString(template: string, data: any): string {
  if (!template) return template;

  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, path) => {
    const value = resolvePath(path, data);
    return value !== undefined && value !== null ? String(value) : ""; // Or keep the match if undefined? Let's render empty if missing.
  });
}
