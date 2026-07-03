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

export interface Source {
  title: string;
  url: string | null;
  type: "web" | "broker_research" | "filing" | "news" | null;
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

export interface MonitoringBatchStatus {
  weekLabel: string;
  total: number;
  completed: number;
  failed: number;
  status: "active" | "complete";
  startedAt: string;
}

export function triggerMonitoringBatch(): Promise<MonitoringBatchStatus> {
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
