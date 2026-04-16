"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        horizontalRule: false,
      }),
    ],
    content,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "rich-text-editor-content",
        "data-placeholder": placeholder ?? "",
      },
    },
  });

  if (!editor) return null;

  return (
    <div
      className="rounded-button border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 border-b"
        style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
      >
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          aria-label="Bold"
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Italic"
        >
          <Italic size={14} />
        </ToolbarButton>
        <div className="w-px h-4 mx-1" style={{ background: "var(--border)" }} />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Bullet list"
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Numbered list"
        >
          <ListOrdered size={14} />
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  children,
  ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1 rounded transition-colors"
      style={{
        background: active ? "var(--primary-light)" : "transparent",
        color: active ? "var(--primary)" : "var(--text-muted)",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
