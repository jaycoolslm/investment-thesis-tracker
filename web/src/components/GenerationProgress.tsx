import { useEffect, useRef } from "react";
import {
  useGenerationProgress,
  type ActivityItem,
} from "../hooks/useGenerationProgress.ts";

interface GenerationProgressProps {
  holdingId: string;
  ticker: string;
  bullets: string;
  hasDocuments: boolean;
  onComplete: () => void;
  onRetry: () => void;
}

export function GenerationProgress({
  holdingId,
  ticker,
  bullets,
  hasDocuments,
  onComplete,
  onRetry,
}: GenerationProgressProps) {
  const { activity, isComplete, error } = useGenerationProgress(
    holdingId,
    bullets,
    hasDocuments,
  );

  const completeFired = useRef(false);

  useEffect(() => {
    if (isComplete && !completeFired.current) {
      completeFired.current = true;
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onComplete]);

  const feedRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    feedRef.current?.scrollTo?.({ top: feedRef.current.scrollHeight });
  }, [activity.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          {!isComplete && !error && (
            <span className="w-5 h-5 border-2 border-accent-600 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {isComplete && <CompletedIcon />}
          {error && <FailedIcon />}
          <h3 className="text-lg font-semibold text-brand-900">
            {isComplete
              ? `Thesis ready for ${ticker}`
              : error
                ? "Generation failed"
                : `Generating thesis for ${ticker}`}
          </h3>
        </div>

        {/* Activity feed */}
        <ul
          ref={feedRef}
          className="space-y-2 mb-4 max-h-48 overflow-y-auto"
          aria-label="Agent activity"
        >
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
          {activity.length === 0 && !error && (
            <li className="text-sm text-brand-400">
              Starting up...
            </li>
          )}
        </ul>

        {/* Footer */}
        {!error && !isComplete && (
          <p className="text-xs text-brand-400 text-center">
            This typically takes 30-60 seconds.
          </p>
        )}

        {error && (
          <div className="text-center space-y-3">
            <p className="text-sm text-error-text">{error}</p>
            <button
              onClick={onRetry}
              className="bg-accent-600 hover:bg-accent-700 text-white text-sm font-medium px-4 py-2 rounded-md transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <li className="flex items-start gap-2 text-sm text-brand-700">
      <span className="shrink-0 mt-0.5">
        {item.type === "web_search" && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-accent-600"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        {item.type === "file_read" && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="text-brand-500"
          >
            <path
              d="M3 2h5l3 3v7a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path d="M8 2v3h3" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        )}
        {item.type === "activity" && (
          <span className="inline-block w-1.5 h-1.5 bg-brand-400 rounded-full mt-1.5" />
        )}
      </span>
      <span className="break-words">
        {item.type === "web_search" && `Searching: "${item.text}"`}
        {item.type === "file_read" && `Reading: ${item.text}`}
        {item.type === "activity" && item.text}
      </span>
    </li>
  );
}

function CompletedIcon() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-status-green-100 text-status-green-700 shrink-0">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M2.5 6L5 8.5L9.5 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function FailedIcon() {
  return (
    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-error-bg text-error-text shrink-0">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="M3 3L9 9M9 3L3 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
