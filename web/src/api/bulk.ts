export interface BulkPreviewRow {
  rowNumber: number;
  ticker: string | null;
  companyName: string | null;
  direction: "long" | "short" | null;
  bullets: string | null;
  valid: boolean;
  errors: string[];
}

export interface BulkPreview {
  batchId: string;
  rows: BulkPreviewRow[];
  validCount: number;
  errorCount: number;
}

export interface BulkStartResult {
  batchId: string;
  totalJobs: number;
  holdingIds: string[];
}

export interface BulkFailure {
  holdingId: string;
  ticker: string;
  error: string;
}

export async function uploadBulkFile(file: File): Promise<BulkPreview> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/bulk-generate", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export async function startBulkGeneration(
  batchId: string,
  excludeRows?: number[],
): Promise<BulkStartResult> {
  const res = await fetch(`/api/bulk-generate/${batchId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ excludeRows }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to start generation: ${res.status}`);
  }

  return res.json();
}

export async function cancelBulkGeneration(
  batchId: string,
): Promise<{ cancelled: number; alreadyCompleted: number }> {
  const res = await fetch(`/api/bulk-generate/${batchId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Cancel failed: ${res.status}`);
  }

  return res.json();
}

export async function retryBulkGeneration(
  batchId: string,
  holdingIds?: string[],
): Promise<{ retryCount: number; holdingIds: string[] }> {
  const res = await fetch(`/api/bulk-generate/${batchId}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdingIds }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Retry failed: ${res.status}`);
  }

  return res.json();
}

export function downloadTemplate(): void {
  window.open("/api/bulk-generate/template", "_blank");
}
