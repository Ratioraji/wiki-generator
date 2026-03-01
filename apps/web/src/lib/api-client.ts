import type {
  WikiListItem,
  WikiResponse,
  CheckExistingResponse,
  QaResponse,
  PaginatedResponse,
} from '@/types/wiki.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export async function listWikis(
  page = 1,
  limit = 12,
  search?: string,
): Promise<PaginatedResponse<WikiListItem>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiFetch<PaginatedResponse<WikiListItem>>(`/wiki?${params}`);
}

export async function checkExistingWiki(
  repoUrl: string,
  branch: string,
): Promise<CheckExistingResponse> {
  const params = new URLSearchParams({ repoUrl, branch });
  return apiFetch<CheckExistingResponse>(`/wiki/check?${params}`);
}

export async function getWiki(id: string): Promise<WikiResponse> {
  return apiFetch<WikiResponse>(`/wiki/${id}`);
}

export async function askQuestion(
  wikiId: string,
  question: string,
): Promise<QaResponse> {
  return apiFetch<QaResponse>(`/wiki/${wikiId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}
