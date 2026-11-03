import { defineRouteConfig } from "@medusajs/admin-sdk"
import {
  Container,
  Heading,
  Button,
  Table,
  Input,
  Label,
  Textarea,
} from "@medusajs/ui"
import { useEffect, useState } from "react"
import { blogApi } from "../../../lib/sdk"
import { A } from "../../../lib/admin-theme"

// Mirrors this page's fields so a dropped connection or an expired
// session can't wipe what has been typed (lib/draft-keeper.ts).
import "../../../lib/draft-keeper"

type Author = {
  id: string
  name: string
  handle: string
  role: string | null
  bio: string | null
  avatar_url: string | null
  email: string | null
  expertise: string | null
  twitter_url: string | null
  linkedin_url: string | null
  facebook_url: string | null
  website_url: string | null
}

const BLANK = {
  name: "",
  handle: "",
  role: "",
  bio: "",
  avatar_url: "",
  email: "",
  expertise: "",
  twitter_url: "",
  linkedin_url: "",
  facebook_url: "",
  website_url: "",
}

const AuthorsPage = () => {
  const [authors, setAuthors] = useState<Author[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  const set = (k: keyof typeof BLANK, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const load = async () => {
    setLoading(true)
    try {
      // SDK fetch is generically typed; cast once at the boundary.
      const data = (await blogApi.listAuthors()) as any
      setAuthors(data?.authors || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const resetForm = () => {
    setForm({ ...BLANK })
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (a: Author) => {
    setEditingId(a.id)
    setForm({
      name: a.name || "",
      handle: a.handle || "",
      role: a.role || "",
      bio: a.bio || "",
      avatar_url: a.avatar_url || "",
      email: a.email || "",
      expertise: a.expertise || "",
      twitter_url: a.twitter_url || "",
      linkedin_url: a.linkedin_url || "",
      facebook_url: a.facebook_url || "",
      website_url: a.website_url || "",
    })
    setShowForm(true)
  }

  const onUpload = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await blogApi.uploadImage(file)
      set("avatar_url", typeof url === "string" ? url : (url as any)?.url || "")
    } catch (err) {
      alert("Upload failed: " + (err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const onSave = async () => {
    if (!form.name.trim()) {
      alert("Name is required")
      return
    }
    setSaving(true)
    const payload: any = { ...form }
    payload.handle = form.handle || undefined
    for (const k of Object.keys(payload)) {
      if (k !== "handle" && payload[k] === "") payload[k] = null
    }
    try {
      if (editingId) {
        await blogApi.updateAuthor(editingId, payload)
      } else {
        await blogApi.createAuthor(payload)
      }
      resetForm()
      await load()
    } catch (e) {
      alert("Failed to save: " + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (id: string) => {
    if (!confirm("Delete this author? Their posts stay but lose the byline.")) return
    try {
      await blogApi.deleteAuthor(id)
      await load()
    } catch (e) {
      alert("Failed to delete: " + (e as Error).message)
    }
  }

  const field = (
    key: keyof typeof BLANK,
    label: string,
    placeholder = ""
  ) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e: any) => set(key, e.target.value)}
      />
    </div>
  )

  return (
    <Container className="p-6">
      <div className="flex items-center justify-between mb-4">
        <Heading>Blog Authors</Heading>
        <div className="flex gap-2">
          <a href="/app/blog">
            <Button variant="secondary">← Back to Posts</Button>
          </a>
          {!showForm && (
            <Button
              variant="primary"
              onClick={() => {
                resetForm()
                setShowForm(true)
              }}
            >
              + New Author
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <Container
          className="p-4 mb-4"
          style={{ background: A.bgCard, borderRadius: 8, border: A.border }}
        >
          <Heading level="h3" className="mb-3">
            {editingId ? "Edit Author" : "New Author"}
          </Heading>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("name", "Name *", "e.g. Ahmed Raza")}
            {field("handle", "Handle (slug)", "auto-generated from name")}
            {field("role", "Role / Title", "e.g. Senior Mobile Editor")}
            {field("email", "Email", "author@site.com")}
          </div>

          <div className="mt-3">
            {field("expertise", "Expertise (short credentials)", "e.g. 8 years reviewing smartphones")}
          </div>

          <div className="mt-3">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Short author bio (shown in the author box for E-E-A-T)..."
              value={form.bio}
              onChange={(e: any) => set("bio", e.target.value)}
              rows={3}
            />
          </div>

          <div className="mt-3">
            <Label>Avatar</Label>
            <div className="flex items-center gap-3">
              {form.avatar_url ? (
                <img
                  src={form.avatar_url}
                  alt="avatar"
                  style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : null}
              <Input
                placeholder="https://cdn.../avatar.webp"
                value={form.avatar_url}
                onChange={(e: any) => set("avatar_url", e.target.value)}
              />
              <label>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={onUpload} />
                <Button variant="secondary" size="small" asChild>
                  <span>{uploading ? "Uploading..." : "Upload"}</span>
                </Button>
              </label>
            </div>
          </div>

          <Heading level="h3" className="mt-4 mb-2" style={{ fontSize: 13, color: A.fgSubtle }}>
            Social profiles (used as schema.org sameAs for E-E-A-T)
          </Heading>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("website_url", "Website", "https://...")}
            {field("twitter_url", "X / Twitter", "https://x.com/...")}
            {field("linkedin_url", "LinkedIn", "https://linkedin.com/in/...")}
            {field("facebook_url", "Facebook", "https://facebook.com/...")}
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="primary" onClick={onSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </Container>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : authors.length === 0 ? (
        <p className="text-gray-500">No authors yet. Create your first one.</p>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Author</Table.HeaderCell>
              <Table.HeaderCell>Role</Table.HeaderCell>
              <Table.HeaderCell>Handle</Table.HeaderCell>
              <Table.HeaderCell>Actions</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {authors.map((a) => (
              <Table.Row key={a.id}>
                <Table.Cell style={{ fontWeight: 500 }}>
                  <div className="flex items-center gap-2">
                    {a.avatar_url ? (
                      <img
                        src={a.avatar_url}
                        alt={a.name}
                        style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                      />
                    ) : null}
                    {a.name}
                  </div>
                </Table.Cell>
                <Table.Cell style={{ color: A.fgSubtle }}>{a.role || "—"}</Table.Cell>
                <Table.Cell style={{ color: A.fgSubtle }}>{a.handle}</Table.Cell>
                <Table.Cell>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="small" onClick={() => startEdit(a)}>
                      Edit
                    </Button>
                    <Button variant="danger" size="small" onClick={() => onDelete(a.id)}>
                      Delete
                    </Button>
                  </div>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Blog Authors",
})

export default AuthorsPage
