import { useNavigate, useOutletContext } from "react-router";
import { useHoldings, useDeleteHolding } from "../hooks/useHoldings.ts";
import { HoldingsTable } from "../components/HoldingsTable.tsx";
import { LoadingSkeleton } from "../components/LoadingSkeleton.tsx";
import { EmptyState } from "../components/EmptyState.tsx";

interface LayoutContext {
  onAddHolding: () => void;
}

export function Dashboard() {
  const { onAddHolding } = useOutletContext<LayoutContext>();
  const { data: holdings, isLoading, isError, error } = useHoldings();
  const deleteMutation = useDeleteHolding();
  const navigate = useNavigate();

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
        <EmptyState onAddHolding={onAddHolding} />
      )}

      {holdings && holdings.length > 0 && (
        <HoldingsTable
          data={holdings}
          onDelete={(id) => deleteMutation.mutate(id)}
          onRowClick={(id) => navigate(`/holdings/${id}`)}
        />
      )}
    </div>
  );
}
