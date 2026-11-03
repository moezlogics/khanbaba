const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi

/**
 * Split admin head_code into instant meta/link tags vs deferred scripts.
 * Verification <meta> must stay in SSR HTML; third-party scripts must not.
 */
export function splitHeadCode(html: string): {
  staticTags: string
  deferredScripts: string[]
} {
  const deferredScripts: string[] = []
  const staticTags = html
    .replace(SCRIPT_RE, (match) => {
      deferredScripts.push(match)
      return ""
    })
    .trim()

  return { staticTags, deferredScripts }
}
