"use server"
import { cookies as nextCookies } from "next/headers"
import { redirect } from "next/navigation"

export async function resetOnboardingState(orderId: string) {
  const cookies = await nextCookies()
  cookies.set("_medusa_onboarding", "false", { maxAge: -1 })
  const adminUrl = process.env.MEDUSA_BACKEND_URL || "https://api.khanbaba.pk"
  redirect(`${adminUrl}/a/orders/${orderId}`)
}
