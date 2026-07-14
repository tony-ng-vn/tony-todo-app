// Mirrors the parsing used in functions/ingest-granola-loops.ts (that Deno
// function is deployed as a single file and cannot import this module
// directly, so its copy is kept in sync by hand). Tested here because this
// file has no Deno-specific APIs.
export function parseLoopCandidates(content) {
  try {
    const cleaned = content.trim().replace(/^```json\s*|```$/g, '');
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
