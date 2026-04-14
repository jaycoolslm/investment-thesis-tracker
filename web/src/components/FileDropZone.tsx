import { useState, useRef, type DragEvent } from "react";

interface FileDropZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  acceptedTypes?: string[];
  maxSize?: number;
  multiple?: boolean;
  dropLabel?: string;
  hintLabel?: string;
}

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const DEFAULT_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export function FileDropZone({
  files,
  onChange,
  accept = ".pdf,.docx",
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxSize = DEFAULT_MAX_SIZE,
  multiple = true,
  dropLabel = "Drop broker research here, or",
  hintLabel = "PDF or DOCX, up to 50 MB",
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeMB = Math.round(maxSize / (1024 * 1024));

  function validateAndAdd(incoming: FileList | File[]) {
    const newFiles: File[] = [];
    for (const file of incoming) {
      if (!acceptedTypes.includes(file.type)) {
        setError(`Unsupported file type. Accepted: ${accept}`);
        return;
      }
      if (file.size > maxSize) {
        setError(`${file.name} exceeds the ${maxSizeMB} MB limit.`);
        return;
      }
      newFiles.push(file);
    }
    setError(null);
    if (multiple) {
      onChange([...files, ...newFiles]);
    } else {
      onChange(newFiles.slice(0, 1));
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      validateAndAdd(e.dataTransfer.files);
    }
  }

  function handleRemove(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-accent-600 bg-accent-50"
            : "border-brand-200 hover:border-brand-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) validateAndAdd(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-brand-500">
          {dropLabel}{" "}
          <span className="text-accent-600 font-medium">browse</span>
        </p>
        <p className="text-xs text-brand-500 mt-1">{hintLabel}</p>
      </div>

      {error && (
        <p className="text-sm text-error-text mt-2">{error}</p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="flex items-center justify-between text-sm bg-brand-50 rounded px-3 py-2"
            >
              <span className="text-brand-700 truncate mr-2">
                {file.name}{" "}
                <span className="text-brand-500">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(i);
                }}
                className="text-brand-500 hover:text-error-text shrink-0"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
