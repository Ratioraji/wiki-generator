'use client';

import { useQuery } from '@tanstack/react-query';
import { listWikis } from '@/lib/api-client';

export function useWikiHistory(page: number, limit: number, search?: string) {
  return useQuery({
    queryKey: ['wikis', page, limit, search],
    queryFn: () => listWikis(page, limit, search),
    staleTime: 30_000,
  });
}
