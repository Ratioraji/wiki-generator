import type {
  WikiListItem,
  WikiResponse,
  CheckExistingResponse,
  QaResponse,
  PaginatedResponse,
} from '@/types/wiki.types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// Shape of every response from the NestJS TransformInterceptor
interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  statusCode: number;
  message: string;
}

// Shape of the paginated payload inside the envelope for list endpoints
interface BackendPaginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
    ...options,
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${body || res.statusText}`);
  }

  const envelope = (await res.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export async function listWikis(
  page = 1,
  limit = 12,
  search?: string,
): Promise<PaginatedResponse<WikiListItem>> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  const paginated = await apiFetch<BackendPaginated<WikiListItem>>(`/wiki?${params}`);
  return {
    success: true,
    data: paginated.data,
    meta: {
      page: paginated.page,
      limit: paginated.limit,
      total: paginated.total,
      totalPages: paginated.totalPages,
    },
  };
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
