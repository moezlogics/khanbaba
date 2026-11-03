import { getVapidKey, registerPush, unregisterPush } from "./api"

/** base64url VAPID public key → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
}

export type PushStatus = "on" | "off" | "denied" | "unsupported"

/** Current push state on this device, so the UI can show it. */
export async function getPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return "unsupported"
  if (Notification.permission === "denied") return "denied"
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? "on" : "off"
  } catch {
    return "off"
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null
  return navigator.serviceWorker.register("/sw.js")
}

/**
 * Ask permission, subscribe via the existing VAPID key, and register the
 * subscription with the backend. Returns a human status string.
 */
export async function enablePush(): Promise<{ ok: boolean; message: string }> {
  if (!pushSupported()) {
    return { ok: false, message: "This browser doesn't support push. Use Chrome on Android." }
  }

  const permission = await Notification.requestPermission()
  if (permission !== "granted") {
    return { ok: false, message: "Notification permission was not granted." }
  }

  const sub = await ensureSubscription()
  await registerPush(sub, navigator.userAgent.slice(0, 100))
  return { ok: true, message: "Notifications enabled on this device." }
}

/**
 * Get this device's push subscription, creating it if needed.
 *
 * A subscription is permanently tied to the VAPID key it was created
 * with. If the server's key has changed since, the old subscription
 * looks fine locally but every push to it is rejected — so compare the
 * stored key with the server's and resubscribe on a mismatch.
 */
async function ensureSubscription(): Promise<PushSubscription> {
  const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration
  const { publicKey } = await getVapidKey()
  const wanted = urlBase64ToUint8Array(publicKey)

  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, wanted)) {
    try {
      await sub.unsubscribe()
    } catch {
      /* subscribe() below will surface a real problem */
    }
    sub = null
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: wanted as any,
    })
  }
  return sub
}

function sameKey(sub: PushSubscription, expected: Uint8Array): boolean {
  let actual: ArrayBuffer | null | undefined
  try {
    actual = sub.options?.applicationServerKey
  } catch {
    return true
  }
  // Browsers that don't expose it: assume it matches rather than churn.
  if (!actual) return true
  const a = new Uint8Array(actual)
  if (a.length !== expected.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== expected[i]) return false
  return true
}

/**
 * Silently make sure the server knows about THIS device. Call on every
 * app start while logged in.
 *
 * Registration used to happen only once, at login, with any error
 * swallowed. If that single call failed — or the browser later rotated
 * the subscription — the device kept showing notifications as "on" while
 * the server had no record of it, so no order alerts ever arrived.
 * Re-registering is idempotent on the server (keyed by endpoint).
 *
 * Never prompts: it only acts when permission was already granted.
 */
export async function syncPushRegistration(): Promise<void> {
  if (!pushSupported()) return
  if (Notification.permission !== "granted") return
  try {
    const sub = await ensureSubscription()
    await registerPush(sub, navigator.userAgent.slice(0, 100))
  } catch (e) {
    console.warn("[push] background re-registration failed:", e)
  }
}

export async function disablePush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    try {
      await unregisterPush(sub.endpoint)
    } catch {
      /* ignore */
    }
    await sub.unsubscribe()
  }
}
