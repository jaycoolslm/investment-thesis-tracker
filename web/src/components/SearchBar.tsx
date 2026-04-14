import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // "/" to focus search (when not in an input/textarea)
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        ) &&
        !(e.target as HTMLElement).isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      onChange("");
      inputRef.current?.blur();
    }
  }

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  return (
    <div
      className={clsx(
        "relative flex items-center h-10 rounded-md border bg-surface-card transition-colors",
        focused
          ? "border-accent-600 ring-2 ring-accent-100"
          : "border-brand-200",
      )}
    >
      {/* Magnifying glass icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="absolute left-3 text-brand-500 pointer-events-none"
      >
        <path
          d="M11.5 7a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM10.68 11.39a6 6 0 1 1 .71-.71l3.47 3.46a.5.5 0 0 1-.71.71l-3.46-3.46Z"
          fill="currentColor"
        />
      </svg>

      <input
        ref={inputRef}
        role="searchbox"
        aria-label="Search holdings by ticker or company name"
        type="text"
        placeholder="Search holdings by ticker or company name..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleInputKeyDown}
        className="w-full h-full bg-transparent pl-9 pr-16 text-sm text-brand-700 placeholder:text-brand-500 outline-none"
      />

      {/* Clear button (when value present) */}
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 text-brand-500 hover:text-brand-700 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}

      {/* Cmd+K badge (when empty and unfocused) */}
      {!value && !focused && (
        <span className="absolute right-3 hidden md:inline-flex text-xs text-brand-500 border border-brand-200 rounded-sm px-1">
          {isMac ? "⌘K" : "Ctrl+K"}
        </span>
      )}
    </div>
  );
}
