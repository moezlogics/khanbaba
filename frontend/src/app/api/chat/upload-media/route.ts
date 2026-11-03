import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 })
    }

    const cdnUrl =
      process.env.CDN_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_CDN_URL ||
      "http://127.0.0.1:3251"
    const cdnKey =
      process.env.CDN_API_KEY ||
      "d56628333ffe1079f763ff4e6973e70c3b8b89a349a054481f7974bba153a463"

    // Prepare FormData for CDN
    const cdnFormData = new FormData()
    cdnFormData.append("files", file) // field name expected by CDN multer (checks "image", "media", or "files")
    cdnFormData.append("slug", `chat-${Date.now()}`)

    const cdnRes = await fetch(`${cdnUrl}/api/media/upload`, {
      method: "POST",
      headers: { "x-cdn-key": cdnKey },
      body: cdnFormData,
    })

    const cdnData = await cdnRes.json().catch(() => ({}))
    if (!cdnRes.ok || !cdnData.success) {
      return NextResponse.json(
        { error: cdnData?.error || "Failed to upload file to CDN." },
        { status: cdnRes.status || 502 }
      )
    }

    const publicUrl = cdnData.data?.url || cdnData.url

    // If it's a PDF, extract the text too
    let text = ""
    const isPdf = file.type === "application/pdf"
    if (isPdf) {
      const pdf = require("pdf-parse")
      const buffer = Buffer.from(await file.arrayBuffer())
      const pdfData = await pdf(buffer)
      text = pdfData.text || ""
    }

    return NextResponse.json({
      success: true,
      url: publicUrl,
      type: isPdf ? "pdf" : "image",
      name: file.name,
      text: text || undefined,
    })
  } catch (error: any) {
    console.error("[Chat Media Upload Proxy] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to process and upload file." },
      { status: 500 }
    )
  }
}
