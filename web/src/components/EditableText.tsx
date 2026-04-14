import { useState, useRef, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import clsx from "clsx";
import { useAutoSave, type SaveStatus } from "../hooks/useAutoSave.ts";

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={clsx(
        "text-xs ml-2 transition-opacity",
        status === "saving" && "text-brand-500",
        status === "saved" && "text-status-green-700",
        status === "error" && "text-status-red-700",
      )}
    >
      {status === "saving" && "Saving..."}
      {status === "saved" && "Saved"}
      {status === "error" && "Failed to save"}
    </span>
  );
}

// ── Multiline (Tiptap) editor ────────────────────────────────────────

function MultilineEditor({
  value,
  onSave,
  placeholder: placeholderText,
  onExit,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  onExit: () => void;
}) {
  const originalRef = useRef(value);
  const { save, saveImmediately, cancel, status } = useAutoSave(onSave);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder: placeholderText ?? "Start typing...",
      }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      save(e.getHTML());
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === "Escape") {
          cancel();
          editor?.commands.setContent(originalRef.current);
          onExit();
          return true;
        }
        return false;
      },
    },
  });

  useEffect(() => {
    editor?.commands.focus("end");
  }, [editor]);

  const handleBlur = useCallback(() => {
    const html = editor?.getHTML() ?? "";
    if (html !== originalRef.current) {
      saveImmediately(html);
    }
  }, [editor, saveImmediately]);

  return (
    <div className="relative">
      <div
        className="border border-accent-300 rounded-md p-3 focus-within:ring-2 focus-within:ring-accent-600 focus-within:ring-offset-1 bg-white prose prose-sm max-w-none [&_.tiptap]:outline-none [&_.tiptap_p.is-editor-empty:first-child::before]:text-brand-400 [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:h-0 [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none"
        onBlur={handleBlur}
      >
        <EditorContent editor={editor} />
      </div>
      <SaveIndicator status={status} />
    </div>
  );
}

// ── Singleline (input) editor ────────────────────────────────────────

function SinglelineEditor({
  value,
  onSave,
  placeholder: placeholderText,
  onExit,
}: {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  onExit: () => void;
}) {
  const [current, setCurrent] = useState(value);
  const originalRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const { save, saveImmediately, cancel, status } = useAutoSave(onSave);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="relative flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value);
          save(e.target.value);
        }}
        onBlur={() => {
          if (current !== originalRef.current) {
            saveImmediately(current);
          }
          onExit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            cancel();
            setCurrent(originalRef.current);
            onExit();
          } else if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        placeholder={placeholderText}
        className="w-full border border-accent-300 rounded-md px-3 py-1.5 text-sm text-brand-900 focus:outline-none focus:ring-2 focus:ring-accent-600 focus:ring-offset-1"
      />
      <SaveIndicator status={status} />
    </div>
  );
}

// ── Main EditableText component ──────────────────────────────────────

export function EditableText({
  value,
  onSave,
  multiline = false,
  placeholder,
  className,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return multiline ? (
      <MultilineEditor
        value={value}
        onSave={onSave}
        placeholder={placeholder}
        onExit={() => setEditing(false)}
      />
    ) : (
      <SinglelineEditor
        value={value}
        onSave={onSave}
        placeholder={placeholder}
        onExit={() => setEditing(false)}
      />
    );
  }

  // Display mode
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={clsx(
        "cursor-pointer rounded -m-2 p-2 transition-all",
        "hover:outline hover:outline-1 hover:outline-brand-200",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-600",
        className,
      )}
      aria-label={placeholder ? `Edit ${placeholder}. Click or press Enter to edit.` : "Click to edit"}
    >
      {multiline ? (
        <div
          className="prose prose-sm max-w-none text-brand-700"
          dangerouslySetInnerHTML={{ __html: value || `<p class="text-brand-400">${placeholder ?? "Click to add content..."}</p>` }}
        />
      ) : (
        <span className="text-sm text-brand-700">
          {value || (
            <span className="text-brand-400">{placeholder ?? "Click to add..."}</span>
          )}
        </span>
      )}
    </div>
  );
}
