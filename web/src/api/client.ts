export interface Holding {
  id: string;
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmark: string;
  status: "active" | "closed" | "paused";
  latestImpact: "strengthened" | "weakened" | "unchanged" | null;
  lastUpdated: string | null;
  createdAt: string;
  weakenedStreak?: boolean;
}

export interface CreateHoldingInput {
  ticker: string;
  companyName: string;
  direction: "long" | "short";
  benchmark?: string;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getHoldings(): Promise<Holding[]> {
  return apiFetch("/api/holdings");
}

export function getHolding(id: string): Promise<Holding> {
  return apiFetch(`/api/holdings/${id}`);
}

export function createHolding(data: CreateHoldingInput): Promise<Holding> {
  return apiFetch("/api/holdings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateHolding(
  id: string,
  data: Partial<Holding>,
): Promise<Holding> {
  return apiFetch(`/api/holdings/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteHolding(id: string): Promise<void> {
  return apiFetch(`/api/holdings/${id}`, { method: "DELETE" });
}

// Thesis types

/** Legacy stored sources may carry an extra `type` field; it is ignored. */
export interface Source {
  title: string;
  url: string | null;
}

export interface Thesis {
  id: string;
  holdingId: string;
  content: string | null;
  sources: Source[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThesisUpdateInput {
  content?: string;
}

export interface Document {
  id: string;
  holdingId: string;
  filename: string;
  filePath: string;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

// Thesis generation

export function generateThesis(
  holdingId: string,
  bullets: string,
): Promise<{ thesisId: string }> {
  return apiFetch(`/api/holdings/${holdingId}/generate`, {
    method: "POST",
    body: JSON.stringify({ bullets }),
  });
}

export interface GenerationStatus {
  status: "running" | "complete" | "failed";
  startedAt: string;
  events: string[];
  error?: string;
}

/** Returns null when no generation is tracked for the holding (404). */
export async function getGenerationStatus(
  holdingId: string,
): Promise<GenerationStatus | null> {
  const res = await fetch(`/api/holdings/${holdingId}/generation-status`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

export function getThesis(holdingId: string): Promise<Thesis> {
  return apiFetch(`/api/holdings/${holdingId}/thesis`);
}

// Document upload

export async function uploadDocument(
  holdingId: string,
  file: File,
): Promise<Document> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api/holdings/${holdingId}/documents`, {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export function getDocuments(holdingId: string): Promise<Document[]> {
  return apiFetch(`/api/holdings/${holdingId}/documents`);
}

export function deleteDocument(
  holdingId: string,
  documentId: string,
): Promise<void> {
  return apiFetch(`/api/holdings/${holdingId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

// Thesis editing

export function updateThesis(
  thesisId: string,
  data: ThesisUpdateInput,
): Promise<Thesis> {
  return apiFetch(`/api/theses/${thesisId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Weekly logs

export interface WeeklyLog {
  id: string;
  holdingId: string;
  weekLabel: string | null;
  weekDate: string | null;
  priceChangePct: string | null;
  indexChangePct: string | null;
  relativePerf: string | null;
  thesisImpact: "strengthened" | "weakened" | "unchanged" | null;
  summary: string | null;
  sources: unknown;
  createdAt: string;
}

export function getWeeklyLogs(holdingId: string): Promise<WeeklyLog[]> {
  return apiFetch(`/api/holdings/${holdingId}/weekly-logs`);
}

export function triggerWeeklyMonitoring(holdingId: string): Promise<WeeklyLog> {
  return apiFetch(`/api/holdings/${holdingId}/weekly-logs/trigger`, {
    method: "POST",
  });
}

// Batch monitoring

export interface MonitoringFailure {
  holdingId: string;
  ticker: string;
  error: string;
}

export interface MonitoringBatchStatus {
  weekLabel: string;
  total: number;
  completed: number;
  failed: number;
  status: "active" | "complete" | "cancelled";
  startedAt: string;
  failures?: MonitoringFailure[];
}

export interface MonitoringTriggerResult {
  weekLabel?: string;
  total?: number;
  status?: "active";
  /** Set when there was nothing to monitor this week. */
  message?: string;
}

export function triggerMonitoringBatch(): Promise<MonitoringTriggerResult> {
  return apiFetch("/api/monitoring/trigger", { method: "POST" });
}

export function getMonitoringStatus(): Promise<MonitoringBatchStatus> {
  return apiFetch("/api/monitoring/status");
}

// Monitoring history

export interface MonitoringHistoryEntry {
  weekLabel: string;
  weekDate: string;
  total: number;
  strengthened: number;
  weakened: number;
  unchanged: number;
  startedAt: string;
}

export function getMonitoringHistory(): Promise<MonitoringHistoryEntry[]> {
  return apiFetch("/api/monitoring/history");
}

// Data provider health

export interface ProviderCrawlRun {
  id: number;
  source: string;
  startedAt: string;
  finishedAt: string | null;
  articlesSeen: number;
  articlesNew: number;
  error: string | null;
}

export interface ProviderHealth {
  status: "ok";
  articleCount: number;
  bodyCount: number;
  sources: Array<{
    source: string;
    lastRun: ProviderCrawlRun | null;
  }>;
}

/**
 * Fetches data provider health via the tracker proxy. Returns null when the
 * provider is not configured (503) so the UI can hide the health card; other
 * failures throw so the query surfaces an error state.
 */
export async function getProviderHealth(): Promise<ProviderHealth | null> {
  const res = await fetch("/api/provider/health");
  if (res.status === 503) {
    const body = await res.json().catch(() => ({}));
    if (body.error === "Data provider not configured") return null;
    throw new Error(body.error ?? "Data provider unreachable");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
