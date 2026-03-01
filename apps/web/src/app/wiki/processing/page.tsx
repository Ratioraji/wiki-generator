'use client';

import { Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProcessingStream } from '@/components/processing-stream';

function extractRepoName(repoUrl: string): string {
  try {
    const u = new URL(repoUrl);
    const parts = u.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    return parts.slice(-2).join('/');
  } catch {
    return repoUrl;
  }
}

function ProcessingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const repoUrl = searchParams.get('repo') ?? '';
  const branch = searchParams.get('branch') ?? 'main';
  const force = searchParams.get('force') === 'true';

  const repoName = repoUrl ? extractRepoName(repoUrl) : '…';

  const handleWikiReady = useCallback(
    (wikiId: string) => {
      router.push(`/wiki/${wikiId}`);
    },
    [router],
  );

  if (!repoUrl) {
    return (
      <div
        style={{
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '60px 20px',
        }}
      >
        ✗ No repository URL provided.{' '}
        <Link href="/" style={{ color: 'var(--text-accent)' }}>
          Go back
        </Link>
      </div>
    );
  }

  return (
    <main
      style={{
        backgroundColor: 'var(--bg-primary)',
        minHeight: '100vh',
        padding: '20px',
        maxWidth: '900px',
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <header
        style={{
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <h1
          style={{
            fontSize: '14px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Generating Wiki —{' '}
          <span style={{ color: 'var(--text-accent)' }}>{repoName}</span>
          {' @ '}
          <span style={{ color: 'var(--text-secondary)' }}>{branch}</span>
        </h1>
      </header>

      <ProcessingStream
        repoUrl={repoUrl}
        branch={branch}
        forceRegenerate={force}
        onWikiReady={handleWikiReady}
      />
    </main>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Loading...
        </div>
      }
    >
      <ProcessingPageContent />
    </Suspense>
  );
}
