import { useEditor, EditorContent, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
// Pinned to an exact version in package.json, not a caret range. Every
// other @tiptap/* package is held at one version by the lockfile, and a
// newer table extension imports helpers that older @tiptap/core does not
// export — which fails the admin bundle, and with it the whole deploy.
import { TableKit } from "@tiptap/extension-table"
import { useEffect, useRef } from "react"
import { blogApi } from "../lib/sdk"
import { A } from "../lib/admin-theme"

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        padding: "4px 8px",
        marginRight: 4,
        marginBottom: 4,
        borderRadius: 4,
        border: A.border,
        background: active ? A.bgHover : A.bgCard,
        fontSize: 12,
        cursor: "pointer",
        color: A.fg,
      }}
    >
      {children}
    </button>
  )
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const fileRef = useRef<HTMLInputElement>(null)
  if (!editor) return null

  const handleImage = async (file: File) => {
    try {
      const uploaded = await blogApi.uploadImage(file)
      if (uploaded.url) {
        editor
          .chain()
          .focus()
          .setImage({
            src: uploaded.url,
            alt: uploaded.alt || "",
            title: uploaded.title || "",
          } as any)
          .run()
      }
    } catch (e) {
      alert("Image upload failed: " + (e as Error).message)
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        padding: 8,
        borderBottom: A.border,
        background: A.bgSubtle,
      }}
    >
      <ToolbarButton
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold"
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic"
      >
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline"
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strike"
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        • List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1. List
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝ Quote
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {"</>"}
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        ⇤
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        ⇥
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          const url = prompt("Enter URL")
          if (url)
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href: url, target: "_blank" })
              .run()
        }}
      >
        🔗 Link
      </ToolbarButton>
      <ToolbarButton onClick={() => fileRef.current?.click()}>
        🖼️ Image
      </ToolbarButton>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImage(f)
          e.target.value = ""
        }}
      />
      <ToolbarButton
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        title="Insert table (3×3 with header)"
      >
        ▦ Table
      </ToolbarButton>
      {/* The row/column controls only make sense inside a table, so they
          stay hidden until the cursor is in one — otherwise the toolbar is
          a wall of buttons that do nothing. */}
      {editor.isActive("table") && (
        <>
          <ToolbarButton
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            title="Add column"
          >
            +Col
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteColumn().run()}
            title="Delete column"
          >
            −Col
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().addRowAfter().run()}
            title="Add row"
          >
            +Row
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteRow().run()}
            title="Delete row"
          >
            −Row
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().mergeOrSplit().run()}
            title="Merge / split cells"
          >
            ⇹
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
            title="Toggle header row"
          >
            H-Row
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().deleteTable().run()}
            title="Delete table"
          >
            🗑 Table
          </ToolbarButton>
        </>
      )}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()}>
        ↶
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()}>
        ↷
      </ToolbarButton>
    </div>
  )
}

export default function RichEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Image.configure({ inline: false, HTMLAttributes: { class: "blog-image" } }),
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Tables are NOT part of StarterKit — without this the editor simply
      // drops any <table> in the HTML it is given, which is why pasted or
      // previously-saved tables kept disappearing. TableKit bundles the
      // table/row/cell/header nodes; `resizable` adds drag handles on the
      // column borders.
      TableKit.configure({ table: { resizable: true } }),
      Placeholder.configure({ placeholder: placeholder || "Start writing..." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  })

  // Keep editor in sync if external value changes (e.g. loaded from API)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "", { emitUpdate: false } as any)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div
      style={{
        border: A.border,
        borderRadius: 6,
        background: A.bgCard,
      }}
    >
      <Toolbar editor={editor} />
      <div style={{ minHeight: 300, padding: 16 }}>
        <EditorContent editor={editor} />
      </div>
      <style>{`
        .ProseMirror { min-height: 260px; outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; color: #9ca3af; pointer-events: none; height: 0;
        }
        .ProseMirror img { max-width: 100%; height: auto; border-radius: 6px; }
        .ProseMirror h1 { font-size: 1.875rem; font-weight: 700; margin: 1rem 0; }
        .ProseMirror h2 { font-size: 1.5rem; font-weight: 700; margin: 1rem 0; }
        .ProseMirror h3 { font-size: 1.25rem; font-weight: 600; margin: 0.75rem 0; }
        .ProseMirror ul { list-style: disc; padding-left: 1.5rem; }
        .ProseMirror ol { list-style: decimal; padding-left: 1.5rem; }
        .ProseMirror blockquote { border-left: 3px solid #d1d5db; padding-left: 1rem; color: #6b7280; }
        .ProseMirror pre { background: #111827; color: #f3f4f6; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .ProseMirror a { color: #2563eb; text-decoration: underline; }

        /* Tables. ProseMirror needs the fixed layout + explicit cell
           borders, otherwise an empty cell has no hit area and the column
           resize handles have nothing to grab. */
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
        }
        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid #d1d5db;
          padding: 6px 10px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
          min-width: 1em;
        }
        .ProseMirror table th {
          background: #f3f4f6;
          font-weight: 700;
          text-align: left;
        }
        /* Selected cells while dragging a range */
        .ProseMirror table .selectedCell:after {
          content: "";
          position: absolute; inset: 0;
          background: rgba(37, 99, 235, 0.12);
          pointer-events: none;
        }
        /* Drag handle shown on a column border when resizable is on */
        .ProseMirror table .column-resize-handle {
          position: absolute;
          right: -2px; top: 0; bottom: -2px;
          width: 4px;
          background: #2563eb;
          pointer-events: none;
        }
        .ProseMirror.resize-cursor { cursor: col-resize; }
      `}</style>
    </div>
  )
}
