/**
 * Flatten rich-text HTML down to a single line of plain text.
 *
 * Fields like brand/category descriptions are authored in the admin's
 * rich editor, so they arrive as HTML. That's what we want on the page,
 * but a `<meta name="description">` tag and schema.org JSON-LD must be
 * plain text — dumping markup there produces garbage snippets in search
 * results.
 *
 * Block-level tags become spaces so "…phones</p><p>Since 2010…" doesn't
 * collapse into "phonesSince 2010", entities are decoded, and the result
 * is whitespace-collapsed and optionally clipped on a word boundary.
 */
const BLOCK_TAGS =
  /<\/?(?:p|div|br|li|ul|ol|h[1-6]|tr|td|th|table|section|article|header|footer|blockquote|pre)\b[^>]*>/gi

const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
}

export function htmlToText(html: string | null | undefined, maxLength?: number): string {
  if (!html) return ""

  let text = String(html)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(BLOCK_TAGS, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim()

  if (maxLength && text.length > maxLength) {
    // Clip on a word boundary so the snippet doesn't end mid-word.
    const clipped = text.slice(0, maxLength)
    const lastSpace = clipped.lastIndexOf(" ")
    text = (lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped).trimEnd()
  }

  return text
}
