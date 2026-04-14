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

export interface ThesisPillar {
  id: string;
  thesisId: string;
  title: string;
  body: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Valuation {
  methodology: string;
  currentPrice: number | null;
  upsideCase: string | null;
  baseCase: string | null;
  downsideCase: string | null;
}

export interface Risk {
  description: string;
  severity: "high" | "medium" | "low";
}

export interface Source {
  title: string;
  url: string | null;
  type: "web" | "broker_research" | "filing" | "news" | null;
}

export interface Thesis {
  id: string;
  holdingId: string;
  summary: string | null;
  qualityAssess: string | null;
  valuation: Valuation | null;
  assumptions: string[] | null;
  risks: Risk[] | null;
  sources: Source[] | null;
  createdAt: string;
  updatedAt: string;
  pillars: ThesisPillar[];
}

export interface ThesisUpdateInput {
  summary?: string;
  qualityAssess?: string;
  valuation?: Valuation;
  assumptions?: string[];
  risks?: Risk[];
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

export function createPillar(
  thesisId: string,
  data: { title: string; body?: string },
): Promise<ThesisPillar> {
  return apiFetch(`/api/theses/${thesisId}/pillars`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePillar(
  thesisId: string,
  pillarId: string,
  data: { title?: string; body?: string },
): Promise<ThesisPillar> {
  return apiFetch(`/api/theses/${thesisId}/pillars/${pillarId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePillar(
  thesisId: string,
  pillarId: string,
): Promise<void> {
  return apiFetch(`/api/theses/${thesisId}/pillars/${pillarId}`, {
    method: "DELETE",
  });
}

export function reorderPillars(
  thesisId: string,
  pillarIds: string[],
): Promise<ThesisPillar[]> {
  return apiFetch(`/api/theses/${thesisId}/pillars/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ pillarIds }),
  });
}
