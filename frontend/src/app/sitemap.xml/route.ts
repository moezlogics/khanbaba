import { NextResponse } from "next/server"
import sitemap from "../sitemap"

export const revalidate = 360

export async function GET() {
  let entries: any[] = []
  try {
    entries = await sitemap()
  } catch (error) {
    console.error("[sitemap-route] failed to fetch sitemap entries", error)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${entries
    .map(
      (e) => `
  <url>
    <loc>${e.url}</loc>
    <lastmod>${
      e.lastModified
        ? new Date(e.lastModified).toISOString()
        : new Date().toISOString()
    }</lastmod>
    <changefreq>${e.changeFrequency || "weekly"}</changefreq>
    <priority>${e.priority || 0.7}</priority>
  </url>`
    )
    .join("")}
</urlset>`
  
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  })
}
