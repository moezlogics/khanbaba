import { BlogPost } from "@lib/data/blog"

/**
 * Auto internal linking — mirrors the PHP site's `related_posts_inject`.
 *
 * "Also Read" cards linking to the most RELEVANT other posts are injected
 * between paragraphs of the article body (default after paragraphs 3 and 7).
 * The whole SEO value of internal linking is the link pointing somewhere a
 * reader actually wants, so candidates are scored on real topical overlap
 * rather than dropped in at random:
 *
 *   shared category        +3 each
 *   shared title keyword    +2 each   (after stop-words, brands/models survive)
 *   published within a year +1        a small recency nudge
 *
 * Ties break on recency. Runs server-side on the post's stored HTML.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "in", "on", "of", "for", "to", "with", "is",
  "are", "be", "best", "price", "pakistan", "mobile", "mobiles", "phone",
  "phones", "new", "review", "reviews", "specs", "specification", "vs", "how",
  "what", "your", "you", "top", "latest", "2025", "2026",
])

function titleKeywords(title: string): Set<string> {
  return new Set(
    (title || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w))
  )
}

function score(current: BlogPost, cand: BlogPost): number {
  let s = 0
  const curCats = new Set((current.categories || []).map((c) => c.id))
  for (const c of cand.categories || []) if (curCats.has(c.id)) s += 3

  const curKw = titleKeywords(current.title)
  for (const k of titleKeywords(cand.title)) if (curKw.has(k)) s += 2

  const pub = cand.published_at ? new Date(cand.published_at).getTime() : 0
  if (pub && Date.now() - pub < 365 * 24 * 3600 * 1000) s += 1
  return s
}

function recency(p: BlogPost): number {
  return new Date(p.published_at || p.created_at || 0).getTime()
}

function block(post: BlogPost, label: string): string {
  // `not-prose` stops the typography plugin from restyling the card. Plain
  // <a> because this is injected as raw HTML (no React components here).
  const title = post.title.replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return (
    `<div class="not-prose my-7 rounded-xl border border-line bg-surface px-4 py-3">` +
    `<span class="block text-[11px] font-bold uppercase tracking-wide text-brand-secondary2 mb-1">${label}</span>` +
    `<a href="/blog/${post.handle}" class="text-[15px] font-semibold text-brand-black hover:text-brand-secondary transition-colors no-underline">` +
    `${title} <span aria-hidden="true">→</span></a>` +
    `</div>`
  )
}

export function injectInternalLinks(
  html: string | null | undefined,
  current: BlogPost,
  candidates: BlogPost[],
  opts?: { positions?: number[]; count?: number; label?: string }
): string {
  const content = html || ""
  if (!content) return content

  const positions = (opts?.positions ?? [3, 7]).slice().sort((a, b) => a - b)
  const label = opts?.label ?? "Also Read"
  const maxLinks = opts?.count ?? positions.length

  const related = (candidates || [])
    .filter((p) => p && p.handle && p.handle !== current.handle)
    .map((p) => ({ p, s: score(current, p) }))
    .sort((a, b) => b.s - a.s || recency(b.p) - recency(a.p))
    .slice(0, maxLinks)
    .map((x) => x.p)

  if (!related.length) return content

  // Split on paragraph boundaries, keeping the closing tag with each chunk.
  const parts = content.split(/(<\/p>)/i)
  // Rebuild into whole paragraphs: [text, </p>, text, </p>, ...]
  const paragraphs: string[] = []
  for (let i = 0; i < parts.length; i += 2) {
    const chunk = (parts[i] || "") + (parts[i + 1] || "")
    if (chunk.trim()) paragraphs.push(chunk)
  }

  // Fewer paragraphs than the first position → nothing to interleave.
  if (paragraphs.length < (positions[0] || 1) + 1) return content

  let linkIdx = 0
  const out: string[] = []
  for (let i = 0; i < paragraphs.length; i++) {
    out.push(paragraphs[i])
    const afterParagraph = i + 1 // 1-based index of the paragraph just pushed
    if (
      linkIdx < related.length &&
      positions.includes(afterParagraph) &&
      i < paragraphs.length - 1 // never append right at the very end
    ) {
      out.push(block(related[linkIdx], label))
      linkIdx++
    }
  }

  return out.join("")
}
