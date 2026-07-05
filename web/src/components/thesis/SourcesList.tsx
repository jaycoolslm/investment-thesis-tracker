import type { Source } from "../../api/client.ts";

interface SourcesListProps {
  sources: Source[];
}

export function SourcesList({ sources }: SourcesListProps) {
  if (sources.length === 0) {
    return (
      <section>
        <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
          Sources & Research
        </h3>
        <p className="text-sm text-brand-400">
          No sources recorded for this thesis.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h3 className="text-sm font-medium text-brand-500 uppercase tracking-wider mb-3">
        Web Sources
      </h3>
      <ul className="space-y-2">
        {sources.map((source, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-600 hover:underline"
              >
                {source.title}
              </a>
            ) : (
              <span className="text-brand-700">{source.title}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
