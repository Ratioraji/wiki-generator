'use client';

import { useQuery } from '@tanstack/react-query';
import { getWiki } from '@/lib/api-client';

export function useWikiData(id: string) {
  return useQuery({
    queryKey: ['wiki', id],
    queryFn: () => getWiki(id),
    staleTime: 60_000,
    enabled: Boolean(id),
  });
}
