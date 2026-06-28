/**
 * Split a lesson markdown body into individual slides.
 *
 * Convention: a line containing only `---` (a markdown horizontal rule)
 * separates slides. We trim outer whitespace per slide and drop empty
 * slides. If the body has no separator, the whole thing is one slide.
 *
 * Leading/trailing whitespace lines are preserved INSIDE a slide so that
 * indented code blocks render correctly.
 */
export function splitIntoSlides(markdown: string): string[] {
  if (!markdown.trim()) return [];
  // Match a `---` line (allowing surrounding whitespace on the line).
  // The lookahead+lookbehind ensures we split on a STANDALONE separator,
  // not on `---` inside a code fence — the latter would already be wrapped
  // in ``` and not on its own line.
  const slides = markdown
    .split(/\r?\n\s*---\s*\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return slides.length > 0 ? slides : [markdown.trim()];
}
