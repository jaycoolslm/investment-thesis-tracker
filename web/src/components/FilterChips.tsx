import clsx from "clsx";

const CHIP_OPTIONS = [
  "All",
  "Long",
  "Short",
  "Strengthened",
  "Weakened",
  "Unchanged",
  "Active",
  "Closed",
  "Paused",
] as const;

interface FilterChipsProps {
  activeFilters: string[];
  onToggle: (filter: string) => void;
}

export function FilterChips({ activeFilters, onToggle }: FilterChipsProps) {
  return (
    <div role="group" aria-label="Filter holdings" className="flex flex-wrap gap-2 mt-3">
      {CHIP_OPTIONS.map((chip) => {
        const isActive = activeFilters.includes(chip);
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={isActive}
            onClick={() => onToggle(chip)}
            className={clsx(
              "text-sm px-3 py-1 rounded-full border cursor-pointer transition-colors",
              isActive
                ? "bg-accent-50 border-accent-600 text-accent-600 font-medium"
                : "bg-surface-card border-brand-200 text-brand-700 hover:bg-brand-100",
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
