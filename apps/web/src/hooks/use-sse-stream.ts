'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SSEEvent } from '@/types/wiki.types';

interface UseSSEStreamOptions {
  repoUrl: string;
  branch: string;
  forceRegenerate?: boolean;
}

interface UseSSEStreamReturn {
  status: 'idle' | 'connecting' | 'processing' | 'complete' | 'error';
  events: SSEEvent[];
  currentPhase: string | null;
  progress: number;
  wikiId: string | null;
  error: string | null;
  start: () => void;
  cancel: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function useSSEStream({
  repoUrl,
  branch,
  forceRegenerate = false,
}: UseSSEStreamOptions): UseSSEStreamReturn {
  const [status, setStatus] = useState<UseSSEStreamReturn['status']>('idle');
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [wikiId, setWikiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref so we can cancel the fetch stream
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((prev) => (prev === 'idle' ? 'idle' : 'error'));
  }, []);

  const start = useCallback(() => {
    // Guard: don't start if already running
    if (status === 'connecting' || status === 'processing') return;

    // Clean up any previous connection
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('connecting');
    setEvents([]);
    setCurrentPhase(null);
    setProgress(0);
    setWikiId(null);
    setError(null);

    void (async () => {
      try {
        const res = await fetch(`${API_BASE}/wiki/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ repoUrl, branch, forceRegenerate }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`Failed to open SSE stream: ${res.status}`);
        }

        setStatus('processing');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by '\n\n'; each frame starts with 'data: '
          const frames = buffer.split('\n\n');
          // Keep the last (possibly incomplete) chunk in the buffer
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const dataLine = frame
              .split('\n')
              .find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            const json = dataLine.slice('data: '.length).trim();
            if (!json) continue;

            let event: SSEEvent;
            try {
              event = JSON.parse(json) as SSEEvent;
            } catch {
              continue;
            }

            setEvents((prev) => [...prev, event]);

            if (event.phase) setCurrentPhase(event.phase);
            if (event.progress !== undefined) setProgress(event.progress);

            if (event.type === 'complete') {
              setWikiId(event.wikiId ?? null);
              setStatus('complete');
              controller.abort();
              return;
            }

            if (event.type === 'existing') {
              setWikiId(event.wikiId ?? null);
              setStatus('complete');
              controller.abort();
              return;
            }

            if (event.type === 'error') {
              setError(event.error ?? event.message ?? 'Unknown error');
              setStatus('error');
              controller.abort();
              return;
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Stream failed');
        setStatus('error');
      }
    })();
  }, [repoUrl, branch, forceRegenerate, status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { status, events, currentPhase, progress, wikiId, error, start, cancel };
}
