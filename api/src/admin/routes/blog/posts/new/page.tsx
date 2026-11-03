import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Input,
  Label,
  Textarea,
  Badge,
} from "@medusajs/ui"
import { useState, useEffect, useRef } from "react"
import { blogApi } from "../../../../lib/sdk"
import RichEditor from "../../../../components/RichEditor"

// Mirrors this page's fields so a dropped connection or an expired
// session can't wipe what has been typed (lib/draft-keeper.ts).
import "../../../../lib/draft-keeper"

type Category = { id: string; name: string; handle: string }

/**
 * Pull something human out of a failed admin request.
 *
 * The Medusa SDK surfaces non-2xx responses as a generic
 * "An unknown error occurred", which hides the reason the server actually
 * gave. The API routes return `{ error, message, detail }`, so check those
 * first and only fall back to the SDK's own text.
 */
function describeError(e: any): string {
  const body = e?.response?.data ?? e?.body ?? e?.data
  const parts = [body?.message, body?.detail, body?.error].filter(Boolean)
  if (parts.length) return parts.join(" — ")
  if (e?.message && e.message !== "An unknown error occurred") return e.message
  try {
    return JSON.stringify(body ?? e)
  } catch {
    return String(e)
  }
}

const NewPostPage = () => {
  const [title, setTitle] = useState("")
  const [handle, setHandle] = useState("")
  const [handleEdited, setHandleEdited] = useState(false)
  const [excerpt, setExcerpt] = useState("")
  const [content, setContent] = useState("")
  const [featuredImage, setFeaturedImage] = useState("")
  const [featuredImageAlt, setFeaturedImageAlt] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [seoTitle, setSeoTitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")
  const [seoKeywords, setSeoKeywords] = useState("")
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [authors, setAuthors] = useState<any[]>([])
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    blogApi.listCategories().then((data: any) => {
      setCategories(data.categories || [])
    })
    blogApi.listAuthors().then((data: any) => {
      setAuthors(data.authors || [])
    })
  }, [])

  // Auto-generate handle from title
  useEffect(() => {
    if (!handleEdited && title) {
      const slug = title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 120)
      setHandle(slug)
    }
  }, [title, handleEdited])

  const handleImageUpload = async (file: File) => {
    setImageUploading(true)
    try {
      const uploaded = await blogApi.uploadImage(file)
      if (uploaded.url) {
        setFeaturedImage(uploaded.url)
        if (!featuredImageAlt) {
          setFeaturedImageAlt(
            uploaded.alt ||
              file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")
          )
        }
        if (!seoTitle && uploaded.title) setSeoTitle(uploaded.title)
        if (!seoDescription && uploaded.caption) setSeoDescription(uploaded.caption)
      }
    } catch (e) {
      alert("Image upload failed: " + (e as Error).message)
    } finally {
      setImageUploading(false)
    }
  }

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  }

  const onSave = async () => {
    if (!title.trim()) {
      alert("Title is required")
      return
    }
    setSaving(true)
    try {
      await blogApi.createPost({
        title,
        handle,
        excerpt,
        content,
        featured_image: featuredImage || null,
        featured_image_alt: featuredImageAlt || null,
        status,
        seo_title: seoTitle || null,
        seo_description: seoDescription || null,
        seo_keywords: seoKeywords || null,
        category_ids: selectedCategoryIds,
        author_id: selectedAuthorId || null,
      })
      window.location.href = "/app/blog"
    } catch (e) {
      alert("Failed to save: " + describeError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container className="p-6">
      <div className="flex items-center justify-between mb-6">
        <Heading>New Blog Post</Heading>
        <div className="flex gap-2">
          <a href="/app/blog">
            <Button variant="secondary">Cancel</Button>
          </a>
          <Button variant="primary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : status === "published" ? "Publish" : "Save Draft"}
          </Button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Main Column */}
        <div>
          {/* Title */}
          <div className="mb-4">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter post title..."
              value={title}
              onChange={(e: any) => setTitle(e.target.value)}
            />
          </div>

          {/* Handle */}
          <div className="mb-4">
            <Label htmlFor="handle">Handle (URL Slug)</Label>
            <Input
              id="handle"
              placeholder="post-url-slug"
              value={handle}
              onChange={(e: any) => {
                setHandle(e.target.value)
                setHandleEdited(true)
              }}
            />
          </div>

          {/* Excerpt */}
          <div className="mb-4">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea
              id="excerpt"
              placeholder="Brief summary of the post..."
              value={excerpt}
              onChange={(e: any) => setExcerpt(e.target.value)}
              rows={3}
            />
          </div>

          {/* Content Editor */}
          <div className="mb-4">
            <Label>Content</Label>
            <RichEditor
              value={content}
              onChange={setContent}
              placeholder="Write your blog post content..."
            />
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Status */}
          <Container className="p-4 mb-4">
            <Label className="mb-2 block">Status</Label>
            <div className="flex gap-2">
              <Button
                variant={status === "draft" ? "primary" : "secondary"}
                onClick={() => setStatus("draft")}
                size="small"
              >
                Draft
              </Button>
              <Button
                variant={status === "published" ? "primary" : "secondary"}
                onClick={() => setStatus("published")}
                size="small"
              >
                Published
              </Button>
            </div>
          </Container>

          {/* Featured Image */}
          <Container className="p-4 mb-4">
            <Label className="mb-2 block">Featured Image</Label>
            {featuredImage ? (
              <div className="mb-2">
                <img
                  src={featuredImage}
                  alt={featuredImageAlt || "Featured"}
                  style={{
                    width: "100%",
                    borderRadius: 6,
                    objectFit: "cover",
                    maxHeight: 200,
                  }}
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => fileRef.current?.click()}
                  >
                    Replace
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => {
                      setFeaturedImage("")
                      setFeaturedImageAlt("")
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={imageUploading}
                style={{ width: "100%" }}
              >
                {imageUploading ? "Uploading..." : "Upload Featured Image"}
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e: any) => {
                const f = e.target.files?.[0]
                if (f) handleImageUpload(f)
                e.target.value = ""
              }}
            />
            {featuredImage && (
              <div className="mt-2">
                <Label htmlFor="alt">Alt Text</Label>
                <Input
                  id="alt"
                  placeholder="Describe the image..."
                  value={featuredImageAlt}
                  onChange={(e: any) => setFeaturedImageAlt(e.target.value)}
                />
              </div>
            )}
          </Container>

          {/* Categories */}
          <Container className="p-4 mb-4">
            <Label className="mb-2 block">Categories</Label>
            {categories.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>
                No categories yet.{" "}
                <a href="/app/blog/categories" style={{ color: "#2563eb" }}>
                  Create one
                </a>
              </p>
            ) : (
              <div
                style={{
                  maxHeight: 200,
                  overflowY: "auto",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                }}
              >
                {categories.map((cat) => (
                  <Badge
                    key={cat.id}
                    color={selectedCategoryIds.includes(cat.id) ? "green" : "grey"}
                    style={{ cursor: "pointer" }}
                    onClick={() => toggleCategory(cat.id)}
                  >
                    {selectedCategoryIds.includes(cat.id) ? "✓ " : ""}
                    {cat.name}
                  </Badge>
                ))}
              </div>
            )}
          </Container>

          {/* Author */}
          <Container className="p-4 mb-4">
            <Label className="mb-2 block">Author</Label>
            {authors.length === 0 ? (
              <p style={{ color: "#9ca3af", fontSize: 13 }}>
                No authors yet.{" "}
                <a href="/app/blog/authors" style={{ color: "#2563eb" }}>
                  Create one
                </a>
              </p>
            ) : (
              <select
                value={selectedAuthorId}
                onChange={(e: any) => setSelectedAuthorId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border-base, #e5e7eb)",
                  background: "transparent",
                  fontSize: 14,
                }}
              >
                <option value="">— No author —</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.role ? ` · ${a.role}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Container>

          {/* SEO */}
          <Container className="p-4">
            <Label className="mb-2 block" style={{ fontWeight: 600 }}>
              SEO Settings
            </Label>
            <div className="mb-3">
              <Label htmlFor="seoTitle">SEO Title</Label>
              <Input
                id="seoTitle"
                placeholder="SEO page title..."
                value={seoTitle}
                onChange={(e: any) => setSeoTitle(e.target.value)}
              />
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                {(seoTitle || title).length}/60 characters
              </p>
            </div>
            <div className="mb-3">
              <Label htmlFor="seoDesc">Meta Description</Label>
              <Textarea
                id="seoDesc"
                placeholder="Meta description for search engines..."
                value={seoDescription}
                onChange={(e: any) => setSeoDescription(e.target.value)}
                rows={3}
              />
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                {seoDescription.length}/160 characters
              </p>
            </div>
            <div>
              <Label htmlFor="seoKeys">Keywords</Label>
              <Input
                id="seoKeys"
                placeholder="keyword1, keyword2, ..."
                value={seoKeywords}
                onChange={(e: any) => setSeoKeywords(e.target.value)}
              />
            </div>
          </Container>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "New Post",
})

export default NewPostPage
