import type { Source } from "../../api/client.ts";

interface SourcesListProps {
  sources: Source[];
}

const typeLabels: Record<string, string> = {
  web: "Web",
  filing: "Filing",
  news: "News",
  broker_research: "Research",
};

export function SourcesList({ sources }: SourcesListProps) {
  const webSources = sources.filter(
    (s) => s.type !== "broker_research",
  );

  if (webSources.length === 0) {
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
        {webSources.map((source, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            {source.type && (
              <span className="text-xs font-medium text-brand-500 bg-brand-100 px-1.5 py-0.5 rounded">
                {typeLabels[source.type] ?? source.type}
              </span>
            )}
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
