import DeferredHeadScripts from "./deferred-head-scripts"
import { splitHeadCode } from "./split-head-code"

/**
 * Renders admin-supplied raw HTML into the document <head>.
 *
 * Meta / verification tags are emitted synchronously (crawlers need them).
 * All `<script>` blocks are deferred until after window.load + idle so
 * LaraPush / legacy AdSense snippets in head_code never block first paint
 * or keep the browser tab spinner running on a cold visit.
 */
export default function CustomHeadCode({ html }: { html?: string }) {
  if (!html?.trim()) return null

  const { staticTags, deferredScripts } = splitHeadCode(html)

  return (
    <>
      {staticTags ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `</style>${staticTags}<style>`,
          }}
        />
      ) : null}
      {deferredScripts.length > 0 && (
        <DeferredHeadScripts scripts={deferredScripts} />
      )}
    </>
  )
}
