import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import { useHoldings, useDeleteHolding } from "../hooks/useHoldings.ts";
import { HoldingsTable } from "../components/HoldingsTable.tsx";
import { LoadingSkeleton } from "../components/LoadingSkeleton.tsx";
import { EmptyState } from "../components/EmptyState.tsx";
import { SearchBar } from "../components/SearchBar.tsx";
import { FilterChips } from "../components/FilterChips.tsx";
import { MonitoringHistory } from "../components/MonitoringHistory.tsx";
import { ProviderHealthCard } from "../components/ProviderHealthCard.tsx";

interface LayoutContext {
  onAddHolding: () => void;
  onBulkUpload?: () => void;
}

export function Dashboard() {
  const { onAddHolding, onBulkUpload } = useOutletContext<LayoutContext>();
  const { data: holdings, isLoading, isError, error } = useHoldings();
  const deleteMutation = useDeleteHolding();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>(["All"]);

  function handleFilterToggle(filter: string) {
    setActiveFilters((prev) => {
      if (filter === "All") return ["All"];

      let next = prev.filter((f) => f !== "All");

      const directionChips = ["Long", "Short"];
      const statusChips = ["Active", "Closed", "Paused"];
      const isDirection = directionChips.includes(filter);
      const isStatus = statusChips.includes(filter);

      if (next.includes(filter)) {
        next = next.filter((f) => f !== filter);
      } else {
        if (isDirection) {
          next = next.filter((f) => !directionChips.includes(f));
        }
        if (isStatus) {
          next = next.filter((f) => !statusChips.includes(f));
        }
        next.push(filter);
      }

      return next.length === 0 ? ["All"] : next;
    });
  }

  function handleClearFilters() {
    setSearchQuery("");
    setActiveFilters(["All"]);
  }

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight text-brand-900 mb-6">
        Holdings
      </h2>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className="bg-error-bg border border-error-border rounded-md p-4">
          <p className="text-sm text-error-text">
            Failed to load holdings: {error.message}
          </p>
        </div>
      )}

      {holdings && holdings.length === 0 && (
        <EmptyState onAddHolding={onAddHolding} onBulkUpload={onBulkUpload} />
      )}

      {holdings && holdings.length > 0 && (
        <>
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <FilterChips
            activeFilters={activeFilters}
            onToggle={handleFilterToggle}
          />
          <div className="mt-4">
            <HoldingsTable
              data={holdings}
              onDelete={(id) => deleteMutation.mutate(id)}
              onRowClick={(id) => navigate(`/holdings/${id}`)}
              globalFilter={{ searchQuery, activeFilters }}
              onClearFilters={handleClearFilters}
            />
          </div>
          <MonitoringHistory />
          <ProviderHealthCard />
        </>
      )}
    </div>
  );
}
